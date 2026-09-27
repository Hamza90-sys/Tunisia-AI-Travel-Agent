import type { Coordinates } from '@/types'

/**
 * Coarse Tunisia outline, clockwise from the north-west coast.
 *
 * Real coordinates, deliberately low-resolution: enough for the schematic
 * route map, small enough to ship inline. When a real map library lands in
 * Step 2 this is simply deleted — the itinerary already stores true lat/lng,
 * so nothing else has to change.
 */
export const TUNISIA_OUTLINE: Coordinates[] = [
  { lat: 37.2, lng: 8.6 },
  { lat: 37.28, lng: 9.2 },
  { lat: 37.35, lng: 9.75 },
  { lat: 37.26, lng: 10.2 },
  { lat: 36.95, lng: 10.32 },
  { lat: 36.82, lng: 10.3 },
  { lat: 37.05, lng: 10.82 },
  { lat: 37.08, lng: 11.03 },
  { lat: 36.62, lng: 10.9 },
  { lat: 36.4, lng: 10.62 },
  { lat: 35.83, lng: 10.64 },
  { lat: 35.5, lng: 11.07 },
  { lat: 34.74, lng: 10.76 },
  { lat: 34.3, lng: 10.1 },
  { lat: 33.88, lng: 10.1 },
  { lat: 33.7, lng: 10.9 },
  { lat: 33.18, lng: 11.22 },
  { lat: 32.3, lng: 11.5 },
  { lat: 30.23, lng: 9.52 },
  { lat: 32.0, lng: 9.0 },
  { lat: 33.0, lng: 8.1 },
  { lat: 34.0, lng: 7.85 },
  { lat: 34.5, lng: 8.1 },
  { lat: 35.2, lng: 8.3 },
  { lat: 36.0, lng: 8.3 },
  { lat: 36.5, lng: 8.45 },
]

/** Anchor cities used by route visualisation and the (future) map. */
export const CITY_COORDINATES: Record<string, Coordinates> = {
  Tunis: { lat: 36.8065, lng: 10.1815 },
  Carthage: { lat: 36.8528, lng: 10.3233 },
  'Sidi Bou Said': { lat: 36.8712, lng: 10.3475 },
  'La Marsa': { lat: 36.8783, lng: 10.325 },
  Gammarth: { lat: 36.9167, lng: 10.2886 },
  'La Goulette': { lat: 36.8183, lng: 10.3053 },
  Bizerte: { lat: 37.2744, lng: 9.8739 },
  Tabarka: { lat: 36.9544, lng: 8.758 },
  Hammamet: { lat: 36.4, lng: 10.6167 },
  Nabeul: { lat: 36.4513, lng: 10.7357 },
  Sousse: { lat: 35.8256, lng: 10.6394 },
  Monastir: { lat: 35.7643, lng: 10.8113 },
  Mahdia: { lat: 35.5047, lng: 11.0622 },
  'El Jem': { lat: 35.2967, lng: 10.7069 },
  Kairouan: { lat: 35.6781, lng: 10.0963 },
  Sfax: { lat: 34.7406, lng: 10.7603 },
  Gabes: { lat: 33.8815, lng: 10.0982 },
  Djerba: { lat: 33.8076, lng: 10.8451 },
  Tozeur: { lat: 33.9197, lng: 8.1336 },
  Matmata: { lat: 33.5439, lng: 9.9667 },
  'Ksar Ghilane': { lat: 32.9833, lng: 9.6333 },
  Teboursouk: { lat: 36.4589, lng: 9.2444 },
}

export function getCityCoordinates(city: string): Coordinates | undefined {
  return CITY_COORDINATES[city]
}
