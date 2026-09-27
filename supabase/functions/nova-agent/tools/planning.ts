/**
 * Planning tools: itinerary, budget, route.
 *
 * All three are deterministic. They take catalogue slugs, load the real rows,
 * and compute over real coordinates, durations and price levels. The model
 * decides *what* to plan; these decide the numbers, so no arithmetic is ever
 * produced by the language model.
 */
import { fetchPlacesBySlug } from './places.ts'
import { invalid } from './types.ts'
import type { CataloguePlace } from './places.ts'
import type { NovaTool, ToolResult } from './types.ts'
import { buildItinerary } from '../engines/itinerary.ts'
import type { ItineraryCandidate, Pace } from '../engines/itinerary.ts'
import { calculateBudget } from '../engines/budget.ts'
import type { BudgetLevel } from '../engines/budget.ts'
import { optimizeRoute } from '../engines/route.ts'
import type { RouteStop } from '../engines/route.ts'
import { readTripProfile, TRIP_PROFILE_SCHEMA, withDefaults } from '../profile.ts'

const PACES: Pace[] = ['relaxed', 'balanced', 'packed']
const BUDGET_LEVELS: BudgetLevel[] = ['shoestring', 'balanced', 'elevated', 'luxury']

const SLUGS_SCHEMA = {
  type: 'array',
  items: { type: 'string' },
  description: 'Place slugs from earlier search results, in the traveller’s preferred order.',
}

const PROFILE_SCHEMA = {
  ...TRIP_PROFILE_SCHEMA,
  description:
    'Facts learned from this traveller\'s conversation. Include only facts they stated; omit it when nothing is known.',
}

function readSlugs(value: unknown): string[] | null {
  if (!Array.isArray(value) || !value.length) return null
  const slugs = value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
  return slugs.length ? slugs.slice(0, 40).map((slug) => slug.trim()) : null
}

/** Only places with coordinates can be routed or scheduled. */
function toStops(places: CataloguePlace[]): RouteStop[] {
  return places
    .filter((place) => place.latitude !== null && place.longitude !== null)
    .map((place) => ({
      slug: place.slug,
      name: place.name,
      city: place.city,
      lat: place.latitude as number,
      lng: place.longitude as number,
    }))
}

export const optimizeRouteTool: NovaTool = {
  definition: {
    name: 'optimize_route',
    description:
      'Orders a set of catalogue places to shorten the driving between them, and returns real distances. Use whenever the traveller asks about order, driving or how far apart things are. Never estimate distances yourself.',
    parameters: {
      type: 'object',
      properties: { slugs: SLUGS_SCHEMA },
      required: ['slugs'],
    },
  },

  describe(args) {
    const count = Array.isArray(args.slugs) ? args.slugs.length : 0
    return `Working out the shortest route between ${count} places`
  },

  async execute(args, { db }): Promise<ToolResult> {
    const slugs = readSlugs(args.slugs)
    if (!slugs) return invalid('Missing required argument "slugs" (a non-empty array of slugs).')

    const places = await fetchPlacesBySlug(db, slugs)
    const stops = toStops(places)

    if (stops.length < 2) {
      return {
        ok: true,
        source: 'catalogue',
        data: { matched: stops.length },
        note: 'Fewer than two of those slugs are in the catalogue with coordinates, so there is no route to optimise.',
      }
    }

    const route = optimizeRoute(stops)

    return {
      ok: true,
      source: 'computed',
      data: {
        order: route.order.map((stop) => ({ slug: stop.slug, name: stop.name, city: stop.city })),
        legs: route.legs,
        totalDistanceKm: route.totalDistanceKm,
        savedKm: route.savedKm,
      },
      note: 'Straight-line distances between catalogue coordinates, not road distances or live traffic.',
    }
  },
}

export const buildItineraryTool: NovaTool = {
  definition: {
    name: 'build_itinerary',
    description:
      'Lays catalogue places across days with real timings, grouping by city and routing each day. Use once the traveller has settled on places and a number of days. Never invent times yourself.',
    parameters: {
      type: 'object',
      properties: {
        slugs: SLUGS_SCHEMA,
        days: { type: 'integer', minimum: 1, maximum: 21, description: 'Override durationDays when needed.' },
        pace: { type: 'string', enum: PACES },
        tripProfile: PROFILE_SCHEMA,
      },
      required: ['slugs'],
    },
  },

  describe(args) {
    const days = typeof args.days === 'number' ? args.days : '?'
    return `Building a ${days}-day itinerary`
  },

  async execute(args, { db }): Promise<ToolResult> {
    const slugs = readSlugs(args.slugs)
    if (!slugs) return invalid('Missing required argument "slugs" (a non-empty array of slugs).')

    const profile = readTripProfile(args.tripProfile)
    const requestedDays = args.days ?? profile?.durationDays
    if (typeof requestedDays !== 'number' || !Number.isFinite(requestedDays) || requestedDays < 1) {
      return invalid('Missing or invalid "days" (an integer of at least 1).')
    }
    const days = Math.min(Math.trunc(requestedDays), 21)

    let pace: Pace = withDefaults(profile).pace
    if (args.pace !== undefined && args.pace !== null) {
      if (typeof args.pace !== 'string' || !PACES.includes(args.pace as Pace)) {
        return invalid(`Invalid "pace". Expected one of: ${PACES.join(', ')}.`)
      }
      pace = args.pace as Pace
    }

    const places = await fetchPlacesBySlug(db, slugs)
    const stops = toStops(places)

    if (!stops.length) {
      return {
        ok: true,
        source: 'catalogue',
        data: { days: [] },
        note: 'None of those slugs are in the catalogue with coordinates. Search first, then build.',
      }
    }

    const byslug = new Map(places.map((place) => [place.slug, place]))
    const candidates: ItineraryCandidate[] = stops.map((stop) => {
      const place = byslug.get(stop.slug)
      return {
        ...stop,
        durationMinutes: place?.typicalDurationMinutes ?? null,
        category: place?.category ?? '',
      }
    })

    const itinerary = buildItinerary(candidates, { days, pace })

    return {
      ok: true,
      source: 'computed',
      data: {
        days: itinerary.days,
        unplacedSlugs: itinerary.unplacedSlugs,
        totalDistanceKm: itinerary.totalDistanceKm,
      },
      note: itinerary.unplacedSlugs.length
        ? 'Some places did not fit in the days given. Say which, rather than silently dropping them.'
        : undefined,
    }
  },
}

export const calculateBudgetTool: NovaTool = {
  definition: {
    name: 'calculate_budget',
    description:
      'Estimates a trip budget in Tunisian dinar, broken down by stay, transport, activities, food and extras. Use whenever money comes up. Never do the arithmetic yourself.',
    parameters: {
      type: 'object',
      properties: {
        travelers: { type: 'integer', minimum: 1, maximum: 12 },
        nights: { type: 'integer', minimum: 0, maximum: 30 },
        budgetLevel: { type: 'string', enum: BUDGET_LEVELS },
        slugs: {
          type: 'array',
          items: { type: 'string' },
          description: 'Planned places, so their price levels feed the activities line.',
        },
        targetTotalTnd: {
          type: 'number',
          description: 'The traveller’s stated ceiling in TND, if they gave one.',
        },
        tripProfile: PROFILE_SCHEMA,
      },
      required: [],
    },
  },

  describe(args) {
    const nights = typeof args.nights === 'number' ? args.nights : '?'
    return `Estimating a budget for ${nights} nights`
  },

  async execute(args, { db }): Promise<ToolResult> {
    const profile = readTripProfile(args.tripProfile)
    const requestedTravelers = args.travelers ?? profile?.travelers
    if (typeof requestedTravelers !== 'number' || !Number.isFinite(requestedTravelers) || requestedTravelers < 1) {
      return invalid('Missing or invalid "travelers" (an integer of at least 1).')
    }
    const requestedNights = args.nights ?? (profile?.durationDays ? profile.durationDays - 1 : undefined)
    if (typeof requestedNights !== 'number' || !Number.isFinite(requestedNights) || requestedNights < 0) {
      return invalid('Missing or invalid "nights" (an integer of at least 0).')
    }

    let budgetLevel: BudgetLevel = withDefaults(profile).budgetLevel
    if (args.budgetLevel !== undefined && args.budgetLevel !== null) {
      if (typeof args.budgetLevel !== 'string' || !BUDGET_LEVELS.includes(args.budgetLevel as BudgetLevel)) {
        return invalid(`Invalid "budgetLevel". Expected one of: ${BUDGET_LEVELS.join(', ')}.`)
      }
      budgetLevel = args.budgetLevel as BudgetLevel
    }

    let target: number | null = null
    if (typeof args.targetTotalTnd === 'number' && Number.isFinite(args.targetTotalTnd)) {
      target = args.targetTotalTnd
    } else if (profile?.budgetTotal !== undefined) {
      target = profile.budgetTotal
    }

    const slugs = readSlugs(args.slugs) ?? []
    const places = slugs.length ? await fetchPlacesBySlug(db, slugs) : []
    const activityPriceLevels = places
      .filter((place) => place.category !== 'stay' && place.priceLevel !== null)
      .map((place) => place.priceLevel as number)

    const breakdown = calculateBudget({
      travelers: Math.trunc(requestedTravelers),
      nights: Math.trunc(requestedNights),
      budgetLevel,
      activityPriceLevels,
      targetTotalTnd: target,
    })

    return {
      ok: true,
      source: 'computed',
      data: { budget: breakdown },
      note: 'An estimate from catalogue price levels and typical Tunisian costs. Not a quote, and not live pricing — say so.',
    }
  },
}
