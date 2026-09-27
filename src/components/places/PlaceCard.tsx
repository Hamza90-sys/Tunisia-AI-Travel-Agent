import { motion } from 'framer-motion'
import { Clock, MapPin, Star } from 'lucide-react'

import { Badge, MediaFrame } from '@/components/ui'
import { fadeUp } from '@/animations'
import { getCategoryMeta } from '@/data'
import { cn, formatDuration, formatPriceLevel } from '@/lib/utils'
import type { Place } from '@/types'

export type PlaceCardVariant = 'default' | 'feature' | 'compact'

export interface PlaceCardProps {
  place: Place
  variant?: PlaceCardVariant
  onSelect?: (place: Place) => void
  className?: string
}

/**
 * The catalogue's primary card.
 *
 * Three variants share one component so the Discover grid, the landing rail
 * and the NOVA suggestion lists stay visually identical.
 */
export function PlaceCard({ place, variant = 'default', onSelect, className }: PlaceCardProps) {
  const category = getCategoryMeta(place.category)
  const isFeature = variant === 'feature'
  const isCompact = variant === 'compact'

  if (isCompact) {
    return (
      <motion.article variants={fadeUp} className={className}>
        <button
          type="button"
          onClick={() => onSelect?.(place)}
          disabled={!onSelect}
          className="group flex w-full items-center gap-4 rounded-2xl border border-line bg-canvas-raised p-3 text-left transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] hover:-translate-y-0.5 hover:shadow-card disabled:cursor-default disabled:hover:translate-y-0 disabled:hover:shadow-soft"
        >
          <MediaFrame
            mediaKey={place.mediaKey}
            ratio="square"
            rounded="rounded-xl"
            className="w-16 shrink-0"
          />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-ink-800">{place.name}</p>
            <p className="mt-0.5 flex items-center gap-1 truncate text-xs text-ink-400">
              <MapPin className="size-3 shrink-0" aria-hidden />
              {place.city}
            </p>
          </div>
          {place.rating && (
            <span className="flex shrink-0 items-center gap-1 text-xs text-ink-500">
              <Star className="size-3 fill-sand-500 text-sand-500" aria-hidden />
              {place.rating.toFixed(1)}
            </span>
          )}
        </button>
      </motion.article>
    )
  }

  return (
    <motion.article
      variants={fadeUp}
      className={cn('group relative', className)}
      onClick={onSelect ? () => onSelect(place) : undefined}
    >
      <div
        className={cn(
          'relative overflow-hidden rounded-3xl border border-line bg-canvas-raised shadow-soft transition-[transform,box-shadow] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]',
          onSelect && 'cursor-pointer hover:-translate-y-1 hover:shadow-lift',
        )}
      >
        <MediaFrame
          mediaKey={place.mediaKey}
          ratio={isFeature ? 'landscape' : 'photo'}
          rounded="rounded-none"
          scrim={isFeature ? 'strong' : 'soft'}
          className="transition-transform duration-[900ms] ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-[1.03]"
          overlay={
            <div className="flex h-full flex-col justify-between p-4">
              <div className="flex items-start justify-between gap-2">
                <Badge tone="onDark" className="backdrop-blur-md">
                  <category.icon className="size-3" aria-hidden />
                  {category.label}
                </Badge>
                {place.priceLevel && (
                  <span className="rounded-full bg-white/10 px-2 py-1 text-[11px] font-medium text-white/85 backdrop-blur-md">
                    {formatPriceLevel(place.priceLevel)}
                  </span>
                )}
              </div>

              {isFeature && (
                <div>
                  <h3 className="text-2xl leading-tight text-canvas">{place.name}</h3>
                  <p className="mt-1.5 flex items-center gap-1.5 text-xs text-white/70">
                    <MapPin className="size-3" aria-hidden />
                    {place.city}, {place.region}
                  </p>
                </div>
              )}
            </div>
          }
        />

        {!isFeature && (
          <div className="p-5">
            <div className="flex items-start justify-between gap-3">
              <h3 className="text-lg leading-snug text-ink-800">{place.name}</h3>
              {place.rating && (
                <span className="mt-1 flex shrink-0 items-center gap-1 text-[13px] text-ink-500">
                  <Star className="size-3.5 fill-sand-500 text-sand-500" aria-hidden />
                  {place.rating.toFixed(1)}
                </span>
              )}
            </div>

            <p className="mt-1 flex items-center gap-1.5 text-xs text-ink-400">
              <MapPin className="size-3" aria-hidden />
              {place.city}
            </p>

            <p className="mt-3 line-clamp-2 text-sm leading-relaxed text-ink-500">
              {place.summary}
            </p>

            {(place.typicalDurationMinutes || place.tags.length > 0) && (
              <div className="mt-4 flex items-center gap-3 border-t border-line pt-4 text-xs text-ink-400">
                {place.typicalDurationMinutes && (
                  <span className="flex items-center gap-1.5">
                    <Clock className="size-3" aria-hidden />
                    {formatDuration(place.typicalDurationMinutes)}
                  </span>
                )}
                {place.tags[0] && (
                  <span className="truncate capitalize">{place.tags[0].replace(/-/g, ' ')}</span>
                )}
              </div>
            )}
          </div>
        )}

        {isFeature && (
          <div className="p-5">
            <p className="line-clamp-2 text-sm leading-relaxed text-ink-500">{place.summary}</p>
          </div>
        )}
      </div>
    </motion.article>
  )
}
