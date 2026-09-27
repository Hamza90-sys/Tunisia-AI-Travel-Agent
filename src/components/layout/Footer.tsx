import { Link } from 'react-router-dom'

import { Logo } from './Logo'
import { Container } from '@/components/ui'
import { APP_NAME, ROUTES } from '@/lib/utils'

const COLUMNS = [
  {
    title: 'Journey',
    links: [
      { label: 'Plan a trip', to: ROUTES.planner },
      { label: 'My trip', to: ROUTES.trip },
      { label: 'Reservations', to: ROUTES.reservations },
    ],
  },
  {
    title: 'Tunisia',
    links: [
      { label: 'Explore', to: ROUTES.discover },
      { label: 'Beaches', to: `${ROUTES.discover}?category=beach` },
      { label: 'History', to: `${ROUTES.discover}?category=history` },
    ],
  },
  {
    title: 'Account',
    links: [
      { label: 'Log in', to: ROUTES.login },
      { label: 'Get started', to: ROUTES.signup },
    ],
  },
]

/**
 * Editorial footer.
 *
 * Deep forest ground closes the cream page rather than the old navy. Extra
 * bottom padding clears the fixed mobile tab bar.
 */
export function Footer() {
  return (
    <footer className="mt-auto bg-forest-900 text-ivory-100">
      <Container size="wide" className="pb-24 pt-16 md:py-20">
        <div className="grid gap-12 md:grid-cols-[1.4fr_repeat(3,1fr)]">
          <div className="max-w-sm">
            <Logo onDark />
            <p className="mt-5 text-sm leading-relaxed text-ivory-100/65">
              Tunisia, planned in conversation. NOVA learns what you like, builds the route and
              keeps the whole journey in one place.
            </p>
          </div>

          {COLUMNS.map((column) => (
            <nav key={column.title} aria-label={column.title}>
              <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-terracotta-300">
                {column.title}
              </p>
              <ul className="mt-4 space-y-2.5">
                {column.links.map((link) => (
                  <li key={link.label}>
                    <Link
                      to={link.to}
                      className="text-sm text-ivory-100/70 transition-colors hover:text-ivory-50"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        <div className="mt-14 flex flex-col gap-3 border-t border-ivory-100/12 pt-7 text-xs text-ivory-100/45 sm:flex-row sm:items-center sm:justify-between">
          <p>{APP_NAME} — prototype. Places are curated; bookings are not yet live.</p>
          <p>Built for the Mediterranean.</p>
        </div>
      </Container>
    </footer>
  )
}
