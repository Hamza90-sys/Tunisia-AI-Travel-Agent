/**
 * NOVA agent configuration.
 *
 * Single source of truth for the conversational model. The embedding model
 * lives in `src/lib/rag/model.ts` and is shared with the offline pipeline —
 * there is exactly one provider (Google Gemini) and one of each model id.
 */

/**
 * Conversational model.
 *
 * gemini-3.8-flash is the current stable Flash model and is built for
 * long-horizon agentic work, which is what a tool-calling loop is.
 */
export const NOVA_MODEL_DEFAULT = 'gemini-3.8-flash'

/**
 * Default model for the NVIDIA NIM provider.
 *
 * Kept separate from NOVA_MODEL_DEFAULT because the two namespaces are not
 * interchangeable — sending a Gemini model id to NIM is an instant 404, which
 * is exactly what happened when both providers shared one default.
 * Overridable with NIM_MODEL.
 */
export const NIM_MODEL_DEFAULT = 'meta/llama-3.1-8b-instruct'

/**
 * Resolved conversational model.
 *
 * Overridable with the server-side `NOVA_MODEL` variable (no VITE_ prefix, so
 * it never reaches the browser). This exists because the free tier caps
 * gemini-3.8-flash at 20 requests/day — roughly ten NOVA messages — which is
 * not enough to demo. Switching to a higher-quota model is then a config
 * change, not a code change.
 */
export function resolveNovaModel(override: string | undefined): string {
  const trimmed = override?.trim()
  return trimmed ? trimmed : NOVA_MODEL_DEFAULT
}

/**
 * Maximum model turns per request.
 *
 * One turn is "ask Gemini, maybe run tools". Four is ample for a single
 * retrieval round-trip plus an answer, and it bounds both cost and latency if
 * the model ever loops.
 */
export const MAX_MODEL_TURNS = 4

/** Hard ceiling on a traveller's message, in characters. */
export const MAX_MESSAGE_LENGTH = 2000

/** Wall-clock budget for one agent run. */
export const AGENT_TIMEOUT_MS = 45_000

/** Bounds for the `search_places` tool's `limit` argument. */
export const SEARCH_LIMIT_DEFAULT = 6
export const SEARCH_LIMIT_MAX = 10

/**
 * Retries for a single model call, including the first attempt.
 *
 * gemini-3.8-flash returns a transient 503 under load often enough that a
 * mid-loop failure would otherwise cost the traveller their whole answer.
 */
export const MODEL_RETRY_ATTEMPTS = 3

/** First backoff step; doubles per attempt. */
export const MODEL_RETRY_BASE_MS = 700

/**
 * Most recent persisted messages replayed to the model as context.
 *
 * Twelve is six exchanges: enough for the referential follow-ups travellers
 * actually make ("what about nearby?", "is that walkable?") without dragging a
 * whole session into every request. History is replayed as plain turns, so
 * this costs input tokens only — and no extra model call, because nothing is
 * summarised.
 */
export const HISTORY_MESSAGE_LIMIT = 12

/**
 * Character ceiling for replayed history.
 *
 * A second, independent bound: twelve short turns and twelve long ones cost
 * very different amounts, and NOVA's answers can run to several paragraphs.
 * The oldest turns are dropped until the window fits.
 */
export const HISTORY_CHAR_BUDGET = 8000
