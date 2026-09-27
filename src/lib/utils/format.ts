/** Date, money and duration formatting. All display logic lives here. */

const DAY_MONTH = new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short' })
const WEEKDAY_LONG = new Intl.DateTimeFormat('en-GB', { weekday: 'long' })
const WEEKDAY_SHORT = new Intl.DateTimeFormat('en-GB', { weekday: 'short' })

function toDate(value: string | Date | null | undefined): Date | null {
  if (!value) return null
  const date = value instanceof Date ? value : new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

/** `2026-10-04` -> `Oct 04` */
export function formatShortDate(value: string | Date | null | undefined): string {
  const date = toDate(value)
  if (!date) return '—'
  // en-GB gives "04 Oct"; the product spec asks for "Oct 04".
  const [day, month] = DAY_MONTH.format(date).split(' ')
  return `${month} ${day}`
}

/** `Oct 04 — Oct 07` */
export function formatDateRange(
  start: string | Date | null | undefined,
  end: string | Date | null | undefined,
): string {
  const from = formatShortDate(start)
  const to = formatShortDate(end)
  if (from === '—' && to === '—') return 'Dates to be confirmed'
  if (to === '—' || from === to) return from
  return `${from} — ${to}`
}

export function formatWeekday(value: string | Date | null | undefined, short = false): string {
  const date = toDate(value)
  if (!date) return ''
  return (short ? WEEKDAY_SHORT : WEEKDAY_LONG).format(date)
}

/** Whole nights between two ISO dates. */
export function nightsBetween(
  start: string | Date | null | undefined,
  end: string | Date | null | undefined,
): number | null {
  const from = toDate(start)
  const to = toDate(end)
  if (!from || !to) return null
  const ms = to.getTime() - from.getTime()
  if (ms <= 0) return 0
  return Math.round(ms / 86_400_000)
}

/** Inclusive day count — a trip from the 4th to the 8th is 5 days. */
export function daysBetweenInclusive(
  start: string | Date | null | undefined,
  end: string | Date | null | undefined,
): number | null {
  const nights = nightsBetween(start, end)
  return nights === null ? null : nights + 1
}

/**
 * Local-time `YYYY-MM-DD`.
 *
 * Not `toISOString().slice(0, 10)` — that converts to UTC first, so anyone east
 * of Greenwich in the evening gets tomorrow's date in a date picker.
 */
export function toIsoDate(value: Date = new Date()): string {
  const year = value.getFullYear()
  const month = String(value.getMonth() + 1).padStart(2, '0')
  const day = String(value.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function formatCurrency(amount: number | null | undefined, currency = 'TND'): string {
  if (amount === null || amount === undefined) return '—'
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(amount)
}

/** `1` -> `$`, `4` -> `$$$$` */
export function formatPriceLevel(level: number | null | undefined): string {
  if (!level) return ''
  return '$'.repeat(Math.min(Math.max(level, 1), 4))
}

/** `150` -> `2h 30m` */
export function formatDuration(minutes: number | null | undefined): string {
  if (!minutes || minutes <= 0) return ''
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  if (!hours) return `${mins}m`
  if (!mins) return `${hours}h`
  return `${hours}h ${mins}m`
}

/** `09:00` -> `09:00` (kept 24h — matches the itinerary spec). */
export function formatTime(value: string | null | undefined): string {
  if (!value) return ''
  return value.slice(0, 5)
}

/** `1` -> `01` — used for the "DAY 01" treatment. */
export function padNumber(value: number, length = 2): string {
  return String(value).padStart(length, '0')
}

export function pluralize(count: number, singular: string, plural = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : plural}`
}
