/**
 * Conversation history for multi-turn NOVA.
 *
 * History is read from the existing `nova_messages` table under the caller's
 * own JWT — never from the request body. A browser cannot hand the agent a
 * transcript and have it believed, and RLS is what stops one traveller loading
 * another's conversation. There is no second history store.
 */
import type { Content } from '@google/genai'
import type { SupabaseClient } from '@supabase/supabase-js'

import { HISTORY_CHAR_BUDGET, HISTORY_MESSAGE_LIMIT } from './config.ts'
import type { Database } from '../../../src/types/database.ts'

/** A persisted transcript row, reduced to what the model needs. */
export interface HistoryRow {
  role: string
  content: string
}

/** Postgres rejects a malformed uuid with an error; screen it first. */
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function isConversationId(value: string): boolean {
  return UUID_PATTERN.test(value)
}

/**
 * Narrows persisted rows to the window that will be replayed.
 *
 * Pure, so the bounding rules can be tested without a database.
 *
 *   1. `system` rows are dropped. They are our own UI notices ("NOVA is not
 *      connected…") — telling the model it once failed is noise at best and
 *      misleading at worst.
 *   2. The most recent `HISTORY_MESSAGE_LIMIT` rows are kept.
 *   3. Oldest rows are then dropped until the window fits `HISTORY_CHAR_BUDGET`.
 *
 * Input is chronological (oldest first); output is too.
 */
export function selectHistoryWindow(rows: HistoryRow[]): HistoryRow[] {
  const usable = rows.filter(
    (row) => (row.role === 'user' || row.role === 'nova') && row.content.trim().length > 0,
  )

  const window = usable.slice(-HISTORY_MESSAGE_LIMIT)

  let budget = window.reduce((total, row) => total + row.content.length, 0)
  let start = 0
  while (start < window.length && budget > HISTORY_CHAR_BUDGET) {
    budget -= window[start].content.length
    start += 1
  }

  return window.slice(start)
}

/**
 * Maps persisted rows to Gemini turns.
 *
 * `nova` becomes `model`, which is the role the SDK expects for an assistant
 * turn. Tool calls and results are deliberately NOT replayed: they live in
 * `tool_calls`/`tool_results` for audit, and folding them into ordinary text
 * would teach the model that its own search output is something a traveller
 * said. Each turn re-runs whatever retrieval it needs.
 */
export function toGeminiContents(rows: HistoryRow[]): Content[] {
  return selectHistoryWindow(rows).map((row) => ({
    role: row.role === 'nova' ? 'model' : 'user',
    parts: [{ text: row.content }],
  }))
}

export type HistoryLookup =
  | { ok: true; contents: Content[] }
  /** The id is unusable: malformed, missing, or not this caller's. */
  | { ok: false }

/**
 * Loads a conversation's recent turns, if the caller owns it.
 *
 * Ownership is not checked in application code — the select runs under the
 * caller's JWT and `nova_conversations` is owner-scoped, so a conversation
 * belonging to someone else simply returns no row. A missing conversation and
 * a forbidden one are therefore indistinguishable from here, which is exactly
 * what we want to tell the client.
 */
export async function loadConversationHistory(
  db: SupabaseClient<Database>,
  conversationId: string,
): Promise<HistoryLookup> {
  if (!isConversationId(conversationId)) return { ok: false }

  const { data: conversation, error: lookupError } = await db
    .from('nova_conversations')
    .select('id')
    .eq('id', conversationId)
    .maybeSingle()

  if (lookupError || !conversation) return { ok: false }

  const { data, error } = await db
    .from('nova_messages')
    .select('role, content, created_at')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: false })
    .limit(HISTORY_MESSAGE_LIMIT * 2)

  if (error) {
    // The conversation exists and is ours; losing its history should not cost
    // the traveller their turn, so continue without context.
    console.error(`[nova-agent] history read failed: ${error.message}`)
    return { ok: true, contents: [] }
  }

  // Fetched newest-first so the limit keeps recent turns; replay chronologically.
  const chronological = [...(data ?? [])].reverse()
  return { ok: true, contents: toGeminiContents(chronological) }
}
