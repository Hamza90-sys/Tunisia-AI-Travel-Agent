import { NavLink } from 'react-router-dom'
import { Compass, MapPinned, Sparkles, Ticket } from 'lucide-react'

import { ROUTES, cn } from '@/lib/utils'

const TABS = [
  { to: ROUTES.planner, label: 'Plan', icon: Sparkles },
  { to: ROUTES.trip, label: 'Trip', icon: MapPinned },
  { to: ROUTES.discover, label: 'Discover', icon: Compass },
  { to: ROUTES.reservations, label: 'Bookings', icon: Ticket },
] as const

/**
 * Mobile navigation.
 *
 * A native-feeling bottom tab bar rather than a shrunken desktop menu — the
 * four destinations a traveller actually moves between on a phone.
 */
export function MobileNav() {
  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-hairline bg-page/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl md:hidden"
    >
      <ul className="grid grid-cols-4">
        {TABS.map((tab) => (
          <li key={tab.to}>
            <NavLink
              to={tab.to}
              className={({ isActive }) =>
                cn(
                  'flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium transition-colors duration-300',
                  isActive ? 'text-forest-900' : 'text-muted',
                )
              }
            >
              {({ isActive }) => (
                <>
                  <span
                    className={cn(
                      'flex size-9 items-center justify-center rounded-full transition-colors duration-300',
                      isActive && 'bg-terracotta-500/12',
                    )}
                  >
                    <tab.icon className="size-[18px]" aria-hidden />
                  </span>
                  {tab.label}
                </>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}
