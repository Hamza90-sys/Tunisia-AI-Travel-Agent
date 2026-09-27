import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'

import { AppShell } from '@/components/layout'
import { RequireAuth } from '@/components/auth'
import { NovaAvatar } from '@/components/nova'
import { ROUTES } from '@/lib/utils'

/**
 * Route table.
 *
 * Pages are code-split: the landing page is what most visitors see first, and
 * there is no reason to ship the planner, the dashboard and the catalogue with
 * it. Auth routes sit outside `AppShell` because they own the full viewport.
 *
 * `/trip` and `/reservations` render a traveller's own records, so both sit
 * behind `RequireAuth`, which offers the Google CTA instead of an empty shell.
 */
const LandingPage = lazy(() => import('@/pages/Landing'))
const PlannerPage = lazy(() => import('@/pages/Planner'))
const TripPage = lazy(() => import('@/pages/Trip'))
const DiscoverPage = lazy(() => import('@/pages/Discover'))
const ReservationsPage = lazy(() => import('@/pages/Reservations'))
const LoginPage = lazy(() => import('@/pages/Auth/Login'))
const AuthCallbackPage = lazy(() => import('@/pages/Auth/Callback'))
const NotFoundPage = lazy(() => import('@/pages/NotFound'))

function RouteFallback() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-canvas">
      <div className="flex flex-col items-center gap-5">
        <NovaAvatar state="thinking" size="lg" />
        <p className="text-sm text-ink-400">Loading your journey…</p>
      </div>
    </div>
  )
}

export default function App() {
  return (
    <Suspense fallback={<RouteFallback />}>
      <Routes>
        <Route element={<AppShell />}>
          <Route path={ROUTES.landing} element={<LandingPage />} />
          <Route path={ROUTES.planner} element={<PlannerPage />} />
          <Route
            path={ROUTES.trip}
            element={
              <RequireAuth
                title="Sign in to see your journey"
                description="Your itinerary lives in your account, so it survives closing the tab and follows you to your phone."
              >
                <TripPage />
              </RequireAuth>
            }
          />
          <Route path={ROUTES.discover} element={<DiscoverPage />} />
          <Route
            path={ROUTES.reservations}
            element={
              <RequireAuth
                title="Sign in to see your bookings"
                description="Stays, tables and experiences are tied to your account. Nobody else can see them."
              >
                <ReservationsPage />
              </RequireAuth>
            }
          />
          <Route path="*" element={<NotFoundPage />} />
        </Route>

        <Route path={ROUTES.login} element={<LoginPage />} />
        <Route path={ROUTES.authCallback} element={<AuthCallbackPage />} />

        {/* Google is the only provider, so every legacy auth path lands here. */}
        <Route path="/signup" element={<Navigate to={ROUTES.login} replace />} />
        <Route path="/signin" element={<Navigate to={ROUTES.login} replace />} />
      </Routes>
    </Suspense>
  )
}
