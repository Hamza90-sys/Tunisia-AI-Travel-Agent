/**
 * Data access layer.
 *
 * Every read returns the same envelope and every read has a local fallback:
 *
 *   { data, error, source: 'supabase' | 'local' }
 *
 * That keeps the UI honest (it can show where the data came from), keeps the
 * demo alive without credentials, and gives Step 2 one obvious place to add
 * the AI-generated trip reads and writes.
 */
import { supabase } from './client'
import { mapPlace, mapReservation, mapTrip } from './mappers'
import { DEMO_RESERVATIONS, DEMO_TRIP, PLACES } from '@/data'
import { assertEmbeddingShape, toVectorLiteral } from '@/lib/rag'
import type { ItineraryItemRow, TripDayRow } from '@/types/database'
import type { Place, PlaceCategory, Reservation, Trip } from '@/types'

export type DataSource = 'supabase' | 'local'

export interface QueryResult<T> {
  data: T
  error: string | null
  source: DataSource
}

function local<T>(data: T, error: string | null = null): QueryResult<T> {
  return { data, error, source: 'local' }
}

function remote<T>(data: T): QueryResult<T> {
  return { data, error: null, source: 'supabase' }
}

function message(error: unknown): string {
  if (error && typeof error === 'object' && 'message' in error) {
    return String((error as { message: unknown }).message)
  }
  return 'Unable to reach the catalogue right now.'
}

/* --- Places --------------------------------------------------------------- */

export interface PlaceQueryOptions {
  category?: PlaceCategory | 'all'
  search?: string
  featuredOnly?: boolean
  limit?: number
}

function filterLocalPlaces(options: PlaceQueryOptions): Place[] {
  const { category = 'all', search, featuredOnly, limit } = options
  const needle = search?.trim().toLowerCase()

  let results = PLACES
  if (category !== 'all') results = results.filter((place) => place.category === category)
  if (featuredOnly) results = results.filter((place) => place.isFeatured)
  if (needle) {
    results = results.filter((place) =>
      [place.name, place.city, place.summary, ...place.tags]
        .join(' ')
        .toLowerCase()
        .includes(needle),
    )
  }
  return limit ? results.slice(0, limit) : results
}

export async function fetchPlaces(
  options: PlaceQueryOptions = {},
): Promise<QueryResult<Place[]>> {
  if (!supabase) return local(filterLocalPlaces(options))

  try {
    let query = supabase.from('places').select('*')
    if (options.category && options.category !== 'all') {
      query = query.eq('category', options.category)
    }
    if (options.featuredOnly) query = query.eq('is_featured', true)
    if (options.search?.trim()) {
      const needle = `%${options.search.trim()}%`
      query = query.or(`name.ilike.${needle},city.ilike.${needle},summary.ilike.${needle}`)
    }
    if (options.limit) query = query.limit(options.limit)

    const { data, error } = await query.order('name')
    if (error) throw error
    // An empty table is a real (if unhelpful) answer; fall back so the demo
    // still shows the catalogue before the seed script has been run.
    if (!data?.length) return local(filterLocalPlaces(options))
    return remote(data.map(mapPlace))
  } catch (error) {
    return { data: filterLocalPlaces(options), error: message(error), source: 'local' }
  }
}

/* --- Semantic retrieval (RAG) --------------------------------------------- */

/** A catalogue place with the score that retrieved it. */
export interface ScoredPlace {
  place: Place
  /**
   * Cosine similarity in [-1, 1] when the result came from vector search; 1
   * means identical direction. Real text queries sit well above 0, but the
   * range is not clamped, so do not assume a floor of 0.
   * `null` when it came from the keyword fallback — the two are not comparable
   * and the caller should not pretend otherwise.
   */
  similarity: number | null
}

export interface MatchPlacesOptions {
  /**
   * Query embedding, already L2-normalised and `EMBEDDING_DIM` wide.
   * Produced by the caller (the agent), never by this module — the data layer
   * does not talk to an embedding provider.
   */
  embedding: number[]
  /** Original query text. Used only by the keyword fallback. */
  query?: string
  category?: PlaceCategory
  limit?: number
}

/**
 * Semantic search over the catalogue via the `match_places` RPC.
 *
 * Falls back to keyword filtering on the local catalogue whenever vector
 * retrieval cannot answer — no Supabase, the RPC errored, or `place_embeddings`
 * has not been populated yet. That last case matters: an un-run embedding
 * pipeline would otherwise make NOVA believe Tunisia has no beaches.
 */
export async function matchPlaces(
  options: MatchPlacesOptions,
): Promise<QueryResult<ScoredPlace[]>> {
  const { embedding, query, category, limit = 8 } = options

  const unscored = (): ScoredPlace[] =>
    filterLocalPlaces({ category: category ?? 'all', search: query, limit }).map((place) => ({
      place,
      similarity: null,
    }))

  if (!supabase) return local(unscored())

  try {
    assertEmbeddingShape(embedding, 'query embedding')

    const { data, error } = await supabase.rpc('match_places', {
      query_embedding: toVectorLiteral(embedding),
      match_count: limit,
      filter_category: category ?? null,
    })

    if (error) throw error
    if (!data?.length) return local(unscored())

    return remote(
      data.map((row) => ({
        place: mapPlace(row),
        similarity: row.similarity,
      })),
    )
  } catch (error) {
    return { data: unscored(), error: message(error), source: 'local' }
  }
}

/* --- Trips ---------------------------------------------------------------- */

/**
 * Loads the traveller's most recent trip with days, items and referenced
 * places. Three round-trips rather than one nested select, because the nested
 * form would need the FK names and is harder to reason about.
 */
export async function fetchActiveTrip(userId?: string | null): Promise<QueryResult<Trip | null>> {
  if (!supabase || !userId) return local(DEMO_TRIP)

  try {
    const { data: tripRow, error: tripError } = await supabase
      .from('trips')
      .select('*')
      .eq('user_id', userId)
      .in('status', ['planning', 'ready', 'active'])
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (tripError) throw tripError
    if (!tripRow) return local(DEMO_TRIP)

    const [{ data: dayRows }, { data: prefRows }] = await Promise.all([
      supabase.from('trip_days').select('*').eq('trip_id', tripRow.id).order('day_index'),
      supabase.from('trip_preferences').select('*').eq('trip_id', tripRow.id),
    ])

    const days = (dayRows ?? []) as TripDayRow[]
    let items: ItineraryItemRow[] = []

    if (days.length) {
      const { data: itemRows } = await supabase
        .from('itinerary_items')
        .select('*')
        .in(
          'trip_day_id',
          days.map((day) => day.id),
        )
        .order('order_index')
      items = (itemRows ?? []) as ItineraryItemRow[]
    }

    const placeIds = [...new Set(items.map((item) => item.place_id).filter(Boolean))] as string[]
    const placesById = new Map<string, Place>()
    if (placeIds.length) {
      const { data: placeRows } = await supabase.from('places').select('*').in('id', placeIds)
      for (const row of placeRows ?? []) placesById.set(row.id, mapPlace(row))
    }

    return remote(
      mapTrip(tripRow, {
        dayRows: days,
        itemRows: items,
        preferences: (prefRows ?? []).map((row) => row.preference),
        placesById,
      }),
    )
  } catch (error) {
    return { data: DEMO_TRIP, error: message(error), source: 'local' }
  }
}

/* --- Reservations --------------------------------------------------------- */

export async function fetchReservations(
  userId?: string | null,
): Promise<QueryResult<Reservation[]>> {
  if (!supabase || !userId) return local(DEMO_RESERVATIONS)

  try {
    const { data, error } = await supabase
      .from('reservations')
      .select('*')
      .eq('user_id', userId)
      .order('start_date', { ascending: true })

    if (error) throw error
    // A signed-in traveller with no bookings is a genuine empty state.
    return remote((data ?? []).map(mapReservation))
  } catch (error) {
    return { data: DEMO_RESERVATIONS, error: message(error), source: 'local' }
  }
}
