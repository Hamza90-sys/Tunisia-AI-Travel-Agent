import type { ReactNode } from 'react'

import { cn } from '@/lib/utils'

export interface ChipProps {
  selected?: boolean
  onClick?: () => void
  icon?: ReactNode
  className?: string
  /** Renders on the dark AI surfaces. */
  onDark?: boolean
  children: ReactNode
}

/**
 * Toggleable pill used for planner preferences and Discover categories.
 * Renders as a real toggle button so screen readers announce the state.
 */
export function Chip({ selected, onClick, icon, className, onDark, children }: ChipProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={cn(
        'group inline-flex shrink-0 items-center gap-2 rounded-full border px-4 py-2.5 text-sm font-medium transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]',
        onDark
          ? selected
            ? 'border-sea-400/60 bg-sea-500/18 text-sea-100 shadow-[0_0_0_1px_rgba(53,189,187,0.25)]'
            : 'border-white/12 bg-white/[0.04] text-white/70 hover:border-white/30 hover:text-white'
          : selected
            ? 'border-sea-500/45 bg-sea-500/10 text-sea-800'
            : 'border-ink-800/12 bg-canvas-raised text-ink-600 hover:border-ink-800/28 hover:text-ink-800',
        className,
      )}
    >
      {icon}
      {children}
    </button>
  )
}
