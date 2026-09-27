/**
 * Budget estimation — deterministic, in Tunisian dinar.
 *
 * Adapted from the NOVA repository's `budgetEngine`: the useful idea there is
 * the category breakdown (stay / transport / activities / food / extras) plus
 * an over-or-under-budget verdict. Three things from that implementation were
 * deliberately left behind:
 *
 *   • its hardcoded US-dollar constants and static exchange-rate table;
 *   • advice strings naming specific hotels ("switch from Hasdrubal to
 *     Marillia Yasmine to save $360") — those properties are not in this
 *     catalogue, so quoting them would be invention;
 *   • the implied precision. Nothing here is a quoted price.
 *
 * Everything below is an ESTIMATE derived from the catalogue's 1-4 price level
 * and the trip's shape. It is never presented as a live or bookable price, and
 * the result carries `basis: 'estimate'` so the model cannot forget that.
 */

/** Per-person, per-day activity spend by catalogue price level, in TND. */
const ACTIVITY_TND_BY_PRICE_LEVEL: Record<number, number> = {
  1: 15,
  2: 40,
  3: 90,
  4: 180,
}

/** Nightly accommodation by budget level, in TND, for a standard double. */
const STAY_TND_PER_NIGHT: Record<BudgetLevel, number> = {
  shoestring: 90,
  balanced: 220,
  elevated: 480,
  luxury: 950,
}

/** Food per person per day, in TND. */
const FOOD_TND_PER_PERSON_DAY: Record<BudgetLevel, number> = {
  shoestring: 35,
  balanced: 70,
  elevated: 130,
  luxury: 220,
}

/** Ground transport per day for the party, in TND. */
const TRANSPORT_TND_PER_DAY: Record<BudgetLevel, number> = {
  shoestring: 25,
  balanced: 60,
  elevated: 140,
  luxury: 260,
}

export type BudgetLevel = 'shoestring' | 'balanced' | 'elevated' | 'luxury'

export interface BudgetInput {
  travelers: number
  nights: number
  budgetLevel: BudgetLevel
  /** Catalogue price levels of the planned activities, one entry per visit. */
  activityPriceLevels: number[]
  /** Optional ceiling the traveller stated, in TND. */
  targetTotalTnd?: number | null
}

export interface BudgetBreakdown {
  currency: 'TND'
  basis: 'estimate'
  travelers: number
  nights: number
  stayTnd: number
  transportTnd: number
  activitiesTnd: number
  foodTnd: number
  extrasTnd: number
  totalTnd: number
  perTravelerTnd: number
  targetTotalTnd: number | null
  remainingTnd: number | null
  isOverBudget: boolean | null
}

export function calculateBudget(input: BudgetInput): BudgetBreakdown {
  const travelers = Math.max(1, Math.trunc(input.travelers))
  const nights = Math.max(0, Math.trunc(input.nights))
  const days = Math.max(1, nights + 1)
  const level = input.budgetLevel

  // One room per two travellers, rounded up.
  const rooms = Math.ceil(travelers / 2)
  const stayTnd = STAY_TND_PER_NIGHT[level] * nights * rooms

  const transportTnd = TRANSPORT_TND_PER_DAY[level] * days

  const activitiesTnd = input.activityPriceLevels.reduce(
    (total, priceLevel) => total + (ACTIVITY_TND_BY_PRICE_LEVEL[priceLevel] ?? 0) * travelers,
    0,
  )

  const foodTnd = FOOD_TND_PER_PERSON_DAY[level] * travelers * days

  // Tickets, tips, water, a coffee that turns into three. Ten per cent of the
  // rest is a better estimate than a fixed number at any trip length.
  const extrasTnd = Math.round((stayTnd + transportTnd + activitiesTnd + foodTnd) * 0.1)

  const totalTnd = stayTnd + transportTnd + activitiesTnd + foodTnd + extrasTnd
  const target = input.targetTotalTnd ?? null

  return {
    currency: 'TND',
    basis: 'estimate',
    travelers,
    nights,
    stayTnd,
    transportTnd,
    activitiesTnd,
    foodTnd,
    extrasTnd,
    totalTnd,
    perTravelerTnd: Math.round(totalTnd / travelers),
    targetTotalTnd: target,
    remainingTnd: target === null ? null : target - totalTnd,
    isOverBudget: target === null ? null : totalTnd > target,
  }
}
