import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowLeft, CircleAlert } from 'lucide-react'

import { NovaAvatar } from '@/components/nova'
import { Logo } from '@/components/layout'
import { fadeUp, staggerParent } from '@/animations'
import { useAuth } from '@/hooks'
import { ROUTES } from '@/lib/utils'

export interface AuthLayoutProps {
  eyebrow: string
  title: string
  description: string
  /** Editorial copy for the dark panel. */
  pitch: { heading: string; body: string }
  footer: ReactNode
  children: ReactNode
}

/**
 * Split layout for authentication.
 *
 * The dark half carries the brand and NOVA; the light half carries the form.
 * On mobile the dark half collapses to a compact header so the form is the
 * first thing in the viewport.
 */
export function AuthLayout({
  eyebrow,
  title,
  description,
  pitch,
  footer,
  children,
}: AuthLayoutProps) {
  const { isConfigured } = useAuth()

  return (
    <div className="grid min-h-dvh lg:grid-cols-2">
      {/* --- Brand panel --------------------------------------------------- */}
      <aside className="grain relative isolate flex flex-col justify-between overflow-hidden bg-ink-900 px-6 py-8 text-canvas sm:px-10 lg:py-12">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              'radial-gradient(80% 60% at 20% 10%, rgba(24,166,166,0.26) 0%, rgba(7,19,31,0) 62%), radial-gradient(70% 50% at 90% 95%, rgba(216,180,122,0.16) 0%, rgba(7,19,31,0) 60%)',
          }}
        />

        <div className="relative z-2 flex items-center justify-between gap-4">
          <Logo onDark />
          <Link
            to={ROUTES.landing}
            className="flex items-center gap-1.5 text-xs text-white/45 transition-colors hover:text-canvas lg:hidden"
          >
            <ArrowLeft className="size-3.5" aria-hidden />
            Home
          </Link>
        </div>

        <motion.div
          variants={staggerParent(0.1, 0.15)}
          initial="hidden"
          animate="visible"
          className="relative z-2 hidden py-16 lg:block"
        >
          <motion.div variants={fadeUp}>
            <NovaAvatar state="idle" size={132} />
          </motion.div>
          <motion.h2
            variants={fadeUp}
            className="mt-12 max-w-sm text-[2.5rem] uppercase leading-[0.98] tracking-[-0.025em]"
          >
            {pitch.heading}
          </motion.h2>
          <motion.p
            variants={fadeUp}
            className="mt-6 max-w-sm text-[15px] leading-relaxed text-white/50"
          >
            {pitch.body}
          </motion.p>
        </motion.div>

        <div className="relative z-2 hidden text-xs text-white/30 lg:block">
          Tunisia, planned in conversation.
        </div>
      </aside>

      {/* --- Form panel ----------------------------------------------------- */}
      <main className="flex flex-col justify-center bg-canvas px-6 py-14 sm:px-10 lg:px-16">
        <div className="mx-auto w-full max-w-sm">
          <Link
            to={ROUTES.landing}
            className="mb-10 hidden items-center gap-1.5 text-xs text-ink-400 transition-colors hover:text-ink-700 lg:inline-flex"
          >
            <ArrowLeft className="size-3.5" aria-hidden />
            Back to home
          </Link>

          <p className="eyebrow text-sea-600">{eyebrow}</p>
          <h1 className="mt-3 text-display-sm text-ink-800">{title}</h1>
          <p className="mt-3 text-sm leading-relaxed text-ink-500">{description}</p>

          {!isConfigured && (
            <div
              role="note"
              className="mt-7 flex items-start gap-3 rounded-2xl border border-caution/30 bg-caution/[0.07] p-4 text-[13px] leading-relaxed text-caution"
            >
              <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
              <p>
                Supabase is not configured in this environment. Add{' '}
                <code className="font-mono text-xs">VITE_SUPABASE_URL</code> and{' '}
                <code className="font-mono text-xs">VITE_SUPABASE_ANON_KEY</code> to{' '}
                <code className="font-mono text-xs">.env.local</code> to enable accounts.
              </p>
            </div>
          )}

          <div className="mt-9">{children}</div>

          <div className="mt-8 text-sm text-ink-500">{footer}</div>
        </div>
      </main>
    </div>
  )
}
