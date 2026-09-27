import { createClient, type SupabaseClient } from '@supabase/supabase-js'

import type { Database } from '@/types'

/**
 * Supabase client.
 *
 * The app is designed to boot with or without credentials:
 *   • credentials present -> real auth + Postgres reads
 *   • credentials absent  -> `isSupabaseConfigured` is false and the data layer
 *     falls back to the local catalogue in `src/data`, so the UI (and a
 *     hackathon demo on a flaky network) never hard-crashes.
 *
 * Nothing in the UI imports `createClient` directly — always go through here.
 */
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim()
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim()

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey)

export type TuniTripClient = SupabaseClient<Database>

export const supabase: TuniTripClient | null =
  supabaseUrl && supabaseAnonKey
    ? createClient<Database>(supabaseUrl, supabaseAnonKey, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
        },
        global: {
          headers: { 'x-application-name': 'tunitrip-ai' },
        },
      })
    : null

/** Use inside code paths that genuinely cannot continue without Supabase. */
export function requireSupabase(): TuniTripClient {
  if (!supabase) {
    throw new Error(
      'Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to .env.local.',
    )
  }
  return supabase
}

/** Storage bucket that will hold curated Tunisia photography. */
export const MEDIA_BUCKET = 'place-media'

/**
 * Resolves a Storage object path to a public URL.
 * Returns null when Supabase is not configured so callers can fall back to the
 * procedural placeholder artwork.
 */
export function getMediaPublicUrl(path: string | null | undefined): string | null {
  if (!path || !supabase) return null
  const { data } = supabase.storage.from(MEDIA_BUCKET).getPublicUrl(path)
  return data.publicUrl ?? null
}
