/**
 * Itinerary construction — deterministic.
 *
 * Adapted from the NOVA repository's `itineraryEngine`, keeping its useful
 * shape (a day is a city plus an ordered list of timed stops) and discarding
 * its hardcoded Tunisian day-plans and named properties, which were fixtures
 * rather than logic.
 *
 * Every decision here is arithmetic over catalogue data: which city a place is
 * in, how long a visit typically takes, and how far apart stops are. The model
 * chooses *what* to include; this decides *when*, and it is the only thing
 * allowed to put a time against a place.
 */
import { distanceKm, optimizeRoute } from './route.ts'
import type { RouteStop } from './route.ts'

export type Pace = 'relaxed' | 'balanced' | 'packed'

/** Visiting minutes available per day, before travel. */
const DAY_CAPACITY_MINUTES: Record<Pace, number> = {
  relaxed: 240,
  balanced: 360,
  packed: 480,
}

/** When the day starts, by pace. Relaxed travellers do not start at eight. */
const DAY_START_MINUTES: Record<Pace, number> = {
  relaxed: 10 * 60,
  balanced: 9 * 60 + 30,
  packed: 8 * 60 + 30,
}

/** Rough road speed used to turn kilometres into travel minutes. */
const AVERAGE_KMH = 65

export interface ItineraryCandidate extends RouteStop {
  /** Catalogue `typical_duration_minutes`, when known. */
  durationMinutes: number | null
  category: string
}

export interface ItineraryStop {
  slug: string
  name: string
  city: string
  category: string
  /** 24h `HH:mm`. */
  startTime: string
  endTime: string
  durationMinutes: number
  /** Travel from the previous stop, null for the first of the day. */
  travelFromPreviousKm: number | null
  travelFromPreviousMinutes: number | null
}

export interface ItineraryDay {
  dayIndex: number
  city: string
  stops: ItineraryStop[]
  visitingMinutes: number
  travelMinutes: number
}

export interface BuiltItinerary {
  days: ItineraryDay[]
  /** Candidates that did not fit inside the requested number of days. */
  unplacedSlugs: string[]
  totalDistanceKm: number
}

function minutesToClock(total: number): string {
  const hours = Math.floor(total / 60) % 24
  const minutes = Math.round(total % 60)
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`
}

/** Default visit length when the catalogue has none, by category. */
function fallbackDuration(category: string): number {
  if (category === 'food' || category === 'rooftop') return 90
  if (category === 'stay') return 60
  if (category === 'beach' || category === 'nature') return 150
  return 120
}

/**
 * Distributes candidates across days.
 *
 * Grouped by city first, because a day that hops between cities is a day spent
 * driving. Within a day the stops are route-optimised, then laid out on the
 * clock with real travel time between them.
 */
export function buildItinerary(
  candidates: ItineraryCandidate[],
  options: { days: number; pace: Pace },
): BuiltItinerary {
  const dayCount = Math.max(1, Math.trunc(options.days))
  const capacity = DAY_CAPACITY_MINUTES[options.pace]

  // Cities in the order the caller's list first mentions them.
  const byCity = new Map<string, ItineraryCandidate[]>()
  for (const candidate of candidates) {
    const bucket = byCity.get(candidate.city)
    if (bucket) bucket.push(candidate)
    else byCity.set(candidate.city, [candidate])
  }

  const queue: ItineraryCandidate[] = [...byCity.values()].flat()
  const days: ItineraryDay[] = []
  const unplaced: string[] = []
  let totalDistanceKm = 0
  let cursor = 0

  for (let dayIndex = 1; dayIndex <= dayCount && cursor < queue.length; dayIndex += 1) {
    const city = queue[cursor].city
    const picked: ItineraryCandidate[] = []
    let used = 0

    // Fill the day from this city until the clock runs out.
    while (cursor < queue.length && queue[cursor].city === city) {
      const candidate = queue[cursor]
      const duration = candidate.durationMinutes ?? fallbackDuration(candidate.category)
      if (used + duration > capacity && picked.length > 0) break
      picked.push(candidate)
      used += duration
      cursor += 1
    }

    if (!picked.length) break

    const route = optimizeRoute(picked)
    totalDistanceKm += route.totalDistanceKm

    const stops: ItineraryStop[] = []
    let clock = DAY_START_MINUTES[options.pace]
    let travelMinutes = 0

    route.order.forEach((stop, index) => {
      const candidate = picked.find((item) => item.slug === stop.slug)
      const duration = candidate?.durationMinutes ?? fallbackDuration(candidate?.category ?? '')

      let legKm: number | null = null
      let legMinutes: number | null = null
      if (index > 0) {
        legKm = distanceKm(route.order[index - 1], stop)
        legMinutes = Math.max(10, Math.round((legKm / AVERAGE_KMH) * 60))
        clock += legMinutes
        travelMinutes += legMinutes
      }

      stops.push({
        slug: stop.slug,
        name: stop.name,
        city: stop.city,
        category: candidate?.category ?? '',
        startTime: minutesToClock(clock),
        endTime: minutesToClock(clock + duration),
        durationMinutes: duration,
        travelFromPreviousKm: legKm,
        travelFromPreviousMinutes: legMinutes,
      })

      clock += duration
    })

    days.push({
      dayIndex,
      city,
      stops,
      visitingMinutes: used,
      travelMinutes,
    })
  }

  for (let i = cursor; i < queue.length; i += 1) unplaced.push(queue[i].slug)

  return { days, unplacedSlugs: unplaced, totalDistanceKm }
}
