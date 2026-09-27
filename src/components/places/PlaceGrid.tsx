import { motion } from 'framer-motion'
import { Compass } from 'lucide-react'

import { PlaceCard } from './PlaceCard'
import type { PlaceCardVariant } from './PlaceCard'
import { EmptyState, ErrorState, PlaceCardSkeleton } from '@/components/ui'
import { staggerParent } from '@/animations'
import { cn } from '@/lib/utils'
import type { Place } from '@/types'

export interface PlaceGridProps {
  places: Place[]
  isLoading?: boolean
  error?: string | null
  onRetry?: () => void
  onSelect?: (place: Place) => void
  variant?: PlaceCardVariant
  /** Shown when the list is empty and there is no error. */
  emptyTitle?: string
  emptyDescription?: string
  columns?: 2 | 3 | 4
  className?: string
}

const COLUMN_CLASSES: Record<2 | 3 | 4, string> = {
  2: 'sm:grid-cols-2',
  3: 'sm:grid-cols-2 lg:grid-cols-3',
  4: 'sm:grid-cols-2 lg:grid-cols-4',
}

/** Responsive catalogue grid with the full loading / error / empty triple. */
export function PlaceGrid({
  places,
  isLoading,
  error,
  onRetry,
  onSelect,
  variant = 'default',
  emptyTitle = 'Nothing here yet',
  emptyDescription = 'Try another category, or ask NOVA to look somewhere else in Tunisia.',
  columns = 3,
  className,
}: PlaceGridProps) {
  if (isLoading) {
    return (
      <div className={cn('grid gap-6', COLUMN_CLASSES[columns], className)}>
        {Array.from({ length: columns * 2 }).map((_, index) => (
          <PlaceCardSkeleton key={index} />
        ))}
      </div>
    )
  }

  if (error && places.length === 0) {
    return <ErrorState onRetry={onRetry} className={className} />
  }

  if (places.length === 0) {
    return (
      <EmptyState
        icon={<Compass className="size-5" aria-hidden />}
        title={emptyTitle}
        description={emptyDescription}
        className={className}
      />
    )
  }

  return (
    <motion.div
      variants={staggerParent(0.06)}
      initial="hidden"
      animate="visible"
      className={cn('grid gap-6', COLUMN_CLASSES[columns], className)}
    >
      {places.map((place) => (
        <PlaceCard key={place.id} place={place} variant={variant} onSelect={onSelect} />
      ))}
    </motion.div>
  )
}
