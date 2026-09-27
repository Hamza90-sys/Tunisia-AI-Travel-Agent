/**
 * Generates `supabase/seed.sql` from the local catalogue in `src/data/places.ts`.
 *
 * The TypeScript catalogue is the single source of truth: it drives the UI when
 * Supabase is not configured, and it drives the seed when it is. Run with
 * `npm run db:seed` after editing places.
 */
import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

import { PLACES } from '../src/data/places'

const quote = (value: string | null | undefined) =>
  value === null || value === undefined ? 'null' : `'${value.replace(/'/g, "''")}'`

const num = (value: number | null | undefined) =>
  value === null || value === undefined ? 'null' : String(value)

const arr = (values: string[]) =>
  values.length ? `array[${values.map(quote).join(', ')}]::text[]` : `'{}'::text[]`

const rows = PLACES.map((place) =>
  [
    quote(place.slug),
    quote(place.name),
    `${quote(place.category)}::public.place_category`,
    quote(place.city),
    quote(place.region),
    quote(place.summary),
    quote(place.description ?? null),
    num(place.coordinates?.lat),
    num(place.coordinates?.lng),
    quote(place.mediaKey ?? null),
    num(place.priceLevel),
    num(place.rating),
    num(place.reviewCount),
    arr(place.tags),
    num(place.typicalDurationMinutes),
    place.isFeatured ? 'true' : 'false',
  ].join(', '),
).map((row) => `  (${row})`)

const sql = `-- =============================================================================
-- TuniTravel — catalogue seed
--
-- GENERATED FILE — do not edit by hand.
-- Source: src/data/places.ts   Regenerate: npm run db:seed
--
-- Landmarks and districts are real. Hotel and venue entries are prototype seed
-- data for the demo and should be replaced with verified partner listings
-- before anything is presented as bookable.
-- =============================================================================

insert into public.places (
  slug, name, category, city, region, summary, description,
  latitude, longitude, media_key, price_level, rating, review_count,
  tags, typical_duration_minutes, is_featured
) values
${rows.join(',\n')}
on conflict (slug) do update set
  name                     = excluded.name,
  category                 = excluded.category,
  city                     = excluded.city,
  region                   = excluded.region,
  summary                  = excluded.summary,
  description              = excluded.description,
  latitude                 = excluded.latitude,
  longitude                = excluded.longitude,
  media_key                = excluded.media_key,
  price_level              = excluded.price_level,
  rating                   = excluded.rating,
  review_count             = excluded.review_count,
  tags                     = excluded.tags,
  typical_duration_minutes = excluded.typical_duration_minutes,
  is_featured              = excluded.is_featured;
`

const outPath = resolve(dirname(fileURLToPath(import.meta.url)), '../supabase/seed.sql')
writeFileSync(outPath, sql, 'utf8')
console.log(`Wrote ${PLACES.length} places to supabase/seed.sql`)
