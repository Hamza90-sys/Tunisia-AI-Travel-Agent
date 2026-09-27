import type { HTMLAttributes, ReactNode } from 'react'

import { cn } from '@/lib/utils'

export type CardTone = 'light' | 'dark' | 'sunken'

const TONES: Record<CardTone, string> = {
  light: 'bg-canvas-raised border-line',
  dark: 'bg-ink-900 border-white/[0.08] text-canvas',
  sunken: 'bg-canvas-sunken border-line',
}

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  tone?: CardTone
  /** Adds hover elevation. Use only when the whole card is interactive. */
  interactive?: boolean
  children?: ReactNode
}

export function Card({
  tone = 'light',
  interactive,
  className,
  children,
  ...rest
}: CardProps) {
  return (
    <div
      className={cn(
        'rounded-3xl border shadow-soft',
        TONES[tone],
        interactive &&
          'transition-[transform,box-shadow] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] hover:-translate-y-1 hover:shadow-lift',
        className,
      )}
      {...rest}
    >
      {children}
    </div>
  )
}
