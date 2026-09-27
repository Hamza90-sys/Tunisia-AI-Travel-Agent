import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import type { Session, User } from '@supabase/supabase-js'

import {
  fetchProfile,
  isSupabaseConfigured,
  signInWithEmail,
  signOut as signOutRequest,
  signUpWithEmail,
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
  signIn: (email: string, password: string) => Promise<string | null>
  signUp: (email: string, password: string, fullName: string) => Promise<string | null>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<ProfileRow | null>(null)
  const [status, setStatus] = useState<AuthStatus>(isSupabaseConfigured ? 'loading' : 'anonymous')

  useEffect(() => {
    if (!supabase) return

    let active = true

    supabase.auth.getSession().then(({ data }) => {
      if (!active) return
      setSession(data.session ?? null)
      setStatus(data.session ? 'authenticated' : 'anonymous')
    })

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession)
      setStatus(nextSession ? 'authenticated' : 'anonymous')
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

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await signInWithEmail(email, password)
    return error
  }, [])

  const signUp = useCallback(async (email: string, password: string, fullName: string) => {
    const { error } = await signUpWithEmail(email, password, fullName)
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
      displayName: profile?.full_name?.trim() || fallbackName,
      signIn,
      signUp,
      signOut,
    }
  }, [session, profile, status, signIn, signUp, signOut])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used inside <AuthProvider>')
  return context
}
