/**
 * NOVA agent core — runtime neutral.
 *
 * Uses only `fetch`-era globals plus two npm packages, so the identical code
 * runs in Deno (the deployed edge function) and Node (the Vite dev proxy).
 * That is deliberate: one implementation means dev and production cannot
 * drift. Neither transport does anything but adapt HTTP to the event stream
 * this module yields.
 *
 * There are no module-level side effects — no client is constructed at import
 * time — so importing this file is safe from a Vite config.
 */
import { GoogleGenAI } from '@google/genai'
import type { Content, FunctionCall, Part } from '@google/genai'
import { createClient } from '@supabase/supabase-js'
import type { SupabaseClient } from '@supabase/supabase-js'

import {
  AGENT_TIMEOUT_MS,
  MAX_MESSAGE_LENGTH,
  MAX_MODEL_TURNS,
  MODEL_RETRY_ATTEMPTS,
  MODEL_RETRY_BASE_MS,
  resolveNovaModel,
} from './config.ts'
import { loadConversationHistory } from './history.ts'
import { NOVA_SYSTEM_INSTRUCTION } from './prompt.ts'
import {
  SEARCH_PLACES,
  executeSearchPlaces,
  searchPlacesDeclaration,
  validateSearchPlacesArgs,
} from './tools.ts'
import type { SearchPlacesToolResponse } from './tools.ts'
import type {
  NovaAgentRequestBody,
  NovaErrorCode,
  NovaServerEvent,
} from '../../../src/lib/nova/events.ts'
import type { Database } from '../../../src/types/database.ts'

export interface NovaAgentEnv {
  geminiApiKey: string | undefined
  supabaseUrl: string | undefined
  supabaseAnonKey: string | undefined
  /** Raw `Authorization` header from the caller, when signed in. */
  authorization: string | null
  /** Optional server-side model override; falls back to the default. */
  model?: string | undefined
}

/** A tool call as recorded for `nova_messages.tool_calls`. */
interface RecordedCall {
  callId: string | null
  name: string
  arguments: Record<string, unknown>
  status: 'done' | 'error'
}

class AgentError extends Error {
  // Written out rather than a parameter property: `erasableSyntaxOnly` forbids
  // the shorthand, and this file must stay strip-only for Deno.
  readonly code: NovaErrorCode

  constructor(code: NovaErrorCode, message: string) {
    super(message)
    this.code = code
  }
}

/** Never let a provider message reach the traveller verbatim. */
function userFacing(code: NovaErrorCode): string {
  switch (code) {
    case 'not_configured':
      return 'NOVA is not connected in this environment yet.'
    case 'bad_request':
      return 'That message could not be read. Try rephrasing it.'
    case 'unauthorized':
      return 'Your session has expired. Sign in again to keep talking to NOVA.'
    case 'provider_error':
      return 'NOVA could not reach its language model. Try again in a moment.'
    case 'quota_exceeded':
      return 'Nova is temporarily unavailable because today’s AI usage limit has been reached. Please try again later.'
    case 'rate_limited':
      return 'Nova is handling a lot of requests right now. Please try again in a moment.'
    case 'conversation_not_found':
      return 'That conversation is no longer available. Send a new message to start a fresh one.'
    case 'retrieval_error':
      return 'NOVA could not search the place catalogue just now.'
    case 'timeout':
      return 'That took too long. Try a shorter or more specific question.'
    default:
      return 'Something went wrong on NOVA’s side. Try again.'
  }
}

/**
 * Runs one traveller message to completion, narrating progress as it goes.
 *
 * Yields events rather than returning a value so a transport can stream them;
 * a transport that does not want to stream can simply collect them.
 */
export async function* runNovaAgent(
  env: NovaAgentEnv,
  body: NovaAgentRequestBody,
): AsyncGenerator<NovaServerEvent> {
  const startedAt = Date.now()

  try {
    /* --- Validate input and environment ---------------------------------- */
    const message = typeof body?.message === 'string' ? body.message.trim() : ''
    if (!message) {
      throw new AgentError('bad_request', 'empty message')
    }
    if (message.length > MAX_MESSAGE_LENGTH) {
      throw new AgentError('bad_request', 'message too long')
    }
    if (!env.geminiApiKey) {
      throw new AgentError('not_configured', 'GEMINI_API_KEY is not set')
    }
    if (!env.supabaseUrl || !env.supabaseAnonKey) {
      throw new AgentError('not_configured', 'Supabase is not configured')
    }

    const ai = new GoogleGenAI({ apiKey: env.geminiApiKey })
    const model = resolveNovaModel(env.model)

    /*
     * Caller-scoped Supabase client.
     *
     * The anon key plus the traveller's Authorization header — no service role
     * anywhere in this function. `match_places` is granted to anon and
     * authenticated, and nova_messages is owner-scoped, so RLS does exactly
     * what it was written to do without a privileged escape hatch.
     */
    const db: SupabaseClient<Database> = createClient<Database>(
      env.supabaseUrl,
      env.supabaseAnonKey,
      {
        auth: { persistSession: false, autoRefreshToken: false },
        global: env.authorization ? { headers: { Authorization: env.authorization } } : {},
      },
    )

    /* --- Who is asking --------------------------------------------------- */
    /*
     * Resolved once, here, rather than again at persistence time: history
     * loading and saving both need it, and it is one round-trip either way.
     * An anon-key JWT carries no user, which is what makes anonymous callers
     * read-nothing and save-nothing without any special case.
     */
    const viewerId = await resolveViewerId(db, env.authorization)

    /* --- Conversation history -------------------------------------------- */
    const requestedConversationId = body.conversationId ?? null
    let history: Content[] = []
    let conversationId: string | null = null

    if (requestedConversationId && viewerId) {
      const lookup = await loadConversationHistory(db, requestedConversationId)
      if (!lookup.ok) {
        // Not ours, or not a conversation at all. Fail before spending a model
        // call or a retrieval, and say nothing about which of the two it was.
        throw new AgentError('conversation_not_found', 'conversation unavailable')
      }
      history = lookup.contents
      conversationId = requestedConversationId
    } else if (requestedConversationId && !viewerId) {
      // A signed-out caller holding a stale id from a previous session. There
      // is nothing for them to read, so start fresh rather than error.
      console.warn('[nova-agent] ignoring conversationId from an unauthenticated caller')
    }

    /* --- The tool-calling loop ------------------------------------------- */
    const contents: Content[] = [...history, { role: 'user', parts: [{ text: message }] }]
    const recordedCalls: RecordedCall[] = []
    const recordedResults: SearchPlacesToolResponse[] = []
    let answer = ''
    // Retrieval accounting. If the model reached for its only tool and every
    // call failed, an answer it produces anyway is ungrounded by construction.
    let toolCallsAttempted = 0
    let toolCallsSucceeded = 0

    for (let turn = 0; turn < MAX_MODEL_TURNS; turn += 1) {
      if (Date.now() - startedAt > AGENT_TIMEOUT_MS) {
        throw new AgentError('timeout', 'agent budget exceeded')
      }

      yield { type: 'status', state: 'thinking' }

      let response
      try {
        response = await callModelWithRetry(
          () =>
            ai.models.generateContent({
              model,
              contents,
              config: {
                systemInstruction: NOVA_SYSTEM_INSTRUCTION,
                tools: [{ functionDeclarations: [searchPlacesDeclaration] }],
              },
            }),
          () => Date.now() - startedAt < AGENT_TIMEOUT_MS,
        )
      } catch (error) {
        console.error(`[nova-agent] Gemini call failed: ${describe(error)}`)
        const code: NovaErrorCode = isDailyQuotaExhausted(error)
          ? 'quota_exceeded'
          : isRateLimited(error)
            ? 'rate_limited'
            : 'provider_error'
        throw new AgentError(code, 'generateContent failed')
      }

      const calls: FunctionCall[] = response.functionCalls ?? []

      /* No tool requested — this turn is the answer. */
      if (!calls.length) {
        answer = (response.text ?? '').trim()
        if (!answer) {
          throw new AgentError('provider_error', 'model returned no text')
        }
        break
      }

      /* Record the model's turn verbatim so the next request has full context. */
      const modelTurn = response.candidates?.[0]?.content
      contents.push(
        modelTurn ?? {
          role: 'model',
          parts: calls.map((call) => ({ functionCall: call })),
        },
      )

      /* Execute every requested call, then reply with all results at once. */
      const responseParts: Part[] = []

      for (const call of calls) {
        const name = call.name ?? ''

        if (name !== SEARCH_PLACES) {
          // The model can only be given tools we declared, so this is a
          // defensive branch rather than an expected one.
          responseParts.push(
            toResponsePart(call, { error: `Unknown tool "${name}". It is not available.` }),
          )
          continue
        }

        const validation = validateSearchPlacesArgs(call.args ?? {})

        if (!validation.ok) {
          toolCallsAttempted += 1
          yield {
            type: 'tool',
            name: SEARCH_PLACES,
            status: 'error',
            summary: 'Search request was not valid',
          }
          recordedCalls.push({
            callId: call.id ?? null,
            name: SEARCH_PLACES,
            arguments: call.args ?? {},
            status: 'error',
          })
          responseParts.push(toResponsePart(call, { error: validation.error }))
          continue
        }

        const { args } = validation
        yield {
          type: 'tool',
          name: SEARCH_PLACES,
          status: 'running',
          summary: `Searching Tunisia for “${args.query}”`,
        }

        const result = await executeSearchPlaces(ai, db, args)
        const count = result.results?.length ?? 0
        toolCallsAttempted += 1
        // An empty-but-successful search counts as success: the model is told
        // nothing matched, which is a grounded answer. Only errors count against.
        if (!result.error) toolCallsSucceeded += 1

        yield {
          type: 'tool',
          name: SEARCH_PLACES,
          status: result.error ? 'error' : 'done',
          summary: result.error
            ? 'Could not search the catalogue'
            : count
              ? `Found ${count} place${count === 1 ? '' : 's'}`
              : 'No matching places',
          resultCount: count,
        }

        recordedCalls.push({
          callId: call.id ?? null,
          name: SEARCH_PLACES,
          arguments: { ...args },
          status: result.error ? 'error' : 'done',
        })
        recordedResults.push(result)
        responseParts.push(toResponsePart(call, result))
      }

      contents.push({ role: 'user', parts: responseParts })
    }

    /*
     * Grounding enforcement.
     *
     * Observed in production verification: with retrieval broken, the model
     * acknowledged the outage and then answered from its own memory anyway,
     * naming real Tunisian sites that are not in our catalogue, with distances
     * and features no tool returned. The system prompt now forbids that, but a
     * prompt is guidance — this is the guard. If the model asked for the
     * catalogue and every attempt failed, the traveller gets an honest error
     * instead of a plausible invention.
     */
    if (toolCallsAttempted > 0 && toolCallsSucceeded === 0) {
      console.error('[nova-agent] every search_places call failed; suppressing ungrounded answer')
      throw new AgentError('retrieval_error', 'all retrieval attempts failed')
    }

    if (!answer) {
      throw new AgentError('provider_error', 'no answer after the turn budget')
    }

    yield { type: 'text', content: answer }

    /* --- Persistence ------------------------------------------------------ */
    const persistence = await persistExchange(db, {
      viewerId,
      conversationId,
      tripId: body.tripId ?? null,
      userMessage: message,
      assistantMessage: answer,
      calls: recordedCalls,
      results: recordedResults,
    })

    yield {
      type: 'done',
      conversationId: persistence.conversationId,
      persisted: persistence.persisted,
    }
  } catch (error) {
    const code = error instanceof AgentError ? error.code : 'internal_error'
    if (!(error instanceof AgentError)) {
      console.error(`[nova-agent] unhandled: ${describe(error)}`)
    }
    yield { type: 'error', code, message: userFacing(code) }
  }
}

function toResponsePart(call: FunctionCall, response: SearchPlacesToolResponse): Part {
  return {
    functionResponse: {
      id: call.id,
      name: call.name ?? SEARCH_PLACES,
      response: response as unknown as Record<string, unknown>,
    },
  }
}

/** Pulls the provider's HTTP code and gRPC status out of an SDK error. */
function providerStatus(error: unknown): { code: number | null; status: string } {
  const message = describe(error)
  const code = Number(message.match(/"code"\s*:\s*(\d{3})/)?.[1] ?? Number.NaN)
  const status = message.match(/"status"\s*:\s*"([A-Z_]+)"/)?.[1] ?? ''
  return { code: Number.isFinite(code) ? code : null, status }
}

/**
 * True only when the day's allowance for this model is gone.
 *
 * Keyed on `PerDay`, which appears in the quotaId of a daily violation
 * (`GenerateRequestsPerDayPerProjectPerModel-FreeTier`) and nowhere else.
 *
 * This used to also accept a bare `RESOURCE_EXHAUSTED`, which a *per-minute*
 * limit returns too — so a sixty-second hiccup was reported to travellers as
 * "come back tomorrow". The marker has to be the daily one specifically.
 */
export function isDailyQuotaExhausted(error: unknown): boolean {
  return /PerDay/i.test(describe(error))
}

/** A momentary limit: right code, but the allowance returns in seconds. */
export function isRateLimited(error: unknown): boolean {
  if (isDailyQuotaExhausted(error)) return false
  const { code, status } = providerStatus(error)
  return code === 429 || status === 'RESOURCE_EXHAUSTED'
}

/**
 * True only for failures where retrying can plausibly succeed: provider
 * capacity (5xx) and transport faults.
 *
 * Deliberately excludes every 429. Both flavours of quota error are left to
 * fail fast — retrying them burns more of the same allowance that just ran
 * out, which is the opposite of helpful.
 */
export function isRetryableProviderError(error: unknown): boolean {
  if (isDailyQuotaExhausted(error) || isRateLimited(error)) return false
  const { code, status } = providerStatus(error)
  if (code !== null && code >= 500) return true
  if (/UNAVAILABLE|INTERNAL|DEADLINE_EXCEEDED/.test(status)) return true
  return /fetch failed|ECONNRESET|ETIMEDOUT|network/i.test(describe(error))
}

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

/** Retries a model call with exponential backoff, respecting the time budget. */
async function callModelWithRetry<T>(
  run: () => Promise<T>,
  hasBudget: () => boolean,
): Promise<T> {
  let lastError: unknown

  for (let attempt = 1; attempt <= MODEL_RETRY_ATTEMPTS; attempt += 1) {
    try {
      return await run()
    } catch (error) {
      lastError = error
      const retryable = isRetryableProviderError(error)
      if (!retryable || attempt === MODEL_RETRY_ATTEMPTS || !hasBudget()) break
      const backoff = MODEL_RETRY_BASE_MS * 2 ** (attempt - 1)
      console.warn(`[nova-agent] retrying model call in ${backoff}ms: ${describe(error)}`)
      await delay(backoff)
    }
  }

  throw lastError
}

/**
 * The authenticated user behind this request, or null.
 *
 * An anon-key JWT is a valid project token with no user attached, so this
 * returns null for anonymous callers without treating them as an error.
 */
async function resolveViewerId(
  db: SupabaseClient<Database>,
  authorization: string | null,
): Promise<string | null> {
  if (!authorization) return null
  try {
    const { data } = await db.auth.getUser()
    return data?.user?.id ?? null
  } catch {
    return null
  }
}

function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

interface PersistInput {
  /** Resolved once by the caller; null for an anonymous request. */
  viewerId: string | null
  conversationId: string | null
  tripId: string | null
  userMessage: string
  assistantMessage: string
  calls: RecordedCall[]
  results: SearchPlacesToolResponse[]
}

/**
 * Writes the exchange to the existing nova_conversations / nova_messages
 * tables, under the caller's own JWT so the owner-only policies apply.
 *
 * Anonymous callers are not an error: they simply get no history, because
 * nova_conversations.user_id is NOT NULL and RLS has nothing to match. The
 * conversation still worked — it just was not saved, and the client is told so
 * via `persisted: false` rather than being shown a failure.
 *
 * Persistence never fails the request. Losing a transcript row must not cost
 * the traveller the answer they already have.
 */
async function persistExchange(
  db: SupabaseClient<Database>,
  input: PersistInput,
): Promise<{ conversationId: string | null; persisted: boolean }> {
  const userId = input.viewerId
  if (!userId) {
    return { conversationId: null, persisted: false }
  }

  try {
    let conversationId = input.conversationId

    if (!conversationId) {
      const { data, error } = await db
        .from('nova_conversations')
        .insert({
          user_id: userId,
          trip_id: input.tripId,
          title: input.userMessage.slice(0, 80),
        })
        .select('id')
        .single()

      if (error || !data) {
        console.error(`[nova-agent] conversation insert failed: ${error?.message}`)
        return { conversationId: null, persisted: false }
      }
      conversationId = data.id
    }

    const { error: messageError } = await db.from('nova_messages').insert([
      {
        conversation_id: conversationId,
        role: 'user',
        content: input.userMessage,
      },
      {
        conversation_id: conversationId,
        role: 'nova',
        content: input.assistantMessage,
        tool_calls: input.calls.length ? input.calls : null,
        // Stored for audit. Trimmed to slugs so a transcript row does not
        // duplicate the whole catalogue on every message.
        tool_results: input.results.length
          ? input.results.map((result) => ({
              error: result.error ?? null,
              note: result.note ?? null,
              slugs: (result.results ?? []).map((row) => row.slug),
            }))
          : null,
      },
    ])

    if (messageError) {
      console.error(`[nova-agent] message insert failed: ${messageError.message}`)
      return { conversationId, persisted: false }
    }

    return { conversationId, persisted: true }
  } catch (error) {
    console.error(`[nova-agent] persistence error: ${describe(error)}`)
    return { conversationId: input.conversationId, persisted: false }
  }
}
