/**
 * Database types for the Supabase client.
 *
 * Hand-written to match `supabase/migrations/*.sql`. Once the project is
 * linked you can regenerate this file instead of maintaining it by hand:
 *
 *   npx supabase gen types typescript --linked > src/types/database.ts
 */
import type { PlaceCategory } from './place'
import type { BudgetLevel, ItineraryKind, PreferenceTag, TripStatus } from './trip'
import type { ReservationStatus, ReservationType } from './reservation'

/**
 * Builds the Row / Insert / Update triple Supabase expects.
 * `TOptional` lists the columns that have a database default.
 */
type TableDef<TRow, TOptional extends keyof TRow = never> = {
  Row: TRow
  Insert: Omit<TRow, TOptional> & Partial<Pick<TRow, TOptional>>
  Update: Partial<TRow>
  Relationships: []
}

export type ProfileRow = {
  id: string
  full_name: string | null
  avatar_url: string | null
  home_country: string | null
  locale: string
  created_at: string
  updated_at: string
}

export type PlaceRow = {
  id: string
  slug: string
  name: string
  category: PlaceCategory
  city: string
  region: string
  summary: string
  description: string | null
  latitude: number | null
  longitude: number | null
  media_key: string | null
  price_level: number | null
  rating: number | null
  review_count: number | null
  tags: string[]
  typical_duration_minutes: number | null
  is_featured: boolean
  created_at: string
}

export type TripRow = {
  id: string
  user_id: string
  title: string
  destination: string
  start_date: string | null
  end_date: string | null
  travelers: number
  budget_level: BudgetLevel
  status: TripStatus
  summary: string | null
  route: string[]
  media_key: string | null
  /** The traveller's own words. Kept as the seed for AI regeneration. */
  source_prompt: string | null
  created_at: string
  updated_at: string
}

export type TripPreferenceRow = {
  trip_id: string
  preference: PreferenceTag
}

export type TripDayRow = {
  id: string
  trip_id: string
  day_index: number
  date: string | null
  city: string
  headline: string | null
  created_at: string
}

export type ItineraryItemRow = {
  id: string
  trip_day_id: string
  place_id: string | null
  kind: ItineraryKind
  title: string
  subtitle: string | null
  start_time: string | null
  end_time: string | null
  notes: string | null
  cost_estimate: number | null
  order_index: number
  created_at: string
  updated_at: string
}

export type ReservationRow = {
  id: string
  user_id: string
  trip_id: string | null
  place_id: string | null
  type: ReservationType
  status: ReservationStatus
  title: string
  location: string
  start_date: string
  end_date: string
  start_time: string | null
  party_size: number
  nights: number | null
  total_amount: number | null
  currency: string
  confirmation_code: string | null
  media_key: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

export type SavedPlaceRow = {
  user_id: string
  place_id: string
  created_at: string
}

export type NovaConversationRow = {
  id: string
  user_id: string
  trip_id: string | null
  title: string | null
  /**
   * Most recent Gemini interaction id. Passed back as `previous_interaction_id`
   * to resume server-side conversation state instead of replaying history.
   */
  provider_interaction_id: string | null
  created_at: string
}

export type NovaMessageRow = {
  id: string
  conversation_id: string
  role: 'user' | 'nova' | 'system'
  content: string
  /** What the model asked for — Gemini `function_call` steps. */
  tool_calls: unknown | null
  /** What our tools returned — mirrors `tool_calls`. Audit/display only. */
  tool_results: unknown | null
  created_at: string
}

/**
 * A stored vector for one catalogue place.
 *
 * `embedding` is typed as `string` because PostgREST serialises pgvector values
 * as their text literal (`"[0.1,0.2,…]"`), not as a JSON array. In practice the
 * browser never selects this table at all — RLS denies it, and retrieval goes
 * through the `match_places` RPC.
 */
export type PlaceEmbeddingRow = {
  id: string
  place_id: string
  model: string
  dim: number
  embedding: string
  content_hash: string
  created_at: string
}

/**
 * The `places` columns every consumer actually maps.
 *
 * `created_at` is excluded because nothing in the UI reads it, and because
 * `match_places` does not return it — this lets `mapPlace` accept both a full
 * table row and an RPC row with no casting.
 */
export type PlaceRowFields = Omit<PlaceRow, 'created_at'>

/** One row returned by the `match_places` RPC: catalogue columns + score. */
export type MatchedPlaceRow = PlaceRowFields & {
  /**
   * Cosine similarity in [-1, 1]; 1 is an exact directional match.
   *
   * Not [0, 1]: pgvector's `<=>` is cosine *distance* over [0, 2], so
   * `1 - distance` can legitimately be negative for an opposing vector.
   */
  similarity: number
}

export interface Database {
  public: {
    Tables: {
      profiles: TableDef<ProfileRow, 'created_at' | 'updated_at' | 'locale'>
      places: TableDef<PlaceRow, 'id' | 'created_at' | 'tags' | 'is_featured'>
      trips: TableDef<
        TripRow,
        'id' | 'created_at' | 'updated_at' | 'route' | 'status' | 'budget_level' | 'travelers'
      >
      trip_preferences: TableDef<TripPreferenceRow>
      trip_days: TableDef<TripDayRow, 'id' | 'created_at'>
      itinerary_items: TableDef<
        ItineraryItemRow,
        'id' | 'created_at' | 'updated_at' | 'order_index' | 'kind'
      >
      reservations: TableDef<
        ReservationRow,
        'id' | 'created_at' | 'updated_at' | 'status' | 'currency' | 'party_size'
      >
      saved_places: TableDef<SavedPlaceRow, 'created_at'>
      nova_conversations: TableDef<
        NovaConversationRow,
        'id' | 'created_at' | 'provider_interaction_id'
      >
      nova_messages: TableDef<
        NovaMessageRow,
        'id' | 'created_at' | 'tool_calls' | 'tool_results'
      >
      place_embeddings: TableDef<PlaceEmbeddingRow, 'id' | 'created_at'>
    }
    Views: Record<never, never>
    Functions: {
      /**
       * Semantic search over the public catalogue.
       *
       * `query_embedding` is the pgvector text literal (`"[0.1,0.2,…]"`), not a
       * JSON array — build it with `toVectorLiteral()` from `@/lib/rag` so the
       * encoding is identical on every call site.
       */
      match_places: {
        Args: {
          query_embedding: string
          match_count?: number
          filter_category?: PlaceCategory | null
        }
        Returns: MatchedPlaceRow[]
      }
    }
    Enums: {
      place_category: PlaceCategory
      trip_status: TripStatus
      budget_level: BudgetLevel
      preference_tag: PreferenceTag
      itinerary_kind: ItineraryKind
      reservation_type: ReservationType
      reservation_status: ReservationStatus
      nova_message_role: 'user' | 'nova' | 'system'
    }
    CompositeTypes: Record<never, never>
  }
}

/**
 * Note: the row types above are object type aliases rather than interfaces on
 * purpose. Supabase's `GenericTable` constraint requires each Row to satisfy
 * `Record<string, unknown>`, and only type aliases get an implicit index
 * signature — declaring them as interfaces silently degrades every query's
 * result type to `never`.
 */
