import { useState } from 'react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { LogOut, Menu, Search, X } from 'lucide-react'

import { Logo } from './Logo'
import { Container } from '@/components/ui'
import { useAuth, useLockBodyScroll, useScrolled } from '@/hooks'
import { ROUTES, cn } from '@/lib/utils'

/**
 * Nav destinations.
 *
 * "About" has no page of its own yet, so it anchors the feature strip on the
 * landing page rather than pointing at a route that does not exist.
 */
const NAV_LINKS = [
  { label: 'Home', to: ROUTES.landing },
  { label: 'Explore', to: ROUTES.discover },
  { label: 'Plan', to: ROUTES.planner },
  { label: 'About', to: `${ROUTES.landing}#about` },
] as const

/**
 * Editorial header.
 *
 * Spacious and quiet over the cream ground, gaining a hairline and a soft
 * backdrop once the page scrolls. On small screens it collapses to a mark plus
 * a single menu button which opens a full-height sheet, rather than letting
 * four links and three actions overflow.
 */
export function Navbar() {
  const { pathname, hash } = useLocation()
  const navigate = useNavigate()
  const scrolled = useScrolled(24)
  const { status, displayName, signOut } = useAuth()
  const [menuOpen, setMenuOpen] = useState(false)

  useLockBodyScroll(menuOpen)

  const isAuthenticated = status === 'authenticated'

  const isActive = (to: string) => {
    if (to.includes('#')) return pathname === ROUTES.landing && hash === '#about'
    if (to === ROUTES.landing) return pathname === ROUTES.landing && hash !== '#about'
    return pathname === to
  }

  return (
    <header
      className={cn(
        'fixed inset-x-0 top-0 z-40 transition-[background-color,border-color,backdrop-filter] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]',
        scrolled
          ? 'border-b border-hairline bg-page/90 backdrop-blur-xl'
          : 'border-b border-transparent bg-transparent',
      )}
    >
      <Container size="wide" className="flex h-16 items-center justify-between gap-6 lg:h-20">
        <Logo />

        {/* ------------------------------------------------ desktop centre */}
        <nav aria-label="Main" className="hidden lg:block">
          <ul className="flex items-center gap-9">
            {NAV_LINKS.map((link) => {
              const active = isActive(link.to)
              return (
                <li key={link.label}>
                  <NavLink
                    to={link.to}
                    className={cn(
                      'relative py-1 text-[15px] transition-colors duration-300',
                      active ? 'text-forest-900' : 'text-body hover:text-forest-900',
                    )}
                  >
                    {link.label}
                    {active && (
                      <motion.span
                        layoutId="nav-underline"
                        className="absolute -bottom-1 left-0 h-px w-full bg-forest-800"
                        transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                      />
                    )}
                  </NavLink>
                </li>
              )
            })}
          </ul>
        </nav>

        {/* ------------------------------------------------- desktop right */}
        <div className="hidden items-center gap-2 lg:flex">
          <button
            type="button"
            aria-label="Search places"
            onClick={() => navigate(ROUTES.discover)}
            className="flex size-10 items-center justify-center rounded-full text-forest-800 transition-colors duration-300 hover:bg-ivory-200"
          >
            <Search className="size-[18px]" strokeWidth={1.7} aria-hidden />
          </button>

          {isAuthenticated ? (
            <>
              <span className="px-2 text-sm text-body">{displayName}</span>
              <button
                type="button"
                onClick={() => void signOut()}
                className="inline-flex h-10 items-center gap-2 rounded-full px-4 text-sm text-body transition-colors duration-300 hover:bg-ivory-200 hover:text-forest-900"
              >
                <LogOut className="size-4" aria-hidden />
                Sign out
              </button>
            </>
          ) : (
            <>
              <NavLink
                to={ROUTES.login}
                className="inline-flex h-10 items-center rounded-full px-4 text-[15px] text-body transition-colors duration-300 hover:bg-ivory-200 hover:text-forest-900"
              >
                Log In
              </NavLink>
              <NavLink
                to={ROUTES.signup}
                className="inline-flex h-10 items-center rounded-full bg-forest-800 px-5 text-[15px] font-medium text-ivory-50 transition-all duration-300 hover:bg-forest-900 hover:shadow-hairline"
              >
                Get Started
              </NavLink>
            </>
          )}
        </div>

        {/* -------------------------------------------------- mobile right */}
        <div className="flex items-center gap-1 lg:hidden">
          <button
            type="button"
            aria-label="Search places"
            onClick={() => navigate(ROUTES.discover)}
            className="flex size-10 items-center justify-center rounded-full text-forest-800 transition-colors hover:bg-ivory-200"
          >
            <Search className="size-[18px]" strokeWidth={1.7} aria-hidden />
          </button>
          <button
            type="button"
            aria-label="Open menu"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen(true)}
            className="flex size-10 items-center justify-center rounded-full text-forest-800 transition-colors hover:bg-ivory-200"
          >
            <Menu className="size-5" strokeWidth={1.7} aria-hidden />
          </button>
        </div>
      </Container>

      <MobileSheet
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        isAuthenticated={isAuthenticated}
        displayName={displayName}
        onSignOut={() => void signOut()}
      />
    </header>
  )
}

function MobileSheet({
  open,
  onClose,
  isAuthenticated,
  displayName,
  onSignOut,
}: {
  open: boolean
  onClose: () => void
  isAuthenticated: boolean
  displayName: string
  onSignOut: () => void
}) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
          role="dialog"
          aria-modal="true"
          aria-label="Menu"
          className="fixed inset-0 z-50 bg-page lg:hidden"
        >
          <Container size="wide" className="flex h-16 items-center justify-between lg:h-20">
            <Logo />
            <button
              type="button"
              aria-label="Close menu"
              onClick={onClose}
              className="flex size-10 items-center justify-center rounded-full text-forest-800 transition-colors hover:bg-ivory-200"
            >
              <X className="size-5" aria-hidden />
            </button>
          </Container>

          <Container size="wide" className="pt-6">
            <nav aria-label="Main">
              <ul className="flex flex-col">
                {NAV_LINKS.map((link, index) => (
                  <motion.li
                    key={link.label}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.05 + index * 0.05, duration: 0.4 }}
                    className="border-b border-hairline"
                  >
                    <NavLink
                      to={link.to}
                      onClick={onClose}
                      className="block py-5 font-display text-3xl text-forest-900"
                    >
                      {link.label}
                    </NavLink>
                  </motion.li>
                ))}
              </ul>
            </nav>

            <div className="mt-10 flex flex-col gap-3">
              {isAuthenticated ? (
                <>
                  <p className="text-sm text-muted">Signed in as {displayName}</p>
                  <button
                    type="button"
                    onClick={() => {
                      onSignOut()
                      onClose()
                    }}
                    className="inline-flex h-12 items-center justify-center gap-2 rounded-full border border-hairline-strong text-[15px] text-forest-900"
                  >
                    <LogOut className="size-4" aria-hidden />
                    Sign out
                  </button>
                </>
              ) : (
                <>
                  <NavLink
                    to={ROUTES.signup}
                    onClick={onClose}
                    className="inline-flex h-12 items-center justify-center rounded-full bg-forest-800 text-[15px] font-medium text-ivory-50"
                  >
                    Get Started
                  </NavLink>
                  <NavLink
                    to={ROUTES.login}
                    onClick={onClose}
                    className="inline-flex h-12 items-center justify-center rounded-full border border-hairline-strong text-[15px] text-forest-900"
                  >
                    Log In
                  </NavLink>
                </>
              )}
            </div>
          </Container>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
