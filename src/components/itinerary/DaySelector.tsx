import { motion } from 'framer-motion'

import { cn, formatShortDate, formatWeekday, padNumber } from '@/lib/utils'
import type { TripDay } from '@/types'

export interface DaySelectorProps {
  days: TripDay[]
  activeDayIndex: number
  onChange: (dayIndex: number) => void
  className?: string
}

/**
 * Day switcher for the itinerary.
 *
 * A horizontal rail that scrolls on mobile and lays out as a row on desktop —
 * the same control either way, so the mental model never changes.
 */
export function DaySelector({ days, activeDayIndex, onChange, className }: DaySelectorProps) {
  return (
    <div
      role="tablist"
      aria-label="Trip days"
      className={cn(
        'no-scrollbar mask-fade-x -mx-5 flex gap-2.5 overflow-x-auto px-5 sm:mx-0 sm:mask-none sm:px-0',
        className,
      )}
    >
      {days.map((day) => {
        const isActive = day.dayIndex === activeDayIndex
        return (
          <button
            key={day.id}
            role="tab"
            aria-selected={isActive}
            aria-controls={`day-panel-${day.dayIndex}`}
            id={`day-tab-${day.dayIndex}`}
            onClick={() => onChange(day.dayIndex)}
            className={cn(
              'group relative shrink-0 rounded-2xl border px-4 py-3 text-left transition-all duration-400 ease-[cubic-bezier(0.22,1,0.36,1)]',
              isActive
                ? 'border-ink-800 bg-ink-800 text-canvas shadow-lift'
                : 'border-line bg-canvas-raised text-ink-500 hover:border-ink-800/25 hover:text-ink-800',
            )}
          >
            <span
              className={cn(
                'eyebrow block',
                isActive ? 'text-sea-300' : 'text-ink-300 group-hover:text-sea-600',
              )}
            >
              Day {padNumber(day.dayIndex)}
            </span>
            <span className="mt-1.5 block text-sm font-medium">{day.city}</span>
            <span
              className={cn('mt-0.5 block text-[11px]', isActive ? 'text-white/50' : 'text-ink-300')}
            >
              {formatWeekday(day.date, true)} {formatShortDate(day.date)}
            </span>

            {isActive && (
              <motion.span
                layoutId="day-selector-underline"
                className="absolute inset-x-4 bottom-1.5 h-px bg-sea-400"
                transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
              />
            )}
          </button>
        )
      })}
    </div>
  )
}
