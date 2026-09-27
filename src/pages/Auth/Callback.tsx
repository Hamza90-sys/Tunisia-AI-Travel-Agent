import { useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { CircleAlert } from 'lucide-react'

import { GoogleButton } from '@/components/auth'
import { NovaAvatar } from '@/components/nova'
import { ButtonLink, Container } from '@/components/ui'
import { useAuth } from '@/hooks'
import { ROUTES } from '@/lib/utils'

/**
 * Where Google returns the traveller.
 *
 * `detectSessionInUrl` is enabled on the Supabase client, so by the time this
 * mounts the fragment has already been exchanged for a session and
 * `onAuthStateChange` has fired. This route only decides where to send them
 * next — and shows the provider's error when the handshake was refused.
 */
export default function AuthCallbackPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { status } = useAuth()

  const next = searchParams.get('next')
  const destination = next && next.startsWith('/') ? next : ROUTES.trip

  // Google reports a refusal on the query string, not the fragment.
  const providerError = searchParams.get('error_description') ?? searchParams.get('error')

  useEffect(() => {
    if (providerError) return
    if (status === 'authenticated') navigate(destination, { replace: true })
  }, [status, destination, navigate, providerError])

  if (providerError) {
    return (
      <Container className="flex min-h-dvh flex-col items-center justify-center py-24 text-center">
        <span className="flex size-12 items-center justify-center rounded-full bg-critical/[0.1] text-critical">
          <CircleAlert className="size-5" aria-hidden />
        </span>
        <h1 className="mt-7 font-display text-[1.75rem] text-forest-900">
          Google did not complete the sign-in
        </h1>
        <p className="mt-3 max-w-md text-sm leading-relaxed text-body">{providerError}</p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <GoogleButton label="Try again" />
          <ButtonLink to={ROUTES.landing} variant="outline">
            Back to home
          </ButtonLink>
        </div>
      </Container>
    )
  }

  if (status === 'anonymous') {
    return (
      <Container className="flex min-h-dvh flex-col items-center justify-center py-24 text-center">
        <h1 className="font-display text-[1.75rem] text-forest-900">
          That sign-in link has expired
        </h1>
        <p className="mt-3 max-w-md text-sm leading-relaxed text-body">
          Nothing went wrong on your side — the handshake simply timed out. One more tap and you
          are in.
        </p>
        <div className="mt-8 flex justify-center">
          <GoogleButton size="lg" />
        </div>
      </Container>
    )
  }

  return (
    <Container className="flex min-h-dvh flex-col items-center justify-center py-24">
      <NovaAvatar state="thinking" size="lg" />
      <p className="mt-7 text-sm text-muted">Finishing your sign-in…</p>
    </Container>
  )
}
