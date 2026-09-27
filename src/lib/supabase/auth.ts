import type { Session, User } from '@supabase/supabase-js'

import { supabase } from './client'
import type { ProfileRow } from '@/types/database'

export interface AuthResult<T = null> {
  data: T | null
  error: string | null
}

const NOT_CONFIGURED =
  'Authentication is not connected yet. Add your Supabase keys to .env.local to enable sign-in.'

function toMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  return 'Something went wrong. Please try again.'
}

export async function getSession(): Promise<Session | null> {
  if (!supabase) return null
  const { data } = await supabase.auth.getSession()
  return data.session ?? null
}

export async function signInWithEmail(
  email: string,
  password: string,
): Promise<AuthResult<Session>> {
  if (!supabase) return { data: null, error: NOT_CONFIGURED }
  try {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) return { data: null, error: error.message }
    return { data: data.session, error: null }
  } catch (error) {
    return { data: null, error: toMessage(error) }
  }
}

export async function signUpWithEmail(
  email: string,
  password: string,
  fullName: string,
): Promise<AuthResult<User>> {
  if (!supabase) return { data: null, error: NOT_CONFIGURED }
  try {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      // Read by the `handle_new_user` trigger to seed `public.profiles`.
      options: { data: { full_name: fullName } },
    })
    if (error) return { data: null, error: error.message }
    return { data: data.user, error: null }
  } catch (error) {
    return { data: null, error: toMessage(error) }
  }
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
