/**
 * Route optimisation — deterministic, over real coordinates.
 *
 * Adapted from the NOVA repository's `rankingAndOptimizationEngine` concept of
 * ordering a day's stops. The repository resolved distances from a hand-written
 * `TUNISIA_DISTANCES` lookup table; this computes great-circle distance from
 * the `latitude`/`longitude` already stored on every catalogue place, so the
 * numbers come from data rather than from a table someone maintained by hand.
 *
 * The model never calculates a distance. It asks for one.
 */

export interface RouteStop {
  slug: string
  name: string
  city: string
  lat: number
  lng: number
}

export interface RouteLeg {
  fromSlug: string
  toSlug: string
  distanceKm: number
}

export interface OptimizedRoute {
  order: RouteStop[]
  legs: RouteLeg[]
  totalDistanceKm: number
  /** Kilometres saved against the order the caller supplied. */
  savedKm: number
}

/** Great-circle distance in kilometres, rounded to the nearest km. */
export function distanceKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371
  const dLat = ((b.lat - a.lat) * Math.PI) / 180
  const dLng = ((b.lng - a.lng) * Math.PI) / 180
  const lat1 = (a.lat * Math.PI) / 180
  const lat2 = (b.lat * Math.PI) / 180
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2
  return Math.round(2 * R * Math.asin(Math.sqrt(h)))
}

function pathLength(stops: RouteStop[]): number {
  let total = 0
  for (let i = 1; i < stops.length; i += 1) total += distanceKm(stops[i - 1], stops[i])
  return total
}

/**
 * Orders stops to shorten the drive.
 *
 * Nearest-neighbour for a starting tour, then 2-opt to undo the crossings
 * nearest-neighbour characteristically leaves behind. This is an open path, not
 * a loop — travellers do not return to the first stop — so no closing leg is
 * counted.
 *
 * Exact TSP is unnecessary here: itineraries are a handful of stops, and 2-opt
 * reaches the optimum or very near it at that size for a fraction of the code.
 */
export function optimizeRoute(stops: RouteStop[]): OptimizedRoute {
  if (stops.length <= 2) {
    return {
      order: [...stops],
      legs: buildLegs(stops),
      totalDistanceKm: pathLength(stops),
      savedKm: 0,
    }
  }

  const original = pathLength(stops)

  // Nearest neighbour from the caller's first stop, which is usually where the
  // traveller already is.
  const remaining = stops.slice(1)
  const tour: RouteStop[] = [stops[0]]

  while (remaining.length) {
    const last = tour[tour.length - 1]
    let bestIndex = 0
    let bestDistance = Number.POSITIVE_INFINITY
    remaining.forEach((candidate, index) => {
      const d = distanceKm(last, candidate)
      if (d < bestDistance) {
        bestDistance = d
        bestIndex = index
      }
    })
    tour.push(remaining.splice(bestIndex, 1)[0])
  }

  // 2-opt: reverse any segment that shortens the path, until nothing helps.
  let improved = true
  let guard = 0
  while (improved && guard < 64) {
    improved = false
    guard += 1
    for (let i = 1; i < tour.length - 1; i += 1) {
      for (let k = i + 1; k < tour.length; k += 1) {
        const candidate = [...tour.slice(0, i), ...tour.slice(i, k + 1).reverse(), ...tour.slice(k + 1)]
        if (pathLength(candidate) < pathLength(tour) - 0.5) {
          tour.splice(0, tour.length, ...candidate)
          improved = true
        }
      }
    }
  }

  const total = pathLength(tour)
  return {
    order: tour,
    legs: buildLegs(tour),
    totalDistanceKm: total,
    savedKm: Math.max(0, original - total),
  }
}

function buildLegs(stops: RouteStop[]): RouteLeg[] {
  const legs: RouteLeg[] = []
  for (let i = 1; i < stops.length; i += 1) {
    legs.push({
      fromSlug: stops[i - 1].slug,
      toSlug: stops[i].slug,
      distanceKm: distanceKm(stops[i - 1], stops[i]),
    })
  }
  return legs
}
