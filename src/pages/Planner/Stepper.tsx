import type { ReactNode } from 'react'
import { Minus, Plus } from 'lucide-react'

import { cn } from '@/lib/utils'

export interface StepperProps {
  label: string
  value: number
  min: number
  max: number
  /** Unit shown next to the value, e.g. "days". */
  suffix: string
  onChange: (value: number) => void
}

/** Numeric stepper for the dark planner surface. */
export function Stepper({ label, value, min, max, suffix, onChange }: StepperProps) {
  return (
    <div>
      <p className="eyebrow text-white/40">{label}</p>
      <div className="mt-3 flex items-center gap-1.5">
        <StepperButton
          label={`Decrease ${label}`}
          disabled={value <= min}
          onClick={() => onChange(Math.max(min, value - 1))}
        >
          <Minus className="size-3.5" aria-hidden />
        </StepperButton>
        <p className="min-w-24 text-center text-sm text-canvas">
          <span className="font-display text-lg">{value}</span>
          <span className="ml-1.5 text-white/45">{suffix}</span>
        </p>
        <StepperButton
          label={`Increase ${label}`}
          disabled={value >= max}
          onClick={() => onChange(Math.min(max, value + 1))}
        >
          <Plus className="size-3.5" aria-hidden />
        </StepperButton>
      </div>
    </div>
  )
}

function StepperButton({
  children,
  label,
  disabled,
  onClick,
}: {
  children: ReactNode
  label: string
  disabled?: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'flex size-9 items-center justify-center rounded-full border border-white/12 text-white/70 transition-colors',
        'hover:border-sea-400/40 hover:text-canvas disabled:opacity-30 disabled:hover:border-white/12',
      )}
    >
      {children}
    </button>
  )
}
