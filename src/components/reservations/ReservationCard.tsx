import { motion } from 'framer-motion'
import { Bed, Clock, MapPin, Sparkles, Users, UtensilsCrossed } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

import { Badge, MediaFrame, StatusPill } from '@/components/ui'
import { fadeUp } from '@/animations'
import {
  cn,
  formatCurrency,
  formatDateRange,
  formatTime,
  pluralize,
} from '@/lib/utils'
import type { Reservation, ReservationType } from '@/types'

const TYPE_META: Record<ReservationType, { icon: LucideIcon; label: string }> = {
  hotel: { icon: Bed, label: 'Stay' },
  restaurant: { icon: UtensilsCrossed, label: 'Table' },
  experience: { icon: Sparkles, label: 'Experience' },
}

export interface ReservationCardProps {
  reservation: Reservation
  onSelect?: (reservation: Reservation) => void
  className?: string
}

/** One booking. Same card for hotels, restaurants and experiences. */
export function ReservationCard({ reservation, onSelect, className }: ReservationCardProps) {
  const meta = TYPE_META[reservation.type]
  const isCancelled = reservation.status === 'cancelled'

  return (
    <motion.article variants={fadeUp} className={className}>
      <div
        onClick={onSelect ? () => onSelect(reservation) : undefined}
        className={cn(
          'group flex flex-col gap-5 rounded-3xl border border-line bg-canvas-raised p-4 shadow-soft transition-[transform,box-shadow] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] sm:flex-row sm:items-stretch sm:p-5',
          onSelect && 'cursor-pointer hover:-translate-y-0.5 hover:shadow-card',
          isCancelled && 'opacity-65',
        )}
      >
        <MediaFrame
          mediaKey={reservation.mediaKey}
          ratio="landscape"
          rounded="rounded-2xl"
          className="sm:w-44 sm:shrink-0 sm:self-stretch"
        />

        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="neutral">
              <meta.icon className="size-3" aria-hidden />
              {meta.label}
            </Badge>
            <StatusPill status={reservation.status} />
          </div>

          <h3
            className={cn(
              'mt-3 text-xl leading-tight text-ink-800',
              isCancelled && 'line-through decoration-ink-300',
            )}
          >
            {reservation.title}
          </h3>

          <p className="mt-1.5 flex items-center gap-1.5 text-[13px] text-ink-400">
            <MapPin className="size-3.5" aria-hidden />
            {reservation.location}
          </p>

          <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-[13px] text-ink-600">
            <span>{formatDateRange(reservation.startDate, reservation.endDate)}</span>
            {reservation.nights ? (
              <span className="text-ink-400">{pluralize(reservation.nights, 'night')}</span>
            ) : null}
            {reservation.startTime && (
              <span className="flex items-center gap-1.5 text-ink-400">
                <Clock className="size-3.5" aria-hidden />
                {formatTime(reservation.startTime)}
              </span>
            )}
            <span className="flex items-center gap-1.5 text-ink-400">
              <Users className="size-3.5" aria-hidden />
              {reservation.partySize}
            </span>
          </div>

          <div className="mt-auto flex flex-wrap items-end justify-between gap-3 pt-5">
            <div className="text-xs text-ink-300">
              {reservation.confirmationCode ? (
                <span className="font-medium tracking-wide text-ink-500">
                  {reservation.confirmationCode}
                </span>
              ) : (
                <span>Awaiting confirmation</span>
              )}
              {reservation.notes && <p className="mt-1 max-w-sm text-ink-400">{reservation.notes}</p>}
            </div>

            {reservation.totalAmount !== null && reservation.totalAmount !== undefined && (
              <p className="font-display text-lg text-ink-800">
                {formatCurrency(reservation.totalAmount, reservation.currency)}
              </p>
            )}
          </div>
        </div>
      </div>
    </motion.article>
  )
}
