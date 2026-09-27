/**
 * Structured trip profile.
 *
 * Adapted from the NOVA repository's `nlpIntentEngine` concept of a typed trip
 * profile that deterministic services consume. The repository extracted it with
 * hand-written regexes over the user's text; here the model fills it in as tool
 * arguments, which is both more accurate and one less thing to maintain.
 *
 * Every field is optional. NOVA must never make a traveller complete a form
 * before it will help — natural language stays the interface, and the profile
 * is simply what has been learned so far.
 */

export type TravelerType = 'solo' | 'couple' | 'family' | 'friends' | 'business'
export type Pace = 'relaxed' | 'balanced' | 'packed'
export type BudgetLevel = 'shoestring' | 'balanced' | 'elevated' | 'luxury'

export interface TripProfile {
  /** Country or region. Tunisia today, but not assumed. */
  destination?: string
  /** Where the traveller is right now, if they said. */
  currentCity?: string
  durationDays?: number
  travelers?: number
  travelerType?: TravelerType
  budgetTotal?: number
  budgetLevel?: BudgetLevel
  currency?: 'TND'
  /** Free-form catalogue-aligned interests: history, beaches, food… */
  interests?: string[]
  pace?: Pace
  accommodationPreference?: string
  foodPreference?: string
  activityPreference?: string
}

/** JSON Schema fragment so tools can accept a partial profile as an argument. */
export const TRIP_PROFILE_SCHEMA: Record<string, unknown> = {
  type: 'object',
  description:
    'What is known about the trip so far, drawn from the conversation. Every field is optional; send only what the traveller has actually said.',
  properties: {
    destination: { type: 'string', description: 'Destination or region, if stated.' },
    currentCity: { type: 'string', description: 'Where the traveller is now, if stated.' },
    durationDays: { type: 'integer', minimum: 1, maximum: 30 },
    travelers: { type: 'integer', minimum: 1, maximum: 12 },
    travelerType: {
      type: 'string',
      enum: ['solo', 'couple', 'family', 'friends', 'business'],
    },
    budgetTotal: { type: 'number', description: 'Total budget in Tunisian dinar, if stated.' },
    budgetLevel: {
      type: 'string',
      enum: ['shoestring', 'balanced', 'elevated', 'luxury'],
    },
    interests: { type: 'array', items: { type: 'string' } },
    pace: { type: 'string', enum: ['relaxed', 'balanced', 'packed'] },
    accommodationPreference: { type: 'string' },
    foodPreference: { type: 'string' },
    activityPreference: { type: 'string' },
  },
}

/**
 * Keeps model-supplied profile data within the same bounds as tool arguments.
 * Unknown keys are discarded so a profile remains data, never instructions.
 */
export function readTripProfile(value: unknown): TripProfile | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined
  const input = value as Record<string, unknown>
  const profile: TripProfile = {}
  const output = profile as Record<string, unknown>

  const text = (key: keyof TripProfile): void => {
    const candidate = input[key]
    if (typeof candidate === 'string' && candidate.trim()) {
      output[key] = candidate.trim().slice(0, 160)
    }
  }

  text('destination')
  text('currentCity')
  text('accommodationPreference')
  text('foodPreference')
  text('activityPreference')

  if (typeof input.durationDays === 'number' && Number.isInteger(input.durationDays)) {
    profile.durationDays = Math.min(Math.max(input.durationDays, 1), 30)
  }
  if (typeof input.travelers === 'number' && Number.isInteger(input.travelers)) {
    profile.travelers = Math.min(Math.max(input.travelers, 1), 12)
  }
  if (typeof input.budgetTotal === 'number' && Number.isFinite(input.budgetTotal) && input.budgetTotal >= 0) {
    profile.budgetTotal = input.budgetTotal
  }
  if (['solo', 'couple', 'family', 'friends', 'business'].includes(String(input.travelerType))) {
    profile.travelerType = input.travelerType as TravelerType
  }
  if (['shoestring', 'balanced', 'elevated', 'luxury'].includes(String(input.budgetLevel))) {
    profile.budgetLevel = input.budgetLevel as BudgetLevel
  }
  if (['relaxed', 'balanced', 'packed'].includes(String(input.pace))) {
    profile.pace = input.pace as Pace
  }
  if (Array.isArray(input.interests)) {
    profile.interests = input.interests
      .filter((interest): interest is string => typeof interest === 'string' && interest.trim().length > 0)
      .slice(0, 12)
      .map((interest) => interest.trim().slice(0, 60))
  }

  return Object.keys(profile).length ? profile : undefined
}

/** Fills the gaps deterministic engines cannot leave empty. */
export function withDefaults(profile: TripProfile | undefined): Required<
  Pick<TripProfile, 'travelers' | 'budgetLevel' | 'pace' | 'currency'>
> {
  return {
    travelers: profile?.travelers ?? 2,
    budgetLevel: profile?.budgetLevel ?? 'balanced',
    pace: profile?.pace ?? 'balanced',
    currency: 'TND',
  }
}
