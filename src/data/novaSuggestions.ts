import { CircleDollarSign, Moon, UtensilsCrossed, WavesHorizontal } from 'lucide-react'

import type { NovaPlanningStep, NovaSuggestion } from '@/types'

/** Quick actions offered in the NOVA panel. Each maps to a Step 2 capability. */
export const NOVA_SUGGESTIONS: NovaSuggestion[] = [
  { id: 'cheaper', label: 'Make tomorrow cheaper.', intent: 'budget', icon: CircleDollarSign },
  { id: 'add-beach', label: 'Add a beach.', intent: 'add-place', icon: WavesHorizontal },
  { id: 'dinner', label: 'Find dinner near me.', intent: 'find-food', icon: UtensilsCrossed },
  { id: 'no-nightlife', label: 'Remove nightlife.', intent: 'remove-category', icon: Moon },
]

/** Steps shown while NOVA composes an itinerary. */
export const NOVA_PLANNING_STEPS: NovaPlanningStep[] = [
  { id: 'beach', label: 'Beach experiences', detail: 'Coast matched to your dates' },
  { id: 'history', label: 'Historical places', detail: 'UNESCO sites near your route' },
  { id: 'budget', label: 'Budget', detail: 'Balanced against your nights' },
  { id: 'distance', label: 'Travel distance', detail: 'Under 90 minutes between stops' },
]
