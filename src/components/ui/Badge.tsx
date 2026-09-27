import type { ReactNode } from 'react'

import { cn } from '@/lib/utils'

export type BadgeTone = 'neutral' | 'sea' | 'sand' | 'positive' | 'caution' | 'critical' | 'onDark'

const TONES: Record<BadgeTone, string> = {
  neutral: 'bg-ink-800/[0.06] text-ink-600',
  sea: 'bg-sea-500/12 text-sea-700',
  sand: 'bg-sand-500/20 text-sand-800',
  positive: 'bg-positive/12 text-positive',
  caution: 'bg-caution/14 text-caution',
  critical: 'bg-critical/12 text-critical',
  onDark: 'bg-white/10 text-white/80',
}

export interface BadgeProps {
  tone?: BadgeTone
  icon?: ReactNode
  className?: string
  children: ReactNode
}

export function Badge({ tone = 'neutral', icon, className, children }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium tracking-wide',
        TONES[tone],
        className,
      )}
    >
      {icon}
      {children}
    </span>
  )
}
