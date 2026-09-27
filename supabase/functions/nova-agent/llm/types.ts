/**
 * LLM provider boundary.
 *
 * The orchestrator talks to these types and nothing else — no Gemini types, no
 * OpenAI types, no SDK imports. Swapping Gemini for an NVIDIA-hosted model is
 * then a new file implementing `LLMProvider`, not a rewrite of the agent.
 *
 * Deliberately small. This is a seam, not a framework.
 */

/** A turn in the conversation, provider-neutral. */
export interface LLMMessage {
  role: 'user' | 'assistant'
  text: string
}

/** A tool the model may call, described in plain JSON Schema. */
export interface LLMToolDefinition {
  name: string
  description: string
  /** JSON Schema object. Providers translate to their own dialect. */
  parameters: Record<string, unknown>
}

/** A tool invocation the model asked for. */
export interface LLMToolCall {
  /** Provider correlation id, when the provider issues one. */
  id: string | null
  /** Gemini's signed reasoning marker, required when replaying tool calls. */
  thoughtSignature?: string
  name: string
  arguments: Record<string, unknown>
  /**
   * Set when the provider could not parse the model's arguments.
   *
   * OpenAI-compatible servers hand back `function.arguments` as a JSON *string*
   * the model generated token by token, so it can be malformed. Rather than
   * throw — which would cost the traveller the whole turn — the provider
   * reports the failure here and the orchestrator feeds it back as a tool
   * error, giving the model a chance to correct itself.
   */
  argumentsError?: string
}

/** A tool result being handed back to the model. */
export interface LLMToolResult {
  id: string | null
  name: string
  /** Serialisable payload. Providers encode this their own way. */
  response: Record<string, unknown>
}

/**
 * One exchange with the model.
 *
 * `history` and `message` stay separate from `toolCycle` so a provider can
 * encode prior turns and in-flight tool traffic differently — Gemini threads
 * tool calls into `contents`, an OpenAI-compatible API uses `tool` messages.
 */
export interface LLMRequest {
  system: string
  history: LLMMessage[]
  message: string
  tools: LLMToolDefinition[]
  /**
   * Tool calls already made, with their results, oldest first. Empty on the
   * first pass.
   *
   * `turn` groups calls that came back in the SAME assistant response. It
   * matters for OpenAI-compatible providers: the wire format is one assistant
   * message carrying that turn's `tool_calls`, followed by one `tool` message
   * per call. Flattening two turns into one assistant message misrepresents
   * the history and some servers reject it.
   */
  toolCycle: { turn: number; call: LLMToolCall; result: LLMToolResult }[]
  maxOutputTokens?: number
}

export interface LLMUsage {
  inputTokens: number | null
  outputTokens: number | null
}

export interface LLMResponse {
  /** Final text, when the model answered rather than calling a tool. */
  text: string
  /** Tool calls requested. When non-empty, `text` is usually empty. */
  toolCalls: LLMToolCall[]
  usage: LLMUsage
  /** Which concrete model served this, for logs. */
  model: string
}

/** Normalised failure categories, independent of provider wire formats. */
export type LLMErrorKind =
  | 'bad_request'
  | 'unauthorized'
  | 'rate_limited'
  | 'quota_exceeded'
  | 'provider_unavailable'
  | 'internal_error'

/**
 * A provider failure the orchestrator can reason about.
 *
 * Carries the raw provider text for server-side logging only — it must never
 * be forwarded to a browser.
 */
export class LLMError extends Error {
  readonly kind: LLMErrorKind
  readonly providerDetail: string

  constructor(kind: LLMErrorKind, providerDetail: string) {
    super(`${kind}: ${providerDetail}`)
    this.kind = kind
    this.providerDetail = providerDetail
  }
}

/**
 * What every provider must offer.
 *
 * `stream` is optional and absent today: neither the Gemini path nor the
 * planned NVIDIA path streams tokens yet, and the orchestrator must not
 * pretend otherwise. When a provider gains it, the orchestrator can prefer it
 * without any interface change.
 */
export interface LLMProvider {
  readonly id: string
  readonly model: string
  generateWithTools(request: LLMRequest): Promise<LLMResponse>
  stream?(request: LLMRequest): AsyncGenerator<string>
}
