import type { ReactNode } from 'react'
import { motion } from 'framer-motion'

import { Container } from '@/components/ui'
import { fadeUp, staggerParent } from '@/animations'
import { cn } from '@/lib/utils'

export interface PageHeaderProps {
  eyebrow?: string
  title: ReactNode
  description?: ReactNode
  /** Right-aligned controls (filters, CTAs). */
  actions?: ReactNode
  /** Rendered under the header, inside the same container. */
  children?: ReactNode
  tone?: 'light' | 'dark'
  size?: 'default' | 'wide'
  className?: string
}

/**
 * Shared page masthead. Keeps the vertical rhythm and the display-type scale
 * identical across Planner, Trip, Discover and Reservations.
 */
export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  children,
  tone = 'light',
  size = 'wide',
  className,
}: PageHeaderProps) {
  const onDark = tone === 'dark'

  return (
    <div
      className={cn(
        'relative overflow-hidden pt-28 md:pt-36',
        onDark ? 'grain bg-ink-900 text-canvas' : 'bg-canvas',
        className,
      )}
    >
      {onDark && (
        <div
          aria-hidden
          className="pointer-events-none absolute -right-32 -top-32 size-[34rem] rounded-full opacity-50 blur-3xl"
          style={{
            background: 'radial-gradient(circle, rgba(24,166,166,0.34) 0%, rgba(7,19,31,0) 70%)',
          }}
        />
      )}

      <Container size={size} className="relative z-2 pb-10 md:pb-14">
        <motion.div
          variants={staggerParent(0.07)}
          initial="hidden"
          animate="visible"
          className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between"
        >
          <div className="max-w-2xl">
            {eyebrow && (
              <motion.p
                variants={fadeUp}
                className={cn('eyebrow mb-4', onDark ? 'text-sea-300' : 'text-sea-600')}
              >
                {eyebrow}
              </motion.p>
            )}
            <motion.h1
              variants={fadeUp}
              className={cn(
                'text-display-sm sm:text-display-md',
                onDark ? 'text-canvas' : 'text-ink-800',
              )}
            >
              {title}
            </motion.h1>
            {description && (
              <motion.p
                variants={fadeUp}
                className={cn(
                  'mt-5 max-w-xl text-[15px] leading-relaxed',
                  onDark ? 'text-white/55' : 'text-ink-500',
                )}
              >
                {description}
              </motion.p>
            )}
          </div>

          {actions && (
            <motion.div variants={fadeUp} className="shrink-0">
              {actions}
            </motion.div>
          )}
        </motion.div>

        {children && <div className="mt-10">{children}</div>}
      </Container>
    </div>
  )
}
