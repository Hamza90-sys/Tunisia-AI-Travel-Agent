/**
 * Trips, days and itinerary items.
 *
 * Deliberately relational: a trip has many days, a day has many itinerary
 * items, and an itinerary item may reference a place. This mirrors the
 * database schema so the AI agent can later patch a single item ("make
 * tomorrow cheaper") without rewriting a giant JSON blob.
 */
import type { Place } from './place'

export const TRIP_STATUSES = [
  'draft',
  'planning',
  'ready',
  'active',
  'completed',
  'archived',
] as const
export type TripStatus = (typeof TRIP_STATUSES)[number]

export const BUDGET_LEVELS = ['shoestring', 'balanced', 'elevated', 'luxury'] as const
export type BudgetLevel = (typeof BUDGET_LEVELS)[number]

/** Planner preference chips. Drives both the UI and `trip_preferences`. */
export const PREFERENCE_TAGS = [
  'beaches',
  'history',
  'food',
  'nightlife',
  'nature',
  'adventure',
] as const
export type PreferenceTag = (typeof PREFERENCE_TAGS)[number]

/** What kind of block an itinerary item is — drives the timeline icon. */
export const ITINERARY_KINDS = [
  'activity',
  'meal',
  'transfer',
  'stay',
  'experience',
  'free',
] as const
export type ItineraryKind = (typeof ITINERARY_KINDS)[number]

export interface ItineraryItem {
  id: string
  tripDayId: string
  /** 24h `HH:mm`. Null for unscheduled ideas parked on a day. */
  startTime: string | null
  endTime?: string | null
  title: string
  /** Secondary line, e.g. "Roman ruins · UNESCO". */
  subtitle?: string
  kind: ItineraryKind
  /** Resolved place, when the item points at the catalogue. */
  place?: Place
  placeId?: string | null
  notes?: string
  /** Per-person estimate in TND. */
  costEstimate?: number | null
  orderIndex: number
  /** True while NOVA is rewriting this block (used for optimistic UI). */
  isPending?: boolean
}

export interface TripDay {
  id: string
  tripId: string
  /** 1-based. Rendered as "DAY 01". */
  dayIndex: number
  /** ISO date `YYYY-MM-DD`. */
  date: string | null
  /** Anchor city for the day, e.g. "Tunis". */
  city: string
  /** Editorial one-liner, e.g. "Ruins, blue doors and a long sunset". */
  headline?: string
  items: ItineraryItem[]
}

export interface Trip {
  id: string
  userId: string | null
  title: string
  /** Country / destination label. Tunisia-only for now, but not hard-coded. */
  destination: string
  startDate: string | null
  endDate: string | null
  travelers: number
  budgetLevel: BudgetLevel
  status: TripStatus
  summary?: string
  preferences: PreferenceTag[]
  /** Ordered city route, e.g. ["Tunis", "Hammamet", "Sousse"]. */
  route: string[]
  mediaKey?: string
  days: TripDay[]
  createdAt?: string
  updatedAt?: string
}

/** Payload the planner collects before handing off to the AI agent. */
export interface TripDraft {
  prompt: string
  preferences: PreferenceTag[]
  travelers: number
  durationDays: number
  budgetLevel: BudgetLevel
  /**
   * ISO date `YYYY-MM-DD`, or null when the traveller has not picked one.
   *
   * Nullable by design: `trip_days.date` is nullable too, so the agent can
   * produce a route of relative days ("Day 01") that gets real dates later. The
   * UI already renders a null date as an em dash rather than a broken value.
   */
  startDate: string | null
}
