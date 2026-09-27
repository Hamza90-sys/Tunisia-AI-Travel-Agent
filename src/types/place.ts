/**
 * Places — the curated catalogue of things to see, eat, sleep in and do.
 * Mirrors `public.places` in the database (see supabase/migrations).
 */

/** Discover categories. Kept as a const tuple so it can drive both types and UI. */
export const PLACE_CATEGORIES = [
  'beach',
  'history',
  'food',
  'rooftop',
  'nightlife',
  'nature',
  'adventure',
  'stay',
] as const

export type PlaceCategory = (typeof PLACE_CATEGORIES)[number]

/** 1 = budget friendly, 4 = luxury. Mirrors the common "$ → $$$$" convention. */
export type PriceLevel = 1 | 2 | 3 | 4

export interface Coordinates {
  lat: number
  lng: number
}

export interface Place {
  id: string
  /** URL-safe identifier, e.g. `sidi-bou-said`. */
  slug: string
  name: string
  category: PlaceCategory
  city: string
  region: string
  /** One-line hook shown on cards. */
  summary: string
  /** Long-form copy for the (future) place detail page. */
  description?: string
  coordinates?: Coordinates
  /**
   * Key into the media registry (`src/data/media.ts`) — NOT a URL.
   * Lets us swap procedural placeholders for curated photography, or for
   * Supabase Storage paths, without touching any component.
   */
  mediaKey?: string
  priceLevel?: PriceLevel
  /** 0–5, one decimal. */
  rating?: number
  reviewCount?: number
  /** Free-form descriptors: "unesco", "sunset", "family-friendly", … */
  tags: string[]
  isFeatured?: boolean
  /** Typical time travellers spend here, in minutes. Used by the planner. */
  typicalDurationMinutes?: number
}

export interface PlaceCategoryMeta {
  id: PlaceCategory
  label: string
  /** Short description used on the Discover page. */
  blurb: string
  /** Tailwind classes for the category's accent treatment. */
  accentClass: string
}
