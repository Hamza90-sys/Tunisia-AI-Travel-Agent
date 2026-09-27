import { useId } from 'react'

import { Stepper } from './Stepper'
import { cn, toIsoDate } from '@/lib/utils'
import { BUDGET_LEVELS } from '@/types'
import type { BudgetLevel } from '@/types'

const BUDGET_LABELS: Record<BudgetLevel, string> = {
  shoestring: 'Shoestring',
  balanced: 'Balanced',
  elevated: 'Elevated',
  luxury: 'Luxury',
}

export interface TripDraftControlsProps {
  travelers: number
  durationDays: number
  budgetLevel: BudgetLevel
  /** ISO `YYYY-MM-DD`, or null for a flexible trip. */
  startDate: string | null
  onTravelersChange: (value: number) => void
  onDurationChange: (value: number) => void
  onBudgetChange: (value: BudgetLevel) => void
  onStartDateChange: (value: string | null) => void
  className?: string
}

/**
 * The structured half of the brief.
 *
 * Travellers, dates, nights and budget are worth asking explicitly — they
 * change every downstream decision, and nobody wants to type "two of us" three
 * times.
 */
export function TripDraftControls({
  travelers,
  durationDays,
  budgetLevel,
  startDate,
  onTravelersChange,
  onDurationChange,
  onBudgetChange,
  onStartDateChange,
  className,
}: TripDraftControlsProps) {
  const dateFieldId = useId()

  return (
    <section
      aria-label="Trip shape"
      className={cn(
        'grid gap-8 rounded-4xl border border-white/[0.08] bg-white/[0.02] p-6 sm:grid-cols-2 sm:p-7 lg:grid-cols-4',
        className,
      )}
    >
      <Stepper
        label="Travellers"
        value={travelers}
        min={1}
        max={12}
        suffix={travelers === 1 ? 'person' : 'people'}
        onChange={onTravelersChange}
      />

      <Stepper
        label="Duration"
        value={durationDays}
        min={1}
        max={21}
        suffix={durationDays === 1 ? 'day' : 'days'}
        onChange={onDurationChange}
      />

      <div>
        <label htmlFor={dateFieldId} className="eyebrow block text-white/40">
          Start date
        </label>
        <div className="mt-3">
          <input
            id={dateFieldId}
            type="date"
            value={startDate ?? ''}
            min={toIsoDate()}
            onChange={(event) => onStartDateChange(event.target.value || null)}
            // color-scheme:dark makes the native picker glyph legible on the
            // dark surface instead of rendering a black-on-black icon.
            className="h-10 w-full rounded-full border border-white/12 bg-transparent px-4 text-sm text-canvas transition-colors [color-scheme:dark] hover:border-white/25 focus:border-sea-400/50 focus:outline-none"
          />
          <p className="mt-2 text-[11px] text-white/30">
            {startDate ? (
              <button
                type="button"
                onClick={() => onStartDateChange(null)}
                className="underline underline-offset-2 transition-colors hover:text-white/60"
              >
                Clear — keep it flexible
              </button>
            ) : (
              'Optional. NOVA plans relative days when left empty.'
            )}
          </p>
        </div>
      </div>

      <div>
        <p className="eyebrow text-white/40">Budget</p>
        <div role="radiogroup" aria-label="Budget level" className="mt-3 flex flex-wrap gap-1.5">
          {BUDGET_LEVELS.map((level) => (
            <button
              key={level}
              type="button"
              role="radio"
              aria-checked={budgetLevel === level}
              onClick={() => onBudgetChange(level)}
              className={cn(
                'rounded-full px-3 py-1.5 text-xs transition-colors duration-300',
                budgetLevel === level
                  ? 'bg-sea-500/20 text-sea-100 ring-1 ring-sea-400/40'
                  : 'text-white/45 hover:bg-white/[0.06] hover:text-white/80',
              )}
            >
              {BUDGET_LABELS[level]}
            </button>
          ))}
        </div>
      </div>
    </section>
  )
}
