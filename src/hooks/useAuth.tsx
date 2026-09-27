import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import type { Session, User } from '@supabase/supabase-js'

import {
  fetchProfile,
  isSupabaseConfigured,
  signInWithGoogle as startGoogleSignIn,
  signOut as signOutRequest,
  supabase,
} from '@/lib/supabase'
import type { ProfileRow } from '@/types/database'

export type AuthStatus = 'loading' | 'authenticated' | 'anonymous'

interface AuthContextValue {
  session: Session | null
  user: User | null
  profile: ProfileRow | null
  status: AuthStatus
  /** False until Supabase keys are present — the UI says so rather than lying. */
  isConfigured: boolean
  displayName: string
  /** Google profile picture, when the provider supplied one. */
  avatarUrl: string | null
  /** True while the OAuth redirect is being started. */
  isSigningIn: boolean
  /**
   * Starts the Google redirect. Resolves with an error message when the
   * handshake could not be started; on success the browser navigates away.
   */
  signInWithGoogle: (redirectTo?: string) => Promise<string | null>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

/** Google puts the picture under one of these keys depending on the flow. */
function readAvatar(user: User | null, profile: ProfileRow | null): string | null {
  const meta = user?.user_metadata as Record<string, unknown> | undefined
  const candidate = meta?.avatar_url ?? meta?.picture
  if (typeof candidate === 'string' && candidate.length > 0) return candidate
  return profile?.avatar_url ?? null
}

function readFullName(user: User | null, profile: ProfileRow | null): string | null {
  const stored = profile?.full_name?.trim()
  if (stored) return stored
  const meta = user?.user_metadata as Record<string, unknown> | undefined
  const candidate = meta?.full_name ?? meta?.name
  if (typeof candidate === 'string' && candidate.trim()) return candidate.trim()
  return null
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<ProfileRow | null>(null)
  const [status, setStatus] = useState<AuthStatus>(isSupabaseConfigured ? 'loading' : 'anonymous')
  const [isSigningIn, setIsSigningIn] = useState(false)

  useEffect(() => {
    if (!supabase) return

    let active = true

    // `detectSessionInUrl` is on, so a return from Google is already exchanged
    // for a session by the time this resolves.
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return
      setSession(data.session ?? null)
      setStatus(data.session ? 'authenticated' : 'anonymous')
    })

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession)
      setStatus(nextSession ? 'authenticated' : 'anonymous')
      if (nextSession) setIsSigningIn(false)
    })

    return () => {
      active = false
      subscription.subscription.unsubscribe()
    }
  }, [])

  // Profiles live in `public.profiles`, seeded by the handle_new_user trigger.
  useEffect(() => {
    const userId = session?.user.id
    if (!userId) {
      setProfile(null)
      return
    }
    let active = true
    fetchProfile(userId).then((row) => {
      if (active) setProfile(row)
    })
    return () => {
      active = false
    }
  }, [session?.user.id])

  const signInWithGoogle = useCallback(async (redirectTo?: string) => {
    setIsSigningIn(true)
    const { error } = await startGoogleSignIn(redirectTo)
    if (error) setIsSigningIn(false)
    return error
  }, [])

  const signOut = useCallback(async () => {
    await signOutRequest()
    setSession(null)
    setProfile(null)
    setStatus('anonymous')
  }, [])

  const value = useMemo<AuthContextValue>(() => {
    const user = session?.user ?? null
    const fallbackName = user?.email?.split('@')[0] ?? 'Traveller'
    return {
      session,
      user,
      profile,
      status,
      isConfigured: isSupabaseConfigured,
      displayName: readFullName(user, profile) ?? fallbackName,
      avatarUrl: readAvatar(user, profile),
      isSigningIn,
      signInWithGoogle,
      signOut,
    }
  }, [session, profile, status, isSigningIn, signInWithGoogle, signOut])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used inside <AuthProvider>')
  return context
}
