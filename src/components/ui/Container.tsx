import type { ReactNode } from 'react'

import { cn } from '@/lib/utils'

export interface ContainerProps {
  size?: 'narrow' | 'default' | 'wide'
  className?: string
  children: ReactNode
}

const SIZES = {
  narrow: 'max-w-3xl',
  default: 'max-w-6xl',
  wide: 'max-w-7xl',
} as const

/** The single horizontal rhythm for the product. */
export function Container({ size = 'default', className, children }: ContainerProps) {
  return <div className={cn('mx-auto w-full px-5 sm:px-8', SIZES[size], className)}>{children}</div>
}
