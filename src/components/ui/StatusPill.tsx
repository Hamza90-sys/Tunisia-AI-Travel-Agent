import { Badge } from './Badge'
import type { BadgeTone } from './Badge'
import type { ReservationStatus } from '@/types'

const STATUS_META: Record<ReservationStatus, { label: string; tone: BadgeTone }> = {
  confirmed: { label: 'Confirmed', tone: 'positive' },
  pending: { label: 'Pending', tone: 'caution' },
  cancelled: { label: 'Cancelled', tone: 'critical' },
  completed: { label: 'Completed', tone: 'neutral' },
}

export function StatusPill({ status }: { status: ReservationStatus }) {
  const meta = STATUS_META[status]
  return (
    <Badge tone={meta.tone}>
      <span
        className="size-1.5 rounded-full bg-current"
        aria-hidden
      />
      {meta.label}
    </Badge>
  )
}
