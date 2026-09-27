import { Outlet, useLocation } from 'react-router-dom'

import { Footer } from './Footer'
import { MobileNav } from './MobileNav'
import { Navbar } from './Navbar'
import { ScrollToTop } from './ScrollToTop'
import { NovaFloatingButton, NovaPanel } from '@/components/nova'
import { NOVA_ENABLED_ROUTES, ROUTES } from '@/lib/utils'

/**
 * Application shell: navigation, footer, and NOVA's global surface.
 *
 * NOVA is available on the routes where there is something to change — the
 * planner, the trip, the catalogue and the bookings — and stays out of the way
 * on the landing page, which has its own call to action.
 */
export function AppShell() {
  const { pathname } = useLocation()
  const novaEnabled = NOVA_ENABLED_ROUTES.includes(pathname)
  /*
   * The landing page is a marketing surface: the editorial header (and its
   * mobile sheet) is the navigation there. An app-style bottom tab bar
   * alongside it reads as two competing navigations, so it stays on the
   * in-product routes where it belongs.
   */
  const showMobileTabs = pathname !== ROUTES.landing

  return (
    <div className="flex min-h-dvh flex-col bg-page">
      <ScrollToTop />

      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-full focus:bg-forest-800 focus:px-5 focus:py-2.5 focus:text-sm focus:text-ivory-50"
      >
        Skip to content
      </a>

      <Navbar />

      <main id="main" className="flex flex-1 flex-col">
        <Outlet />
      </main>

      <Footer />
      {showMobileTabs && <MobileNav />}

      {novaEnabled && (
        <>
          <NovaFloatingButton />
          <NovaPanel />
        </>
      )}
    </div>
  )
}
