/**
 * NVIDIA NIM provider (OpenAI-compatible chat completions).
 *
 * Talks to a NIM container serving e.g. meta/llama-3.1-8b-instruct:
 *
 *   POST {baseUrl}/chat/completions
 *   { model, messages, tools, tool_choice }
 *
 * The orchestrator owns the tool-calling LOOP; this file owns the WIRE FORMAT.
 * Its whole job is translating `LLMRequest` into OpenAI messages and the
 * response back into `LLMResponse`, so nothing above it knows what a
 * `tool_call_id` is.
 *
 * A local NIM usually needs no credential, so `apiKey` is optional and the
 * Authorization header is only sent when one is configured. Nothing here is
 * ever read by the browser.
 */
import { LLMError } from './types.ts'
import type {
  LLMErrorKind,
  LLMProvider,
  LLMRequest,
  LLMResponse,
  LLMToolCall,
  LLMToolDefinition,
} from './types.ts'

export interface NvidiaProviderOptions {
  /** OpenAI-compatible base, including /v1. e.g. http://localhost:8000/v1 */
  baseUrl: string
  /** Optional: a local NIM typically requires no key. */
  apiKey?: string | undefined
  model: string
  /** Per-request wall clock. A cold NIM can be slow on the first token. */
  timeoutMs?: number
}

/** OpenAI chat message shapes we produce. */
type OpenAIMessage =
  | { role: 'system' | 'user' | 'assistant'; content: string }
  | {
      role: 'assistant'
      content: string | null
      tool_calls: {
        id: string
        type: 'function'
        function: { name: string; arguments: string }
      }[]
    }
  | { role: 'tool'; tool_call_id: string; name?: string; content: string }

/** JSON Schema passes through untouched — this dialect is already OpenAI's. */
function toOpenAITool(tool: LLMToolDefinition) {
  return {
    type: 'function' as const,
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters,
    },
  }
}

/**
 * Every tool message must carry a `tool_call_id` that matches one on the
 * preceding assistant message. When a server omits ids (some vLLM builds do),
 * we mint a stable one so the round-trip still correlates.
 */
function callId(call: LLMToolCall, turn: number, index: number): string {
  return call.id ?? `call_${turn}_${index}`
}

function buildMessages(request: LLMRequest): OpenAIMessage[] {
  const messages: OpenAIMessage[] = [{ role: 'system', content: request.system }]

  for (const turn of request.history) {
    messages.push({ role: turn.role, content: turn.text })
  }

  messages.push({ role: 'user', content: request.message })

  /*
   * Replay the tool traffic, grouped by the assistant turn it came from:
   *   assistant{tool_calls:[a,b]} -> tool(a) -> tool(b) -> assistant{...} -> ...
   */
  const byTurn = new Map<number, typeof request.toolCycle>()
  for (const entry of request.toolCycle) {
    const bucket = byTurn.get(entry.turn) ?? []
    bucket.push(entry)
    byTurn.set(entry.turn, bucket)
  }

  for (const turn of [...byTurn.keys()].sort((a, b) => a - b)) {
    const entries = byTurn.get(turn) ?? []

    messages.push({
      role: 'assistant',
      content: null,
      tool_calls: entries.map((entry, index) => ({
        id: callId(entry.call, turn, index),
        type: 'function' as const,
        function: {
          name: entry.call.name,
          // Arguments go back as the JSON string the API expects, not an object.
          arguments: JSON.stringify(entry.call.arguments ?? {}),
        },
      })),
    })

    for (const [index, entry] of entries.entries()) {
      messages.push({
        role: 'tool',
        tool_call_id: callId(entry.call, turn, index),
        name: entry.result.name,
        content: JSON.stringify(entry.result.response ?? {}),
      })
    }
  }

  return messages
}

/** Maps transport and HTTP failures onto the normalised categories. */
export function classifyNimStatus(status: number): LLMErrorKind {
  if (status === 400 || status === 422) return 'bad_request'
  if (status === 401 || status === 403) return 'unauthorized'
  if (status === 429) return 'rate_limited'
  if (status >= 500) return 'provider_unavailable'
  return 'internal_error'
}

interface ChatCompletionResponse {
  choices?: {
    message?: {
      content?: string | null
      tool_calls?: {
        id?: string
        function?: { name?: string; arguments?: string }
      }[]
    }
  }[]
  usage?: { prompt_tokens?: number; completion_tokens?: number }
  model?: string
}

/**
 * Parses `tool_calls` off a completion.
 *
 * `function.arguments` is a model-generated JSON string, so a parse failure is
 * an expected outcome rather than an exception: it is recorded on the call and
 * handled one level up.
 */
export function parseToolCalls(
  raw: NonNullable<NonNullable<ChatCompletionResponse['choices']>[number]['message']>['tool_calls'],
): LLMToolCall[] {
  if (!Array.isArray(raw)) return []

  return raw.map((entry, index) => {
    const name = entry.function?.name ?? ''
    const id = entry.id ?? `call_${index}`
    const source = entry.function?.arguments

    if (source === undefined || source === null || source === '') {
      return { id, name, arguments: {} }
    }

    try {
      const parsed = JSON.parse(source) as unknown
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        return {
          id,
          name,
          arguments: {},
          argumentsError: 'Tool arguments must be a JSON object.',
        }
      }
      return { id, name, arguments: parsed as Record<string, unknown> }
    } catch {
      return {
        id,
        name,
        arguments: {},
        argumentsError: 'Tool arguments were not valid JSON. Send them again as a JSON object.',
      }
    }
  })
}

export function createNvidiaProvider(options: NvidiaProviderOptions): LLMProvider {
  // Tolerate a trailing slash so NIM_BASE_URL=".../v1/" still works.
  const base = options.baseUrl.replace(/\/+$/, '')
  const endpoint = `${base}/chat/completions`
  const timeoutMs = options.timeoutMs ?? 30_000

  return {
    id: 'nvidia',
    model: options.model,

    async generateWithTools(request: LLMRequest): Promise<LLMResponse> {
      const messages = buildMessages(request)

      const payload = {
        model: options.model,
        messages,
        ...(request.tools.length
          ? { tools: request.tools.map(toOpenAITool), tool_choice: 'auto' as const }
          : {}),
        ...(request.maxOutputTokens ? { max_tokens: request.maxOutputTokens } : {}),
        temperature: 0.4,
        stream: false,
      }

      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      // Only sent when configured. A local NIM needs no credential, and an
      // empty Bearer header makes some gateways reject the request outright.
      if (options.apiKey) headers.Authorization = `Bearer ${options.apiKey}`

      console.log(
        `[nova-agent] nim request model=${options.model} messages=${messages.length} ` +
          `tools=${request.tools.length} toolResults=${request.toolCycle.length}`,
      )

      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), timeoutMs)

      let response: Response
      try {
        response = await fetch(endpoint, {
          method: 'POST',
          headers,
          body: JSON.stringify(payload),
          signal: controller.signal,
        })
      } catch (error) {
        const detail = error instanceof Error ? error.message : String(error)
        const aborted = /abort/i.test(detail)
        throw new LLMError(
          'provider_unavailable',
          aborted
            ? `NIM did not respond within ${timeoutMs}ms at ${endpoint}`
            : `NIM unreachable at ${endpoint}: ${detail}`,
        )
      } finally {
        clearTimeout(timer)
      }

      if (!response.ok) {
        // Body is provider detail: logged server-side, never returned to a browser.
        const detail = await response.text().catch(() => '')
        throw new LLMError(
          classifyNimStatus(response.status),
          `NIM ${response.status}: ${detail.slice(0, 500)}`,
        )
      }

      let body: ChatCompletionResponse
      try {
        body = (await response.json()) as ChatCompletionResponse
      } catch {
        throw new LLMError('internal_error', 'NIM returned a body that was not JSON.')
      }

      const message = body.choices?.[0]?.message
      if (!message) {
        throw new LLMError('internal_error', 'NIM returned no choices.')
      }

      const toolCalls = parseToolCalls(message.tool_calls)

      if (toolCalls.length) {
        console.log(
          `[nova-agent] nim requested tools: ${toolCalls.map((call) => call.name).join(', ')}`,
        )
      }

      return {
        text: (message.content ?? '').trim(),
        toolCalls,
        usage: {
          inputTokens: body.usage?.prompt_tokens ?? null,
          outputTokens: body.usage?.completion_tokens ?? null,
        },
        model: body.model ?? options.model,
      }
    },
  }
}
