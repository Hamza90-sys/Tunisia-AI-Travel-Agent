import {
  Compass,
  GlassWater,
  Landmark,
  Mountain,
  Moon,
  TreePine,
  UtensilsCrossed,
  WavesHorizontal,
  Bed,
  type LucideIcon,
} from 'lucide-react'

import type { PlaceCategory, PreferenceTag } from '@/types'

export interface CategoryMeta {
  id: PlaceCategory
  label: string
  blurb: string
  icon: LucideIcon
}

/** Discover page categories, in display order. */
export const PLACE_CATEGORY_META: CategoryMeta[] = [
  {
    id: 'beach',
    label: 'Beaches',
    blurb: 'Long sand, shallow turquoise water and quiet coves.',
    icon: WavesHorizontal,
  },
  {
    id: 'history',
    label: 'History',
    blurb: 'Three thousand years of Punic, Roman, Arab and Ottoman Tunisia.',
    icon: Landmark,
  },
  {
    id: 'food',
    label: 'Food',
    blurb: 'Medina kitchens, fish grills and the country of harissa.',
    icon: UtensilsCrossed,
  },
  {
    id: 'rooftop',
    label: 'Rooftops',
    blurb: 'Terraces above the medina, the cliffs and the gulf.',
    icon: GlassWater,
  },
  {
    id: 'nightlife',
    label: 'Nightlife',
    blurb: 'Marinas, bay bars and the long Mediterranean evening.',
    icon: Moon,
  },
  {
    id: 'nature',
    label: 'Nature',
    blurb: 'Wetlands, cork forests, mountain oases and cliffs.',
    icon: TreePine,
  },
  {
    id: 'adventure',
    label: 'Adventure',
    blurb: 'Dunes, salt flats and the edge of the Sahara.',
    icon: Mountain,
  },
  {
    id: 'stay',
    label: 'Stays',
    blurb: 'Dar guesthouses, design hotels and desert camps.',
    icon: Bed,
  },
]

export function getCategoryMeta(id: PlaceCategory): CategoryMeta {
  return PLACE_CATEGORY_META.find((category) => category.id === id) ?? PLACE_CATEGORY_META[0]
}

export interface PreferenceMeta {
  id: PreferenceTag
  label: string
  icon: LucideIcon
  /** Categories this preference pulls from when the planner builds a trip. */
  categories: PlaceCategory[]
}

/** Planner preference chips — the brief's six travel moods. */
export const PREFERENCE_META: PreferenceMeta[] = [
  { id: 'beaches', label: 'Beaches', icon: WavesHorizontal, categories: ['beach'] },
  { id: 'history', label: 'History', icon: Landmark, categories: ['history'] },
  { id: 'food', label: 'Food', icon: UtensilsCrossed, categories: ['food', 'rooftop'] },
  { id: 'nightlife', label: 'Nightlife', icon: Moon, categories: ['nightlife', 'rooftop'] },
  { id: 'nature', label: 'Nature', icon: TreePine, categories: ['nature'] },
  { id: 'adventure', label: 'Adventure', icon: Compass, categories: ['adventure'] },
]
