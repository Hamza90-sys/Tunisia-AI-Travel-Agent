/** Reservations — hotels, restaurants and experiences attached to a trip. */

export const RESERVATION_TYPES = ['hotel', 'restaurant', 'experience'] as const
export type ReservationType = (typeof RESERVATION_TYPES)[number]

export const RESERVATION_STATUSES = ['pending', 'confirmed', 'cancelled', 'completed'] as const
export type ReservationStatus = (typeof RESERVATION_STATUSES)[number]

export interface Reservation {
  id: string
  userId: string | null
  tripId: string | null
  type: ReservationType
  status: ReservationStatus
  /** Display name, e.g. "La Badira". */
  title: string
  /** City / area, e.g. "Hammamet". */
  location: string
  /** ISO date. For restaurants the check-out equals the check-in date. */
  startDate: string
  endDate: string
  /** `HH:mm`, restaurants and experiences only. */
  startTime?: string | null
  partySize: number
  /** Nights for hotels; derived, but stored so the UI never recomputes dates. */
  nights?: number | null
  totalAmount?: number | null
  currency: string
  confirmationCode?: string | null
  placeId?: string | null
  mediaKey?: string
  notes?: string
}
