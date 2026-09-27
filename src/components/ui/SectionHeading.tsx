import type { ReactNode } from 'react'
import { motion } from 'framer-motion'

import { fadeUp, scrollReveal, staggerParent } from '@/animations'
import { cn } from '@/lib/utils'

export interface SectionHeadingProps {
  eyebrow?: string
  title: ReactNode
  description?: ReactNode
  /** Right-hand slot for a link or control. */
  action?: ReactNode
  align?: 'left' | 'center'
  onDark?: boolean
  className?: string
}

export function SectionHeading({
  eyebrow,
  title,
  description,
  action,
  align = 'left',
  onDark,
  className,
}: SectionHeadingProps) {
  return (
    <motion.div
      variants={staggerParent(0.07)}
      {...scrollReveal}
      className={cn(
        'flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between',
        align === 'center' && 'sm:flex-col sm:items-center sm:text-center',
        className,
      )}
    >
      <div className={cn('max-w-2xl', align === 'center' && 'mx-auto')}>
        {eyebrow && (
          <motion.p
            variants={fadeUp}
            className={cn('eyebrow mb-4', onDark ? 'text-sea-300' : 'text-sea-600')}
          >
            {eyebrow}
          </motion.p>
        )}
        <motion.h2
          variants={fadeUp}
          className={cn(
            'text-3xl leading-[1.08] sm:text-4xl lg:text-[2.75rem]',
            onDark ? 'text-canvas' : 'text-ink-800',
          )}
        >
          {title}
        </motion.h2>
        {description && (
          <motion.p
            variants={fadeUp}
            className={cn(
              'mt-4 text-[15px] leading-relaxed',
              onDark ? 'text-white/60' : 'text-ink-500',
            )}
          >
            {description}
          </motion.p>
        )}
      </div>
      {action && (
        <motion.div variants={fadeUp} className="shrink-0">
          {action}
        </motion.div>
      )}
    </motion.div>
  )
}
