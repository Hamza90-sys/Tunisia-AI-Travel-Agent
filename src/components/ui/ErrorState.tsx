import { CircleAlert } from 'lucide-react'

import { Button } from './Button'
import { cn } from '@/lib/utils'

export interface ErrorStateProps {
  title?: string
  description?: string
  onRetry?: () => void
  onDark?: boolean
  className?: string
}

export function ErrorState({
  title = 'We could not load this',
  description = 'The connection dropped somewhere between here and the catalogue. Try again.',
  onRetry,
  onDark,
  className,
}: ErrorStateProps) {
  return (
    <div
      role="alert"
      className={cn(
        'flex flex-col items-center justify-center rounded-3xl border px-6 py-14 text-center',
        onDark ? 'border-critical/30 bg-critical/[0.08]' : 'border-critical/20 bg-critical/[0.04]',
        className,
      )}
    >
      <span className="mb-4 flex size-11 items-center justify-center rounded-full bg-critical/12 text-critical">
        <CircleAlert className="size-5" aria-hidden />
      </span>
      <h3 className={cn('text-lg', onDark ? 'text-canvas' : 'text-ink-800')}>{title}</h3>
      <p className={cn('mt-2 max-w-sm text-sm', onDark ? 'text-white/55' : 'text-ink-500')}>
        {description}
      </p>
      {onRetry && (
        <Button variant="outline" size="sm" className="mt-6" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  )
}
