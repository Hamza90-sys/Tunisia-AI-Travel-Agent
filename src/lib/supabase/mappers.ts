/**
 * Row -> domain mappers.
 *
 * Postgres speaks snake_case and stores flat rows; the UI wants camelCase and
 * nested objects. Keeping the translation in one place means components never
 * learn the database shape.
 */
import type {
  ItineraryItemRow,
  PlaceRowFields,
  ReservationRow,
  TripDayRow,
  TripRow,
} from '@/types/database'
import type {
  ItineraryItem,
  Place,
  PriceLevel,
  Reservation,
  Trip,
  TripDay,
  PreferenceTag,
} from '@/types'

/**
 * Accepts `PlaceRowFields` rather than `PlaceRow` so the same mapper serves a
 * plain `select('*')` and a `match_places` RPC row, which omits `created_at`.
 */
export function mapPlace(row: PlaceRowFields): Place {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    category: row.category,
    city: row.city,
    region: row.region,
    summary: row.summary,
    description: row.description ?? undefined,
    coordinates:
      row.latitude !== null && row.longitude !== null
        ? { lat: row.latitude, lng: row.longitude }
        : undefined,
    mediaKey: row.media_key ?? undefined,
    priceLevel: (row.price_level as PriceLevel | null) ?? undefined,
    rating: row.rating ?? undefined,
    reviewCount: row.review_count ?? undefined,
    tags: row.tags ?? [],
    typicalDurationMinutes: row.typical_duration_minutes ?? undefined,
    isFeatured: row.is_featured,
  }
}

export function mapItineraryItem(
  row: ItineraryItemRow,
  placesById: Map<string, Place>,
): ItineraryItem {
  return {
    id: row.id,
    tripDayId: row.trip_day_id,
    startTime: row.start_time,
    endTime: row.end_time,
    title: row.title,
    subtitle: row.subtitle ?? undefined,
    kind: row.kind,
    placeId: row.place_id,
    place: row.place_id ? placesById.get(row.place_id) : undefined,
    notes: row.notes ?? undefined,
    costEstimate: row.cost_estimate,
    orderIndex: row.order_index,
  }
}

export function mapTripDay(
  row: TripDayRow,
  items: ItineraryItemRow[],
  placesById: Map<string, Place>,
): TripDay {
  return {
    id: row.id,
    tripId: row.trip_id,
    dayIndex: row.day_index,
    date: row.date,
    city: row.city,
    headline: row.headline ?? undefined,
    items: items
      .filter((item) => item.trip_day_id === row.id)
      .sort((a, b) => a.order_index - b.order_index)
      .map((item) => mapItineraryItem(item, placesById)),
  }
}

export function mapTrip(
  row: TripRow,
  options: {
    dayRows?: TripDayRow[]
    itemRows?: ItineraryItemRow[]
    preferences?: PreferenceTag[]
    placesById?: Map<string, Place>
  } = {},
): Trip {
  const { dayRows = [], itemRows = [], preferences = [], placesById = new Map() } = options
  return {
    id: row.id,
    userId: row.user_id,
    title: row.title,
    destination: row.destination,
    startDate: row.start_date,
    endDate: row.end_date,
    travelers: row.travelers,
    budgetLevel: row.budget_level,
    status: row.status,
    summary: row.summary ?? undefined,
    preferences,
    route: row.route ?? [],
    mediaKey: row.media_key ?? undefined,
    days: dayRows
      .sort((a, b) => a.day_index - b.day_index)
      .map((day) => mapTripDay(day, itemRows, placesById)),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export function mapReservation(row: ReservationRow): Reservation {
  return {
    id: row.id,
    userId: row.user_id,
    tripId: row.trip_id,
    type: row.type,
    status: row.status,
    title: row.title,
    location: row.location,
    startDate: row.start_date,
    endDate: row.end_date,
    startTime: row.start_time,
    partySize: row.party_size,
    nights: row.nights,
    totalAmount: row.total_amount,
    currency: row.currency,
    confirmationCode: row.confirmation_code,
    placeId: row.place_id,
    mediaKey: row.media_key ?? undefined,
    notes: row.notes ?? undefined,
  }
}
