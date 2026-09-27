import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Lock, Mail, User } from 'lucide-react'

import { AuthLayout } from './AuthLayout'
import { Button, Input } from '@/components/ui'
import { useAuth } from '@/hooks'
import { ROUTES } from '@/lib/utils'

const MIN_PASSWORD_LENGTH = 8

export default function SignupPage() {
  const navigate = useNavigate()
  const { signUp, isConfigured } = useAuth()

  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setError(null)
    setNotice(null)

    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(`Use at least ${MIN_PASSWORD_LENGTH} characters.`)
      return
    }

    setIsSubmitting(true)
    const message = await signUp(email, password, fullName.trim())
    setIsSubmitting(false)

    if (message) {
      setError(message)
      return
    }

    // Supabase projects with email confirmation on return no session here.
    setNotice('Check your inbox to confirm your email, then sign in.')
    if (!isConfigured) return
    window.setTimeout(() => navigate(ROUTES.login), 1600)
  }

  return (
    <AuthLayout
      eyebrow="Get started"
      title="Create account"
      description="One account for your trips, your bookings and everything you tell NOVA."
      pitch={{
        heading: 'Tunisia, planned in a conversation.',
        body: 'Describe the week you want. NOVA builds the route, books what it can, and rewrites it whenever you change your mind.',
      }}
      footer={
        <>
          Already have an account?{' '}
          <Link to={ROUTES.login} className="font-medium text-sea-700 hover:underline">
            Sign in
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-5" noValidate>
        <Input
          label="Full name"
          value={fullName}
          onChange={(event) => setFullName(event.target.value)}
          placeholder="Amira Ben Salah"
          autoComplete="name"
          required
          icon={<User className="size-4" aria-hidden />}
        />

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
          placeholder="At least 8 characters"
          autoComplete="new-password"
          required
          hint="Minimum 8 characters."
          icon={<Lock className="size-4" aria-hidden />}
        />

        {error && (
          <p role="alert" className="rounded-xl bg-critical/[0.08] px-4 py-3 text-[13px] text-critical">
            {error}
          </p>
        )}

        {notice && (
          <p role="status" className="rounded-xl bg-positive/[0.08] px-4 py-3 text-[13px] text-positive">
            {notice}
          </p>
        )}

        <Button type="submit" variant="primary" size="lg" fullWidth isLoading={isSubmitting}>
          Create account
        </Button>

        <p className="text-center text-[11px] leading-relaxed text-ink-300">
          By continuing you agree to the prototype terms. This is a hackathon build — do not enter
          a password you use elsewhere.
        </p>
      </form>
    </AuthLayout>
  )
}
