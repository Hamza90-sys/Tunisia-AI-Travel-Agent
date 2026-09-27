import type { ReactNode } from 'react'

import { cn } from '@/lib/utils'

export interface EmptyStateProps {
  icon?: ReactNode
  title: string
  description?: string
  action?: ReactNode
  onDark?: boolean
  className?: string
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  onDark,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center rounded-3xl border border-dashed px-6 py-16 text-center',
        onDark ? 'border-white/12 bg-white/[0.02]' : 'border-line-strong bg-canvas-raised/60',
        className,
      )}
    >
      {icon && (
        <span
          className={cn(
            'mb-5 flex size-12 items-center justify-center rounded-full',
            onDark ? 'bg-white/[0.06] text-sea-300' : 'bg-sea-500/10 text-sea-600',
          )}
        >
          {icon}
        </span>
      )}
      <h3 className={cn('text-xl', onDark ? 'text-canvas' : 'text-ink-800')}>{title}</h3>
      {description && (
        <p
          className={cn(
            'mt-2 max-w-sm text-sm leading-relaxed',
            onDark ? 'text-white/55' : 'text-ink-500',
          )}
        >
          {description}
        </p>
      )}
      {action && <div className="mt-7">{action}</div>}
    </div>
  )
}
