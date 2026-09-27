/**
 * Media registry — the single swap-in point for photography.
 *
 * Components never hard-code image URLs. They reference a `mediaKey`, and this
 * registry decides what is rendered:
 *
 *   1. `storagePath` set  -> public URL from the Supabase `place-media` bucket
 *   2. `src` set          -> a curated, licensed remote image
 *   3. neither            -> designed procedural artwork (see MediaPlaceholder)
 *
 * Step 1 ships with (3) everywhere on purpose: the prototype stays offline-safe
 * and free of low-quality stock imagery. Dropping in curated Tunisia
 * photography later is a one-line change per slot — no component edits.
 */

/** Colour story of a slot. Drives the placeholder gradient + any overlays. */
export type MediaTone = 'sea' | 'medina' | 'desert' | 'night' | 'garden' | 'stone'

/** Abstract motif drawn inside the placeholder artwork. */
export type MediaMotif = 'waves' | 'arches' | 'dunes' | 'skyline' | 'terrace' | 'peaks'

export interface MediaSlot {
  /** Intrinsic pixel size, when known. Lets an <img> reserve space. */
  width?: number
  height?: number
  /** Curated remote image. Leave null until real photography is licensed. */
  src: string | null
  /** Object path inside the Supabase Storage `place-media` bucket. */
  storagePath?: string | null
  /** Always required — placeholders are decorative, photos are not. */
  alt: string
  tone: MediaTone
  motif: MediaMotif
  /** CSS object-position, for when a real photo needs a focal point. */
  focus?: string
}

function slot(
  alt: string,
  tone: MediaTone,
  motif: MediaMotif,
  overrides: Partial<MediaSlot> = {},
): MediaSlot {
  return { src: null, storagePath: null, alt, tone, motif, ...overrides }
}

export const MEDIA: Record<string, MediaSlot> = {
  /* --- Brand / editorial slots -------------------------------------------
     The three hero photographs are real, licensed assets supplied with the
     design board and committed under public/images/hero. Every shape, border,
     shadow, rotation and label around them is CSS — nothing is baked in. */
  'hero-coast': slot('Whitewashed village above the Mediterranean, palms and bougainvillea over a turquoise bay', 'sea', 'waves', {
    src: '/images/hero/hero-tunisia.webp',
    width: 1536,
    height: 1024,
  }),
  'hero-blue-doors': slot('A cobbled lane of white Tunisian houses with vivid blue doors and bougainvillea, the sea beyond', 'medina', 'terrace', {
    src: '/images/hero/hero-sidi-bou-said.webp',
    width: 1448,
    height: 1086,
  }),
  'hero-el-jem': slot('The Roman amphitheatre at El Jem, its tiered stone arches under a clear sky', 'stone', 'arches', {
    src: '/images/hero/hero-el-jem.webp',
    width: 1448,
    height: 1086,
  }),
  'hero-medina': slot('Whitewashed alleys of a Tunisian medina', 'medina', 'arches'),
  'hero-sahara': slot('Dunes on the edge of the Sahara', 'desert', 'dunes'),
  'trip-cover': slot('Tunisia, coast to desert', 'sea', 'skyline'),

  /* --- Places ------------------------------------------------------------ */
  carthage: slot('Roman columns above the bay of Carthage', 'stone', 'arches'),
  'sidi-bou-said': slot('Blue doors and white walls of Sidi Bou Said', 'medina', 'terrace'),
  'medina-of-tunis': slot('Covered souks of the Tunis medina', 'medina', 'arches'),
  'bardo-museum': slot('Roman mosaics at the Bardo', 'stone', 'arches'),
  'el-jem-amphitheatre': slot('The amphitheatre of El Jem', 'stone', 'arches'),
  dougga: slot('The Capitol at Dougga', 'stone', 'peaks'),
  'kairouan-great-mosque': slot('Courtyard of the Great Mosque of Kairouan', 'stone', 'arches'),
  'hammamet-beach': slot('Long sand beach at Hammamet', 'sea', 'waves'),
  'sidi-mahrez-beach': slot('Shallow turquoise water off Djerba', 'sea', 'waves'),
  'tabarka-coast': slot('Needle rocks off Tabarka', 'sea', 'peaks'),
  'cap-angela': slot('Cliffs at the northernmost point of Africa', 'sea', 'peaks'),
  'ichkeul-park': slot('Wetlands of Ichkeul National Park', 'garden', 'peaks'),
  'chebika-oasis': slot('Mountain oasis of Chebika', 'desert', 'peaks'),
  'ksar-ghilane': slot('Desert camp at Ksar Ghilane', 'desert', 'dunes'),
  matmata: slot('Troglodyte houses of Matmata', 'desert', 'dunes'),
  'dar-el-jeld': slot('Dining room of a restored medina house', 'medina', 'arches'),
  'la-goulette-grills': slot('Fish grills along the La Goulette front', 'sea', 'skyline'),
  'sousse-medina': slot('Ribat and medina of Sousse', 'stone', 'skyline'),
  'sidi-bou-terraces': slot('Clifftop terraces above the gulf', 'sea', 'terrace'),
  'gammarth-bay': slot('Evening on Gammarth bay', 'night', 'terrace'),
  'port-el-kantaoui': slot('Marina at Port El Kantaoui after dark', 'night', 'skyline'),
  'yasmine-marina': slot('Yasmine Hammamet marina at night', 'night', 'skyline'),

  /* --- Stays ------------------------------------------------------------- */
  'la-badira': slot('Adults-only retreat above Hammamet bay', 'sea', 'terrace'),
  'villa-didon': slot('Design hotel overlooking Carthage', 'stone', 'terrace'),
  'dar-hi': slot('Palm-grove hideaway in Tozeur', 'desert', 'dunes'),
}

export function getMedia(key: string | null | undefined): MediaSlot | null {
  if (!key) return null
  return MEDIA[key] ?? null
}
