/**
 * NOVA — the AI travel companion.
 *
 * Step 1 ships the visual identity and the interaction surface only.
 * No model calls, no simulated answers: `NovaMessage` already carries the
 * roles the real agent will use so Step 2 can plug straight in.
 */
import type { LucideIcon } from 'lucide-react'

/** Visual states of the NOVA orb. */
export const NOVA_STATES = ['idle', 'thinking', 'searching', 'planning', 'success'] as const
export type NovaState = (typeof NOVA_STATES)[number]

/** `system` is used for honest UI notices — never to impersonate the model. */
export type NovaMessageRole = 'user' | 'nova' | 'system'

export interface NovaMessage {
  id: string
  role: NovaMessageRole
  content: string
  createdAt: string
  /** Set on `nova` messages once real tool calling lands. */
  toolCalls?: NovaToolCall[]
}

export type NovaToolCallStatus = 'pending' | 'running' | 'done' | 'error'

/**
 * One tool invocation in a NOVA turn (search_places, generate_itinerary, …).
 *
 * Mirrors the Gemini Interactions API round-trip: the model emits a
 * `function_call` step, we execute it, and reply with a `function_result`
 * carrying the same `call_id`. Persisted to `nova_messages.tool_calls` /
 * `nova_messages.tool_results`.
 */
export interface NovaToolCall {
  /** Provider-issued correlation id — Gemini's `call_id`. */
  callId: string
  name: string
  arguments: Record<string, unknown>
  status: NovaToolCallStatus
  /** Whatever the tool returned; sent back to the model as `function_result`. */
  result?: unknown
  /** True when `result` describes a failure rather than a value. */
  isError?: boolean
}

export interface NovaSuggestion {
  id: string
  label: string
  /** Which capability the suggestion will eventually invoke. */
  intent: 'budget' | 'add-place' | 'find-food' | 'remove-category' | 'reschedule'
  icon: LucideIcon
}

/** One line in the NOVA planning panel. */
export interface NovaPlanningStep {
  id: string
  label: string
  /** Optional detail revealed once the step completes. */
  detail?: string
}
