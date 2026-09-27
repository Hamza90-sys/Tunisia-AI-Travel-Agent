import { forwardRef } from 'react'
import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { Link } from 'react-router-dom'
import type { LinkProps } from 'react-router-dom'
import { LoaderCircle } from 'lucide-react'

import { cn } from '@/lib/utils'

export type ButtonVariant = 'primary' | 'accent' | 'outline' | 'ghost' | 'onDark' | 'onDarkGhost'
export type ButtonSize = 'sm' | 'md' | 'lg'

const BASE =
  'relative inline-flex items-center justify-center gap-2 rounded-full font-medium tracking-tight transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] disabled:pointer-events-none disabled:opacity-50 select-none'

const VARIANTS: Record<ButtonVariant, string> = {
  primary:
    'bg-ink-800 text-canvas hover:bg-ink-700 shadow-soft hover:shadow-lift active:translate-y-px',
  accent:
    'bg-sea-500 text-white hover:bg-sea-600 shadow-soft hover:shadow-glow active:translate-y-px',
  outline:
    'border border-ink-800/15 bg-transparent text-ink-800 hover:border-ink-800/35 hover:bg-ink-800/[0.03]',
  ghost: 'text-ink-700 hover:bg-ink-800/[0.05]',
  onDark: 'bg-canvas text-ink-900 hover:bg-white shadow-lift active:translate-y-px',
  onDarkGhost:
    'border border-white/20 text-white/90 hover:border-white/45 hover:bg-white/[0.06] backdrop-blur-sm',
}

const SIZES: Record<ButtonSize, string> = {
  sm: 'h-9 px-4 text-[13px]',
  md: 'h-11 px-6 text-sm',
  lg: 'h-14 px-8 text-[15px]',
}

interface CommonProps {
  variant?: ButtonVariant
  size?: ButtonSize
  fullWidth?: boolean
  className?: string
  children?: ReactNode
}

export function buttonClasses({
  variant = 'primary',
  size = 'md',
  fullWidth,
  className,
}: CommonProps = {}): string {
  return cn(BASE, VARIANTS[variant], SIZES[size], fullWidth && 'w-full', className)
}

export interface ButtonProps
  extends CommonProps,
    Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'className' | 'children'> {
  isLoading?: boolean
  /** Rendered before the label. Hidden while loading. */
  icon?: ReactNode
  iconAfter?: ReactNode
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant, size, fullWidth, className, children, isLoading, icon, iconAfter, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      className={buttonClasses({ variant, size, fullWidth, className })}
      aria-busy={isLoading || undefined}
      {...rest}
    >
      {isLoading ? (
        <LoaderCircle className="size-4 animate-spin" aria-hidden />
      ) : (
        icon
      )}
      {children}
      {!isLoading && iconAfter}
    </button>
  )
})

export interface ButtonLinkProps extends CommonProps, Omit<LinkProps, 'className' | 'children'> {
  icon?: ReactNode
  iconAfter?: ReactNode
}

/** Same visual language as `Button`, but renders a router link. */
export function ButtonLink({
  variant,
  size,
  fullWidth,
  className,
  children,
  icon,
  iconAfter,
  ...rest
}: ButtonLinkProps) {
  return (
    <Link className={buttonClasses({ variant, size, fullWidth, className })} {...rest}>
      {icon}
      {children}
      {iconAfter}
    </Link>
  )
}
