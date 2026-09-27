/**
 * NOVA wire protocol — shared by the browser client, the Vite dev proxy and the
 * deployed edge function.
 *
 * Lives under `src/` because the edge function already imports from here (the
 * RAG helpers and the Database types), so dependencies point one way only.
 * Type-only, so nothing from this file exists at runtime in either place.
 */

/** POST body the client sends to the agent endpoint. */
export interface NovaAgentRequestBody {
  message: string
  /** Continues an existing conversation when the traveller is signed in. */
  conversationId?: string | null
  /** Optional trip the conversation is about. Unused until trip tools land. */
  tripId?: string | null
}

/** Stable error codes the UI can branch on without parsing prose. */
export type NovaErrorCode =
  | 'not_configured'
  | 'bad_request'
  | 'unauthorized'
  | 'provider_error'
  | 'provider_unavailable'
  | 'quota_exceeded'
  | 'rate_limited'
  | 'conversation_not_found'
  | 'retrieval_error'
  | 'tool_error'
  | 'timeout'
  | 'internal_error'

/**
 * Server-sent events, one JSON object per SSE `data:` line.
 *
 * The stream is a narration of the agent's real progress — `searching` is
 * emitted when `search_places` actually starts executing, never speculatively.
 */
export type NovaServerEvent =
  /** The model is composing. Drives the `thinking` orb state. */
  | { type: 'status'; state: 'thinking' }
  /** A tool started, finished, or failed. Drives the `searching` orb state. */
  | {
      type: 'tool'
      name: string
      status: 'running' | 'done' | 'error'
      /** Short human-readable summary, safe to show. Never raw SQL or RPC detail. */
      summary: string
      /** Number of rows returned. Present on `done`. */
      resultCount?: number
    }
  /** The assistant's answer. Delivered once, when the final turn completes. */
  | { type: 'text'; content: string }
  /** Terminal success. */
  | {
      type: 'done'
      conversationId: string | null
      /** True when the exchange was written to nova_messages. */
      persisted: boolean
    }
  /** Terminal failure. `message` is user-facing; never a stack trace. */
  | { type: 'error'; code: NovaErrorCode; message: string }
