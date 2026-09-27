import { getPlaceBySlug } from './places'
import type { ItineraryItem, Trip, TripDay } from '@/types'

/**
 * Demo trip used by the Trip dashboard until a real trip is generated.
 *
 * Note the shape: trip -> days -> items, with items pointing at catalogue
 * places by slug. Nothing about "5 days in Tunisia" is baked into a component,
 * so the AI agent can build exactly this structure in Step 2.
 */

type ItemSeed = Omit<ItineraryItem, 'id' | 'tripDayId' | 'orderIndex' | 'place'> & {
  placeSlug?: string
}

interface DaySeed {
  date: string
  city: string
  headline: string
  items: ItemSeed[]
}

const DAY_SEEDS: DaySeed[] = [
  {
    date: '2026-10-04',
    city: 'Tunis',
    headline: 'Ruins in the morning, blue doors at golden hour.',
    items: [
      {
        startTime: '09:00',
        endTime: '11:30',
        title: 'Carthage',
        subtitle: 'Antonine Baths & the Punic ports',
        kind: 'activity',
        placeSlug: 'carthage',
        costEstimate: 12,
      },
      {
        startTime: '12:30',
        endTime: '14:00',
        title: 'Lunch',
        subtitle: 'Fish grills on the La Goulette front',
        kind: 'meal',
        placeSlug: 'la-goulette-grills',
        costEstimate: 45,
      },
      {
        startTime: '15:00',
        endTime: '17:30',
        title: 'Sidi Bou Said',
        subtitle: 'Cobbled lanes up to the clifftop',
        kind: 'activity',
        placeSlug: 'sidi-bou-said',
        costEstimate: 0,
      },
      {
        startTime: '18:30',
        endTime: '19:30',
        title: 'Sunset',
        subtitle: 'Terrace above the Gulf of Tunis',
        kind: 'experience',
        placeSlug: 'sidi-bou-terraces',
        costEstimate: 18,
      },
      {
        startTime: '20:30',
        endTime: '22:30',
        title: 'Dinner',
        subtitle: 'Tunisian tasting menu in the medina',
        kind: 'meal',
        placeSlug: 'dar-el-jeld',
        costEstimate: 120,
      },
    ],
  },
  {
    date: '2026-10-05',
    city: 'Tunis',
    headline: 'The medina, slowly, then mosaics out of the heat.',
    items: [
      {
        startTime: '09:30',
        endTime: '12:30',
        title: 'Medina of Tunis',
        subtitle: 'Souks, Zitouna, rooftop of the perfume market',
        kind: 'activity',
        placeSlug: 'medina-of-tunis',
        costEstimate: 0,
      },
      {
        startTime: '13:00',
        endTime: '14:00',
        title: 'Lunch',
        subtitle: 'Lablabi at a medina counter',
        kind: 'meal',
        costEstimate: 15,
      },
      {
        startTime: '15:00',
        endTime: '17:00',
        title: 'Bardo National Museum',
        subtitle: 'The Roman mosaic collection',
        kind: 'activity',
        placeSlug: 'bardo-museum',
        costEstimate: 13,
      },
      {
        startTime: '19:30',
        endTime: '21:30',
        title: 'Evening in Gammarth',
        subtitle: 'Bay terraces north of the city',
        kind: 'experience',
        placeSlug: 'gammarth-bay',
        costEstimate: 60,
      },
    ],
  },
  {
    date: '2026-10-06',
    city: 'Hammamet',
    headline: 'South along the coast. Nothing scheduled after lunch.',
    items: [
      {
        startTime: '09:00',
        endTime: '10:30',
        title: 'Transfer to Hammamet',
        subtitle: 'Coast road, 65 km',
        kind: 'transfer',
        costEstimate: 40,
      },
      {
        startTime: '11:00',
        title: 'Check in at La Badira',
        subtitle: 'Adults-only, above the bay',
        kind: 'stay',
        placeSlug: 'la-badira',
      },
      {
        startTime: '13:00',
        endTime: '17:00',
        title: 'Hammamet South Beach',
        subtitle: 'Sand, shallows and the old kasbah',
        kind: 'activity',
        placeSlug: 'hammamet-beach',
        costEstimate: 20,
      },
      {
        startTime: '21:00',
        endTime: '23:30',
        title: 'Yasmine Marina',
        subtitle: 'Promenade and late bars',
        kind: 'experience',
        placeSlug: 'yasmine-marina',
        costEstimate: 50,
      },
    ],
  },
  {
    date: '2026-10-07',
    city: 'Hammamet',
    headline: 'A day out to the arena, back for the pool.',
    items: [
      {
        startTime: '08:30',
        endTime: '10:00',
        title: 'Drive to El Jem',
        subtitle: '130 km south',
        kind: 'transfer',
        costEstimate: 70,
      },
      {
        startTime: '10:15',
        endTime: '12:15',
        title: 'El Jem Amphitheatre',
        subtitle: 'The upper tiers and the underground corridors',
        kind: 'activity',
        placeSlug: 'el-jem-amphitheatre',
        costEstimate: 13,
      },
      {
        startTime: '13:00',
        endTime: '14:30',
        title: 'Lunch',
        subtitle: 'Simple grill near the arena',
        kind: 'meal',
        costEstimate: 30,
      },
      {
        startTime: '16:30',
        title: 'Free afternoon',
        subtitle: 'Hotel spa or the beach',
        kind: 'free',
      },
    ],
  },
  {
    date: '2026-10-08',
    city: 'Sousse',
    headline: 'Last stop: walled medina, ribat tower, marina at dusk.',
    items: [
      {
        startTime: '10:00',
        endTime: '11:00',
        title: 'Transfer to Sousse',
        subtitle: 'Coast road, 80 km',
        kind: 'transfer',
        costEstimate: 45,
      },
      {
        startTime: '11:30',
        endTime: '14:00',
        title: 'Sousse Medina & Ribat',
        subtitle: 'Walls, souk and the watchtower climb',
        kind: 'activity',
        placeSlug: 'sousse-medina',
        costEstimate: 10,
      },
      {
        startTime: '15:00',
        endTime: '18:00',
        title: 'Beach time',
        subtitle: 'North of the port',
        kind: 'free',
      },
      {
        startTime: '19:30',
        endTime: '22:00',
        title: 'Port El Kantaoui',
        subtitle: 'Dinner and the marina after dark',
        kind: 'experience',
        placeSlug: 'port-el-kantaoui',
        costEstimate: 75,
      },
    ],
  },
]

const TRIP_ID = 'trip-demo-tunisia'

function buildDays(tripId: string, seeds: DaySeed[]): TripDay[] {
  return seeds.map((seed, dayIdx) => {
    const id = `${tripId}-day-${dayIdx + 1}`
    return {
      id,
      tripId,
      dayIndex: dayIdx + 1,
      date: seed.date,
      city: seed.city,
      headline: seed.headline,
      items: seed.items.map((item, itemIdx) => {
        const { placeSlug, ...rest } = item
        return {
          ...rest,
          id: `${id}-item-${itemIdx + 1}`,
          tripDayId: id,
          orderIndex: itemIdx,
          place: placeSlug ? getPlaceBySlug(placeSlug) : undefined,
          placeId: placeSlug ? (getPlaceBySlug(placeSlug)?.id ?? null) : null,
        }
      }),
    }
  })
}

export const DEMO_TRIP: Trip = {
  id: TRIP_ID,
  userId: null,
  title: 'Your journey',
  destination: 'Tunisia',
  startDate: '2026-10-04',
  endDate: '2026-10-08',
  travelers: 2,
  budgetLevel: 'elevated',
  status: 'ready',
  summary:
    'Five days from the ruins of Carthage to the marina at Sousse, with two slow afternoons built in.',
  preferences: ['history', 'beaches', 'food'],
  route: ['Tunis', 'Hammamet', 'Sousse'],
  mediaKey: 'trip-cover',
  days: buildDays(TRIP_ID, DAY_SEEDS),
}

/** Total estimated spend per traveller, in TND. */
export function getTripEstimate(trip: Trip): number {
  return trip.days.reduce(
    (total, day) =>
      total + day.items.reduce((sum, item) => sum + (item.costEstimate ?? 0), 0),
    0,
  )
}

/** Every catalogue place referenced by the itinerary, in visiting order. */
export function getTripPlaces(trip: Trip) {
  return trip.days.flatMap((day) =>
    day.items.map((item) => item.place).filter((place) => place !== undefined),
  )
}
