import { useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Check } from 'lucide-react'

import { AuthLayout } from './AuthLayout'
import { GoogleButton } from '@/components/auth'
import { useAuth } from '@/hooks'
import { ROUTES } from '@/lib/utils'

const BENEFITS = [
  'Trips and bookings saved to your account',
  'NOVA remembers the whole conversation',
  'Nothing to remember — Google handles the sign-in',
]

/**
 * The sign-in route.
 *
 * There is exactly one way into an account: Google. No email field, no password
 * field, no sign-up form, no reset flow — none of that exists in this codebase.
 *
 * `?next=/trip` survives the round trip so a traveller sent here by a protected
 * route lands back where they were going.
 */
export default function LoginPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { status } = useAuth()

  const next = searchParams.get('next')
  const destination = next && next.startsWith('/') ? next : ROUTES.trip

  // Already signed in? This page has nothing to offer.
  useEffect(() => {
    if (status === 'authenticated') navigate(destination, { replace: true })
  }, [status, destination, navigate])

  // Guarded because this module is also rendered on the server by the smoke
  // test. Left undefined there, `signInWithGoogle` builds the URL at click
  // time, which only ever happens in a browser.
  const redirectTo =
    typeof window === 'undefined'
      ? undefined
      : `${window.location.origin}${ROUTES.authCallback}?next=${encodeURIComponent(destination)}`

  return (
    <AuthLayout
      eyebrow="Welcome"
      title="Sign in"
      description="One tap with Google. We never see a password, because there isn’t one."
      pitch={{
        heading: 'Your Tunisia, still exactly where you left it.',
        body: 'Trips, reservations and every change you asked NOVA to make — saved to your account, not to a browser tab.',
      }}
      footer={
        <p className="text-[13px] leading-relaxed text-muted">
          New here? The first sign-in creates your account automatically.
        </p>
      }
    >
      <GoogleButton size="lg" fullWidth redirectTo={redirectTo} />

      <ul className="mt-8 space-y-3">
        {BENEFITS.map((benefit) => (
          <li key={benefit} className="flex items-start gap-3 text-sm text-body">
            <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-terracotta-500/10 text-terracotta-500">
              <Check className="size-3" strokeWidth={3} aria-hidden />
            </span>
            {benefit}
          </li>
        ))}
      </ul>

      <p className="mt-8 text-[11px] leading-relaxed text-muted">
        We receive your name, email address and profile picture from Google. Nothing else, and
        nothing is shared onward.
      </p>
    </AuthLayout>
  )
}
