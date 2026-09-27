import { motion } from 'framer-motion'
import {
  Bed,
  Car,
  Coffee,
  Landmark,
  MapPin,
  Sparkles,
  Star,
  UtensilsCrossed,
  type LucideIcon,
} from 'lucide-react'

import { Badge, MediaFrame } from '@/components/ui'
import { fadeUp } from '@/animations'
import { cn, formatCurrency, formatTime } from '@/lib/utils'
import type { ItineraryItem, ItineraryKind } from '@/types'

const KIND_META: Record<ItineraryKind, { icon: LucideIcon; label: string }> = {
  activity: { icon: Landmark, label: 'Visit' },
  meal: { icon: UtensilsCrossed, label: 'Table' },
  transfer: { icon: Car, label: 'Transfer' },
  stay: { icon: Bed, label: 'Stay' },
  experience: { icon: Sparkles, label: 'Experience' },
  free: { icon: Coffee, label: 'Free time' },
}

export interface ActivityCardProps {
  item: ItineraryItem
  /** Dims the card when it belongs to a past day. */
  isPast?: boolean
  onSelect?: (item: ItineraryItem) => void
  className?: string
}

/**
 * One block in the itinerary timeline.
 *
 * Shows the catalogue image when the item points at a place, and falls back to
 * a typed marker when it does not (free time, a transfer, a generic meal).
 */
export function ActivityCard({ item, isPast, onSelect, className }: ActivityCardProps) {
  const kind = KIND_META[item.kind]
  const hasPlace = Boolean(item.place)

  return (
    <motion.div variants={fadeUp} className={className}>
      <div
        onClick={onSelect ? () => onSelect(item) : undefined}
        className={cn(
          'group flex gap-4 rounded-3xl border border-line bg-canvas-raised p-3 shadow-soft transition-[transform,box-shadow,opacity] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] sm:gap-5 sm:p-4',
          onSelect && 'cursor-pointer hover:-translate-y-0.5 hover:shadow-card',
          isPast && 'opacity-60',
          item.isPending && 'border-sea-400/50 ring-4 ring-sea-500/10',
        )}
      >
        {hasPlace ? (
          <MediaFrame
            mediaKey={item.place?.mediaKey}
            ratio="square"
            rounded="rounded-2xl"
            className="w-20 shrink-0 sm:w-24"
          />
        ) : (
          <span className="flex size-20 shrink-0 items-center justify-center rounded-2xl bg-canvas-sunken text-ink-300 sm:size-24">
            <kind.icon className="size-5" aria-hidden />
          </span>
        )}

        <div className="min-w-0 flex-1 py-0.5">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={item.kind === 'free' ? 'neutral' : 'sea'}>
              <kind.icon className="size-3" aria-hidden />
              {kind.label}
            </Badge>
            {item.isPending && (
              <Badge tone="sand">
                <Sparkles className="size-3" aria-hidden />
                NOVA updating
              </Badge>
            )}
          </div>

          <h4 className="mt-2.5 text-base leading-snug text-ink-800 sm:text-lg">{item.title}</h4>

          {item.subtitle && (
            <p className="mt-1 line-clamp-2 text-[13px] leading-relaxed text-ink-500">
              {item.subtitle}
            </p>
          )}

          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-ink-400">
            {item.place?.city && (
              <span className="flex items-center gap-1.5">
                <MapPin className="size-3" aria-hidden />
                {item.place.city}
              </span>
            )}
            {item.place?.rating && (
              <span className="flex items-center gap-1.5">
                <Star className="size-3 fill-sand-500 text-sand-500" aria-hidden />
                {item.place.rating.toFixed(1)}
              </span>
            )}
            {item.endTime && (
              <span className="hidden sm:inline">
                until {formatTime(item.endTime)}
              </span>
            )}
            {item.costEstimate !== null && item.costEstimate !== undefined && (
              <span className={cn(item.costEstimate === 0 && 'text-positive')}>
                {item.costEstimate === 0 ? 'Free' : formatCurrency(item.costEstimate)}
              </span>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  )
}
