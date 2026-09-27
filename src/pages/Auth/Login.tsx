import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Lock, Mail } from 'lucide-react'

import { AuthLayout } from './AuthLayout'
import { Button, Input } from '@/components/ui'
import { useAuth } from '@/hooks'
import { ROUTES } from '@/lib/utils'

export default function LoginPage() {
  const navigate = useNavigate()
  const { signIn } = useAuth()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setError(null)
    setIsSubmitting(true)

    const message = await signIn(email, password)

    setIsSubmitting(false)
    if (message) {
      setError(message)
      return
    }
    navigate(ROUTES.trip)
  }

  return (
    <AuthLayout
      eyebrow="Welcome back"
      title="Sign in"
      description="Pick your journey up where you left it."
      pitch={{
        heading: 'Your Tunisia, still exactly where you left it.',
        body: 'Trips, reservations and every change you asked NOVA to make — saved to your account, not to a browser tab.',
      }}
      footer={
        <>
          New here?{' '}
          <Link to={ROUTES.signup} className="font-medium text-sea-700 hover:underline">
            Create an account
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-5" noValidate>
        <Input
          type="email"
          label="Email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="you@example.com"
          autoComplete="email"
          required
          icon={<Mail className="size-4" aria-hidden />}
        />

        <Input
          type="password"
          label="Password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder="••••••••"
          autoComplete="current-password"
          required
          icon={<Lock className="size-4" aria-hidden />}
        />

        {error && (
          <p role="alert" className="rounded-xl bg-critical/[0.08] px-4 py-3 text-[13px] text-critical">
            {error}
          </p>
        )}

        <Button type="submit" variant="primary" size="lg" fullWidth isLoading={isSubmitting}>
          Sign in
        </Button>
      </form>
    </AuthLayout>
  )
}
