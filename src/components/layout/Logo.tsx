import { Link } from 'react-router-dom'

import { ROUTES, cn } from '@/lib/utils'

export interface LogoProps {
  onDark?: boolean
  className?: string
  /** Kept for call-site compatibility; the wordmark is already compact. */
  markOnly?: boolean
}

/**
 * TuniTrip wordmark.
 *
 * INTERIM: there is no TuniTrip logo asset in this repository — the only mark
 * on disk is `public/nova.svg`, which is NOVA's orb and was explicitly rejected
 * for the header. Rather than invent a mark, this renders the name
 * typographically in the editorial serif, with the accent carried by the dot.
 *
 * Drop the real logo into `public/` and swap the span below for an <img>; the
 * surrounding layout, sizing and routing need no other change.
 */
export function Logo({ onDark, className }: LogoProps) {
  return (
    <Link
      to={ROUTES.landing}
      className={cn('group inline-flex items-baseline gap-0.5', className)}
      aria-label="TuniTrip — home"
    >
      <span
        className={cn(
          'font-display text-[1.375rem] font-medium leading-none tracking-[-0.02em]',
          onDark ? 'text-ivory-50' : 'text-forest-900',
        )}
      >
        TuniTrip
      </span>
      <span
        aria-hidden
        className="size-[5px] rounded-full bg-terracotta-500 transition-transform duration-300 group-hover:scale-125"
      />
    </Link>
  )
}
