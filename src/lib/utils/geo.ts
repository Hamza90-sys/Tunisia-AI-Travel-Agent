import { TUNISIA_BOUNDS } from './constants'
import type { Coordinates } from '@/types'

/**
 * Projects a lat/lng onto a 0–100 viewport percentage inside the Tunisia
 * bounding box. Good enough for the schematic route map, and it means the real
 * coordinates we store are already the ones a proper map will consume.
 */
export function projectToViewport({ lat, lng }: Coordinates): { x: number; y: number } {
  const { minLat, maxLat, minLng, maxLng } = TUNISIA_BOUNDS
  const x = ((lng - minLng) / (maxLng - minLng)) * 100
  // SVG/CSS y grows downwards, latitude grows upwards.
  const y = ((maxLat - lat) / (maxLat - minLat)) * 100
  return {
    x: Math.min(Math.max(x, 0), 100),
    y: Math.min(Math.max(y, 0), 100),
  }
}

/** Great-circle distance in kilometres. */
export function distanceKm(a: Coordinates, b: Coordinates): number {
  const R = 6371
  const dLat = ((b.lat - a.lat) * Math.PI) / 180
  const dLng = ((b.lng - a.lng) * Math.PI) / 180
  const lat1 = (a.lat * Math.PI) / 180
  const lat2 = (b.lat * Math.PI) / 180
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2
  return Math.round(2 * R * Math.asin(Math.sqrt(h)))
}
