/** Product-level constants. Anything a judge might ask "where is this set?". */

export const APP_NAME = 'TuniTravel'
export const AI_NAME = 'NOVA'
export const AI_TAGLINE = 'Your Tunisia AI'

/**
 * `login` is the only auth route. There is no sign-up route: Google is the
 * single identity provider, and the first sign-in creates the account.
 * `authCallback` is where Google returns the traveller.
 */
export const ROUTES = {
  landing: '/',
  planner: '/planner',
  trip: '/trip',
  discover: '/discover',
  reservations: '/reservations',
  login: '/login',
  authCallback: '/auth/callback',
} as const

export type AppRoute = (typeof ROUTES)[keyof typeof ROUTES]

/** Routes where the floating NOVA button is available. */
export const NOVA_ENABLED_ROUTES: readonly string[] = [
  ROUTES.planner,
  ROUTES.trip,
  ROUTES.discover,
  ROUTES.reservations,
]

export const DEFAULT_CURRENCY = 'TND'
export const DEFAULT_DESTINATION = 'Tunisia'

/** Geographic frame used by the map placeholder to project coordinates. */
export const TUNISIA_BOUNDS = {
  minLat: 30.2,
  maxLat: 37.6,
  minLng: 7.5,
  maxLng: 11.6,
} as const
