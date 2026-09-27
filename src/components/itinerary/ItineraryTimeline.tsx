import { motion } from 'framer-motion'
import { CalendarDays } from 'lucide-react'

import { ActivityCard } from './ActivityCard'
import { EmptyState, TimelineSkeleton } from '@/components/ui'
import { staggerParent } from '@/animations'
import { cn, formatCurrency, formatTime, padNumber } from '@/lib/utils'
import type { ItineraryItem, TripDay } from '@/types'

export interface ItineraryTimelineProps {
  day?: TripDay
  isLoading?: boolean
  onSelectItem?: (item: ItineraryItem) => void
  /** Rendered under the day headline — used for NOVA actions. */
  actions?: React.ReactNode
  className?: string
}

/**
 * Vertical itinerary for a single day.
 *
 * The time column is the spine: a 24h stamp on the left, the block on the
 * right, a hairline connecting them. It holds up from 320px to desktop because
 * the stamp moves above the card on narrow screens instead of shrinking.
 */
export function ItineraryTimeline({
  day,
  isLoading,
  onSelectItem,
  actions,
  className,
}: ItineraryTimelineProps) {
  if (isLoading) {
    return <TimelineSkeleton />
  }

  if (!day) {
    return (
      <EmptyState
        icon={<CalendarDays className="size-5" aria-hidden />}
        title="No day selected"
        description="Pick a day from the selector to see the plan."
      />
    )
  }

  const dayTotal = day.items.reduce((sum, item) => sum + (item.costEstimate ?? 0), 0)

  return (
    <section
      id={`day-panel-${day.dayIndex}`}
      role="tabpanel"
      aria-labelledby={`day-tab-${day.dayIndex}`}
      className={cn('min-w-0', className)}
    >
      {/* Day masthead */}
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-line pb-6">
        <div>
          <p className="eyebrow text-sea-600">Day {padNumber(day.dayIndex)}</p>
          <h3 className="mt-2 text-3xl uppercase tracking-tight text-ink-800 sm:text-[2.125rem]">
            {day.city}
          </h3>
          {day.headline && (
            <p className="mt-2 max-w-md text-sm leading-relaxed text-ink-500">{day.headline}</p>
          )}
        </div>

        <div className="flex flex-col items-end gap-3">
          {dayTotal > 0 && (
            <p className="text-xs text-ink-400">
              Estimated <span className="text-ink-700">{formatCurrency(dayTotal)}</span> per person
            </p>
          )}
          {actions}
        </div>
      </header>

      {day.items.length === 0 ? (
        <EmptyState
          className="mt-8"
          icon={<CalendarDays className="size-5" aria-hidden />}
          title="This day is open"
          description="Nothing scheduled yet. Ask NOVA to fill it, or keep it free."
        />
      ) : (
        <motion.ol
          key={day.id}
          variants={staggerParent(0.07)}
          initial="hidden"
          animate="visible"
          className="mt-8 space-y-4 sm:space-y-0"
        >
          {day.items.map((item, index) => (
            <li
              key={item.id}
              className="relative sm:grid sm:grid-cols-[4.5rem_1fr] sm:gap-6 sm:pb-6"
            >
              {/* Time stamp + spine */}
              <div className="mb-2 flex items-center gap-3 sm:mb-0 sm:block sm:pt-5">
                <time
                  className="font-display text-sm tabular-nums text-ink-700 sm:text-base"
                  dateTime={item.startTime ?? undefined}
                >
                  {formatTime(item.startTime) || '—'}
                </time>
                <span className="h-px flex-1 bg-line sm:hidden" aria-hidden />
              </div>

              {/* Desktop spine */}
              <span
                aria-hidden
                className="absolute left-[5.25rem] top-0 hidden h-full w-px -translate-x-1/2 bg-line sm:block"
              />
              <span
                aria-hidden
                className={cn(
                  'absolute left-[5.25rem] top-7 hidden size-2 -translate-x-1/2 rounded-full ring-4 ring-canvas sm:block',
                  index === 0 ? 'bg-sea-500' : 'bg-line-strong',
                )}
              />

              <ActivityCard item={item} onSelect={onSelectItem} />
            </li>
          ))}
        </motion.ol>
      )}
    </section>
  )
}
