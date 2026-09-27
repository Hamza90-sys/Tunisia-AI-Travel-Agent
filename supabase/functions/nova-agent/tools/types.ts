/**
 * Tool contract.
 *
 * Every tool declares a JSON Schema, validates its own arguments, and returns a
 * result that states where the data came from. The model never picks what runs
 * and never sees a credential or an RPC name.
 */
import type { SupabaseClient } from '@supabase/supabase-js'

import type { EmbeddingProvider } from '../embeddings.ts'
import type { LLMToolDefinition } from '../llm/types.ts'
import type { Database } from '../../../../src/types/database.ts'

/**
 * Where a tool's answer came from. This is the KNOWN / UNKNOWN / LIVE
 * distinction made machine-readable.
 *
 * There is deliberately no `'live'` member. Nothing in this system queries a
 * live provider — no availability, no current prices, no opening hours — so
 * there is no way to label something live, by construction rather than by
 * discipline.
 */
export type ToolDataSource =
  /** Retrieved from the Supabase catalogue. */
  | 'catalogue'
  /** Derived arithmetically from catalogue data. */
  | 'computed'

export type ToolResult =
  | { ok: true; source: ToolDataSource; data: Record<string, unknown>; note?: string }
  | { ok: false; error: string }

/** What a tool is given at execution time. */
export interface ToolContext {
  /** Caller-scoped: anon key plus the traveller's JWT. RLS applies. */
  db: SupabaseClient<Database>
  /** Used only for query embedding against the existing pgvector index. */
  embeddings: EmbeddingProvider
}

export interface NovaTool {
  definition: LLMToolDefinition
  execute(args: Record<string, unknown>, context: ToolContext): Promise<ToolResult>
  /** One line for the UI while it runs. Never exposes arguments verbatim. */
  describe(args: Record<string, unknown>): string
}

/** Helper for the common "reject bad arguments" path. */
export function invalid(message: string): ToolResult {
  return { ok: false, error: message }
}
