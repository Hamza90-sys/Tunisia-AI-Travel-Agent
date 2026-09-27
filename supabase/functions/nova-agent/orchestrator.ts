/**
 * NOVA orchestrator.
 *
 * The centre of the agent: it owns the conversation turn and nothing else
 * owns it. It loads context, asks the provider what to do, runs registered
 * tools, feeds results back, and narrates progress as events.
 *
 * Two boundaries are load-bearing here:
 *   • it talks to `LLMProvider`, never to a vendor SDK, so the provider can be
 *     swapped for NVIDIA without touching this file;
 *   • it talks to the tool registry, never to Supabase directly, so the
 *     deterministic services stay the source of truth for anything factual.
 *
 * The transports (edge function, dev proxy) do nothing but adapt HTTP to the
 * events this yields.
 */
import { createClient } from '@supabase/supabase-js'
import type { SupabaseClient } from '@supabase/supabase-js'

import {
  AGENT_TIMEOUT_MS,
  MAX_MESSAGE_LENGTH,
  MAX_MODEL_TURNS,
  resolveNovaModel,
} from './config.ts'
import { loadConversationHistory, toGeminiContents } from './history.ts'
import { createGeminiEmbeddingProvider } from './embeddings.ts'
import { LLMError, resolveProvider } from './llm/index.ts'
import type { LLMMessage, LLMToolCall, LLMToolResult } from './llm/index.ts'
import { NOVA_SYSTEM_INSTRUCTION } from './prompt.ts'
import { findTool, toolDefinitions } from './tools/registry.ts'
import type { ToolResult } from './tools/registry.ts'
import type { NovaAgentRequestBody, NovaErrorCode, NovaServerEvent } from '../../../src/lib/nova/events.ts'
import type { Database } from '../../../src/types/database.ts'

export interface NovaAgentEnv {
  geminiApiKey: string | undefined
  supabaseUrl: string | undefined
  supabaseAnonKey: string | undefined
  authorization: string | null
  model?: string | undefined
  /** `gemini` (default) or `nvidia`. Server-side only. */
  llmProvider?: string | undefined
  nvidiaBaseUrl?: string | undefined
  nvidiaApiKey?: string | undefined
  nvidiaModel?: string | undefined
}

interface RecordedCall {
  callId: string | null
  name: string
  arguments: Record<string, unknown>
  status: 'done' | 'error'
  /** Provenance of the answer, so the transcript records what was grounded. */
  source: string | null
}

class AgentError extends Error {
  readonly code: NovaErrorCode

  constructor(code: NovaErrorCode, message: string) {
    super(message)
    this.code = code
  }
}

/** Maps a normalised provider failure onto a client-facing code. */
function fromLLMError(error: LLMError): NovaErrorCode {
  switch (error.kind) {
    case 'quota_exceeded':
      return 'quota_exceeded'
    case 'rate_limited':
      return 'rate_limited'
    case 'unauthorized':
      return 'not_configured'
    case 'bad_request':
      return 'bad_request'
    case 'provider_unavailable':
      return 'provider_unavailable'
    default:
      return 'internal_error'
  }
}

export function userFacing(code: NovaErrorCode): string {
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
    case 'tool_error':
      return 'NOVA could not complete that step. Try asking a slightly different way.'
    case 'timeout':
      return 'That took too long. Try a shorter or more specific question.'
    default:
      return 'Something went wrong on NOVA’s side. Try again.'
  }
}

function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

/** History rows are replayed as provider-neutral turns. */
function toLLMHistory(contents: ReturnType<typeof toGeminiContents>): LLMMessage[] {
  return contents.map((entry) => ({
    role: entry.role === 'model' ? ('assistant' as const) : ('user' as const),
    text: entry.parts?.[0]?.text ?? '',
  }))
}

export async function* runNovaAgent(
  env: NovaAgentEnv,
  body: NovaAgentRequestBody,
): AsyncGenerator<NovaServerEvent> {
  const startedAt = Date.now()

  try {
    /* --- Validate ---------------------------------------------------------- */
    const message = typeof body?.message === 'string' ? body.message.trim() : ''
    if (!message) throw new AgentError('bad_request', 'empty message')
    if (message.length > MAX_MESSAGE_LENGTH) throw new AgentError('bad_request', 'message too long')
    if (!env.supabaseUrl || !env.supabaseAnonKey) {
      throw new AgentError('not_configured', 'Supabase is not configured')
    }

    /* --- Provider ---------------------------------------------------------- */
    let provider
    try {
      provider = resolveProvider({
        provider: env.llmProvider,
        geminiApiKey: env.geminiApiKey,
        model: resolveNovaModel(env.model),
        nvidiaBaseUrl: env.nvidiaBaseUrl,
        nvidiaApiKey: env.nvidiaApiKey,
        nvidiaModel: env.nvidiaModel,
      })
    } catch (error) {
      if (error instanceof LLMError) {
        console.error(`[nova-agent] provider unavailable: ${error.providerDetail}`)
        throw new AgentError(
          error.kind === 'unauthorized' ? 'unauthorized' : 'provider_unavailable',
          'provider resolution failed',
        )
      }
      throw error
    }

    /*
     * Caller-scoped Supabase client: anon key plus the traveller's JWT, no
     * service role. RLS is what decides what the tools can see.
     */
    const db: SupabaseClient<Database> = createClient<Database>(env.supabaseUrl, env.supabaseAnonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: env.authorization ? { headers: { Authorization: env.authorization } } : {},
    })

    // Embeddings remain Gemini-compatible because the current pgvector index
    // was built with gemini-embedding-001. This does not couple orchestration
    // to Gemini chat and can remain in place when chat switches to NVIDIA.
    const embeddings = createGeminiEmbeddingProvider(env.geminiApiKey)

    /* --- Who is asking ----------------------------------------------------- */
    const viewerId = await resolveViewerId(db, env.authorization)

    /* --- Conversation context ---------------------------------------------- */
    const requestedConversationId = body.conversationId ?? null
    let history: LLMMessage[] = []
    let conversationId: string | null = null

    if (requestedConversationId && viewerId) {
      const lookup = await loadConversationHistory(db, requestedConversationId)
      if (!lookup.ok) {
        throw new AgentError('conversation_not_found', 'conversation unavailable')
      }
      history = toLLMHistory(lookup.contents)
      conversationId = requestedConversationId
    } else if (requestedConversationId && !viewerId) {
      console.warn('[nova-agent] ignoring conversationId from an unauthenticated caller')
    }

    /* --- Orchestration loop ------------------------------------------------ */
    const toolCycle: { turn: number; call: LLMToolCall; result: LLMToolResult }[] = []
    const recordedCalls: RecordedCall[] = []
    const recordedResults: ToolResult[] = []
    let answer = ''
    let toolsAttempted = 0
    let toolsSucceeded = 0

    for (let turn = 0; turn < MAX_MODEL_TURNS; turn += 1) {
      if (Date.now() - startedAt > AGENT_TIMEOUT_MS) {
        throw new AgentError('timeout', 'agent budget exceeded')
      }

      yield { type: 'status', state: 'thinking' }

      let response
      try {
        response = await provider.generateWithTools({
          system: NOVA_SYSTEM_INSTRUCTION,
          history,
          message,
          tools: toolDefinitions(),
          toolCycle,
        })
      } catch (error) {
        if (error instanceof LLMError) {
          console.error(`[nova-agent] ${provider.id} failed: ${error.providerDetail}`)
          throw new AgentError(fromLLMError(error), 'provider call failed')
        }
        console.error(`[nova-agent] unexpected provider failure: ${describe(error)}`)
        throw new AgentError('provider_unavailable', 'provider call failed')
      }

      if (!response.toolCalls.length) {
        answer = response.text.trim()
        if (!answer) throw new AgentError('provider_error', 'model returned no text')
        break
      }

      for (const call of response.toolCalls) {
        const tool = findTool(call.name)
        toolsAttempted += 1

        /*
         * The model produced arguments that were not valid JSON. Hand the
         * failure back as a tool result rather than aborting: the model gets
         * one more turn to emit them correctly, which is cheaper for the
         * traveller than losing the answer.
         */
        if (call.argumentsError) {
          console.warn(`[nova-agent] ${call.name}: ${call.argumentsError}`)
          const result: ToolResult = { ok: false, error: call.argumentsError }
          recordedCalls.push({
            callId: call.id,
            name: call.name,
            arguments: {},
            status: 'error',
            source: null,
          })
          toolCycle.push({
            turn,
            call,
            result: {
              id: call.id,
              name: call.name,
              response: result as unknown as Record<string, unknown>,
            },
          })
          continue
        }

        if (!tool) {
          // The model can only be offered registered tools, so this is a
          // defensive branch rather than an expected one.
          const result: ToolResult = { ok: false, error: `Unknown tool "${call.name}".` }
          recordedCalls.push({
            callId: call.id,
            name: call.name,
            arguments: call.arguments,
            status: 'error',
            source: null,
          })
          toolCycle.push({
            turn,
            call,
            result: { id: call.id, name: call.name, response: result as unknown as Record<string, unknown> },
          })
          continue
        }

        yield {
          type: 'tool',
          name: call.name,
          status: 'running',
          summary: tool.describe(call.arguments),
        }

        let result: ToolResult
        try {
          result = await tool.execute(call.arguments, { db, embeddings })
        } catch (error) {
          console.error(`[nova-agent] tool ${call.name} threw: ${describe(error)}`)
          result = { ok: false, error: 'That step could not be completed.' }
        }

        const resultCount = result.ok
          ? (Array.isArray((result.data as { results?: unknown[] }).results)
              ? ((result.data as { results: unknown[] }).results.length)
              : undefined)
          : 0

        if (result.ok) toolsSucceeded += 1

        yield {
          type: 'tool',
          name: call.name,
          status: result.ok ? 'done' : 'error',
          summary: result.ok
            ? resultCount !== undefined
              ? `Found ${resultCount} place${resultCount === 1 ? '' : 's'}`
              : 'Done'
            : 'That step could not be completed',
          ...(resultCount !== undefined ? { resultCount } : {}),
        }

        recordedCalls.push({
          callId: call.id,
          name: call.name,
          arguments: call.arguments,
          status: result.ok ? 'done' : 'error',
          source: result.ok ? result.source : null,
        })
        recordedResults.push(result)

        toolCycle.push({
          turn,
          call,
          result: {
            id: call.id,
            name: call.name,
            response: result as unknown as Record<string, unknown>,
          },
        })
      }
    }

    /*
     * Grounding enforcement. If the model reached for tools and every one
     * failed, an answer it produces anyway is ungrounded by construction. A
     * prompt asks for honesty; this enforces it.
     */
    if (toolsAttempted > 0 && toolsSucceeded === 0) {
      console.error('[nova-agent] every tool call failed; suppressing ungrounded answer')
      const onlySearchFailed = recordedCalls.length > 0 && recordedCalls.every(
        (call) => call.name === 'search_places' && call.status === 'error',
      )
      throw new AgentError(onlySearchFailed ? 'retrieval_error' : 'tool_error', 'all tool calls failed')
    }

    if (!answer) throw new AgentError('provider_error', 'no answer after the turn budget')

    yield { type: 'text', content: answer }

    /* --- Persistence -------------------------------------------------------- */
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

interface PersistInput {
  viewerId: string | null
  conversationId: string | null
  tripId: string | null
  userMessage: string
  assistantMessage: string
  calls: RecordedCall[]
  results: ToolResult[]
}

/**
 * Writes the exchange to nova_conversations / nova_messages under the caller's
 * own JWT, so the owner-only policies apply.
 *
 * Anonymous callers are not an error: they get no history because
 * nova_conversations.user_id is NOT NULL and RLS has nothing to match.
 * Persistence never fails the request — losing a transcript row must not cost
 * the traveller the answer they already have.
 */
async function persistExchange(
  db: SupabaseClient<Database>,
  input: PersistInput,
): Promise<{ conversationId: string | null; persisted: boolean }> {
  const userId = input.viewerId
  if (!userId) return { conversationId: null, persisted: false }

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
      { conversation_id: conversationId, role: 'user', content: input.userMessage },
      {
        conversation_id: conversationId,
        role: 'nova',
        content: input.assistantMessage,
        tool_calls: input.calls.length ? input.calls : null,
        // Trimmed to provenance plus slugs: a transcript row should not carry
        // a copy of the catalogue.
        tool_results: input.results.length
          ? input.results.map((result) =>
              result.ok
                ? {
                    source: result.source,
                    note: result.note ?? null,
                    slugs: extractSlugs(result.data),
                  }
                : { error: result.error },
            )
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

/** Pulls whatever slugs a tool result mentions, for the audit trail. */
function extractSlugs(data: Record<string, unknown>): string[] {
  const out: string[] = []
  const visit = (value: unknown): void => {
    if (Array.isArray(value)) {
      for (const item of value) visit(item)
      return
    }
    if (value && typeof value === 'object') {
      const record = value as Record<string, unknown>
      if (typeof record.slug === 'string') out.push(record.slug)
      for (const nested of Object.values(record)) visit(nested)
    }
  }
  visit(data)
  return [...new Set(out)]
}
