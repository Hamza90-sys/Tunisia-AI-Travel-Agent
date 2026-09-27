import { CalendarDays, CircleDollarSign, Route, Users } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

import { Badge } from '@/components/ui'
import { PREFERENCE_META } from '@/data'
import { getTripEstimate } from '@/data'
import {
  cn,
  daysBetweenInclusive,
  formatCurrency,
  formatDateRange,
  pluralize,
} from '@/lib/utils'
import type { Trip } from '@/types'

export interface TripSummaryProps {
  trip: Trip
  onDark?: boolean
  className?: string
}

/**
 * The trip's headline facts: duration, travellers, route, estimated spend.
 * Everything is derived from the trip object — nothing is written twice.
 */
export function TripSummary({ trip, onDark, className }: TripSummaryProps) {
  const days = daysBetweenInclusive(trip.startDate, trip.endDate) ?? trip.days.length
  const estimate = getTripEstimate(trip)

  const stats: { icon: LucideIcon; label: string; value: string }[] = [
    {
      icon: CalendarDays,
      label: 'Dates',
      value: formatDateRange(trip.startDate, trip.endDate),
    },
    { icon: Users, label: 'Travellers', value: pluralize(trip.travelers, 'traveller') },
    { icon: Route, label: 'Route', value: trip.route.join(' → ') },
    {
      icon: CircleDollarSign,
      label: 'Estimated',
      value: estimate > 0 ? `${formatCurrency(estimate)} pp` : '—',
    },
  ]

  const preferences = PREFERENCE_META.filter((meta) => trip.preferences.includes(meta.id))

  return (
    <div className={cn('flex flex-col gap-7', className)}>
      <div>
        <p className={cn('text-lg', onDark ? 'text-white/70' : 'text-ink-600')}>
          {trip.destination}
          <span className={cn('mx-2.5', onDark ? 'text-white/25' : 'text-ink-200')}>·</span>
          {pluralize(days, 'day')}
          <span className={cn('mx-2.5', onDark ? 'text-white/25' : 'text-ink-200')}>·</span>
          {pluralize(trip.travelers, 'traveller')}
        </p>

        {trip.summary && (
          <p
            className={cn(
              'mt-4 max-w-xl text-[15px] leading-relaxed',
              onDark ? 'text-white/50' : 'text-ink-500',
            )}
          >
            {trip.summary}
          </p>
        )}
      </div>

      {preferences.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {preferences.map((preference) => (
            <Badge key={preference.id} tone={onDark ? 'onDark' : 'sea'}>
              <preference.icon className="size-3" aria-hidden />
              {preference.label}
            </Badge>
          ))}
        </div>
      )}

      <dl
        className={cn(
          'grid grid-cols-2 gap-px overflow-hidden rounded-3xl border lg:grid-cols-4',
          onDark ? 'border-white/[0.08] bg-white/[0.08]' : 'border-line bg-line',
        )}
      >
        {stats.map((stat) => (
          <div
            key={stat.label}
            className={cn('p-4 sm:p-5', onDark ? 'bg-ink-900' : 'bg-canvas-raised')}
          >
            <dt
              className={cn(
                'flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.14em]',
                onDark ? 'text-white/35' : 'text-ink-300',
              )}
            >
              <stat.icon className="size-3.5" aria-hidden />
              {stat.label}
            </dt>
            <dd
              className={cn(
                'mt-2.5 truncate text-sm font-medium sm:text-[15px]',
                onDark ? 'text-canvas' : 'text-ink-800',
              )}
              title={stat.value}
            >
              {stat.value}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  )
}
