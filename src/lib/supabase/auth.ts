import type { Session } from '@supabase/supabase-js'

import { supabase } from './client'
import type { ProfileRow } from '@/types/database'

export interface AuthResult<T = null> {
  data: T | null
  error: string | null
}

const NOT_CONFIGURED =
  'Sign-in is not connected yet. Add your Supabase keys to .env.local to enable Google sign-in.'

/**
 * Google is the ONLY identity provider.
 *
 * There is no email/password path anywhere in this codebase — no sign-up form,
 * no password reset, no credential we store. Supabase owns the OAuth
 * handshake; the client only ever holds the resulting session.
 *
 * The provider is enabled outside the code, in
 * Supabase Dashboard -> Authentication -> Providers -> Google, with
 * `https://<project-ref>.supabase.co/auth/v1/callback` registered in the Google
 * Cloud console. Until that is done this returns the provider's own error
 * rather than pretending to sign anyone in.
 */
export async function signInWithGoogle(redirectTo?: string): Promise<AuthResult<{ url: string }>> {
  if (!supabase) return { data: null, error: NOT_CONFIGURED }

  try {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: redirectTo ?? `${window.location.origin}/auth/callback`,
        // Ask for a refresh token so a returning traveller is not bounced to
        // the consent screen on every visit.
        queryParams: { access_type: 'offline', prompt: 'consent' },
      },
    })
    if (error) return { data: null, error: error.message }
    return { data: data.url ? { url: data.url } : null, error: null }
  } catch (error) {
    return { data: null, error: error instanceof Error ? error.message : 'Sign-in failed.' }
  }
}

export async function getSession(): Promise<Session | null> {
  if (!supabase) return null
  const { data } = await supabase.auth.getSession()
  return data.session ?? null
}

export async function signOut(): Promise<AuthResult> {
  if (!supabase) return { data: null, error: NOT_CONFIGURED }
  const { error } = await supabase.auth.signOut()
  return { data: null, error: error?.message ?? null }
}

export async function fetchProfile(userId: string): Promise<ProfileRow | null> {
  if (!supabase) return null
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle()
  if (error) return null
  return data
}
