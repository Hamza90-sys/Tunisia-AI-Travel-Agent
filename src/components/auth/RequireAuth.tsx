import type { ReactNode } from 'react'
import { motion } from 'framer-motion'
import { Lock } from 'lucide-react'

import { GoogleButton } from './GoogleButton'
import { NovaAvatar } from '@/components/nova'
import { Container } from '@/components/ui'
import { useAuth } from '@/hooks'

export interface RequireAuthProps {
  title: string
  description: string
  children: ReactNode
}

/**
 * Gate for the routes that render a traveller's own records.
 *
 * Shows the Google CTA in place of the page, on the same route, with no
 * redirect — so the traveller keeps the URL they were sent and lands on their
 * own data the moment the session exists.
 */
export function RequireAuth({ title, description, children }: RequireAuthProps) {
  const { status } = useAuth()

  if (status === 'loading') {
    return (
      <Container className="flex min-h-[70dvh] flex-col items-center justify-center py-32">
        <NovaAvatar state="thinking" size="lg" />
        <p className="mt-6 text-sm text-muted">Checking your session…</p>
      </Container>
    )
  }

  if (status === 'anonymous') {
    return (
      <Container className="flex min-h-[80dvh] items-center justify-center py-28">
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          className="w-full max-w-lg rounded-4xl border border-hairline bg-paper p-10 text-center shadow-hairline"
        >
          <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-terracotta-500/10 text-terracotta-500">
            <Lock className="size-5" aria-hidden />
          </span>

          <h1 className="mt-7 font-display text-[1.75rem] leading-tight text-forest-900">
            {title}
          </h1>
          <p className="mx-auto mt-3 max-w-sm text-sm leading-relaxed text-body">{description}</p>

          <div className="mt-8 flex justify-center">
            <GoogleButton size="lg" />
          </div>
        </motion.div>
      </Container>
    )
  }

  return <>{children}</>
}
