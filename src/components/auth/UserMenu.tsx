import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { ChevronDown, LogOut, MapPinned, Sparkles, Ticket } from 'lucide-react'

import { useAuth } from '@/hooks'
import { ROUTES, cn } from '@/lib/utils'

const LINKS = [
  { to: ROUTES.trip, label: 'My trip', icon: MapPinned },
  { to: ROUTES.reservations, label: 'My bookings', icon: Ticket },
  { to: ROUTES.planner, label: 'Plan a new trip', icon: Sparkles },
] as const

/** Initials fallback when Google returned no picture, or it fails to load. */
function initialsOf(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('')
}

export interface UserMenuProps {
  onDark?: boolean
  className?: string
}

/** Avatar plus dropdown. Rendered only when a session exists. */
export function UserMenu({ onDark, className }: UserMenuProps) {
  const { displayName, avatarUrl, user, signOut } = useAuth()
  const [open, setOpen] = useState(false)
  const [imageFailed, setImageFailed] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  // Close on outside click and on Escape — a dropdown that traps focus in a
  // header is worse than no dropdown.
  useEffect(() => {
    if (!open) return

    const onPointerDown = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false)
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }

    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  const showImage = Boolean(avatarUrl) && !imageFailed

  const avatar = (size: string, text: string) => (
    <span
      className={cn(
        'flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-forest-800 font-medium text-ivory-50',
        size,
        text,
      )}
    >
      {showImage ? (
        <img
          src={avatarUrl as string}
          alt=""
          referrerPolicy="no-referrer"
          onError={() => setImageFailed(true)}
          className="size-full object-cover"
        />
      ) : (
        initialsOf(displayName)
      )}
    </span>
  )

  return (
    <div ref={containerRef} className={cn('relative', className)}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-haspopup="menu"
        className={cn(
          'flex items-center gap-2 rounded-full py-1 pl-1 pr-2.5 transition-colors duration-300',
          onDark ? 'hover:bg-white/10' : 'hover:bg-ivory-200',
        )}
      >
        {avatar('size-8', 'text-[11px]')}
        <span
          className={cn(
            'hidden max-w-28 truncate text-sm sm:block',
            onDark ? 'text-ivory-50' : 'text-forest-900',
          )}
        >
          {displayName}
        </span>
        <ChevronDown
          className={cn(
            'size-3.5 transition-transform duration-300',
            open && 'rotate-180',
            onDark ? 'text-ivory-50/60' : 'text-muted',
          )}
          aria-hidden
        />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            role="menu"
            initial={{ opacity: 0, y: -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.98 }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
            className="absolute right-0 top-full z-50 mt-2 w-60 origin-top-right overflow-hidden rounded-2xl border border-hairline bg-paper p-1.5 shadow-float"
          >
            <div className="flex items-center gap-3 px-3 py-3">
              {avatar('size-9', 'text-xs')}
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-forest-900">{displayName}</p>
                {user?.email && <p className="truncate text-xs text-muted">{user.email}</p>}
              </div>
            </div>

            <div className="my-1 h-px bg-hairline" />

            {LINKS.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                role="menuitem"
                onClick={() => setOpen(false)}
                className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-body transition-colors hover:bg-ivory-200 hover:text-forest-900"
              >
                <link.icon className="size-4 text-terracotta-500" aria-hidden />
                {link.label}
              </Link>
            ))}

            <div className="my-1 h-px bg-hairline" />

            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false)
                void signOut()
              }}
              className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-body transition-colors hover:bg-critical/[0.07] hover:text-critical"
            >
              <LogOut className="size-4" aria-hidden />
              Sign out
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
