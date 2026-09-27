import { motion } from 'framer-motion'
import { Ticket } from 'lucide-react'

import { ReservationCard } from './ReservationCard'
import { ButtonLink, EmptyState, ErrorState, Skeleton } from '@/components/ui'
import { staggerParent } from '@/animations'
import { ROUTES, cn } from '@/lib/utils'
import type { Reservation } from '@/types'

export interface ReservationListProps {
  reservations: Reservation[]
  isLoading?: boolean
  error?: string | null
  onRetry?: () => void
  onSelect?: (reservation: Reservation) => void
  className?: string
}

export function ReservationList({
  reservations,
  isLoading,
  error,
  onRetry,
  onSelect,
  className,
}: ReservationListProps) {
  if (isLoading) {
    return (
      <div className={cn('space-y-5', className)}>
        {Array.from({ length: 3 }).map((_, index) => (
          <Skeleton key={index} className="h-44 rounded-3xl sm:h-40" />
        ))}
      </div>
    )
  }

  if (error && reservations.length === 0) {
    return <ErrorState onRetry={onRetry} className={className} />
  }

  if (reservations.length === 0) {
    return (
      <EmptyState
        icon={<Ticket className="size-5" aria-hidden />}
        title="No reservations yet"
        description="Once you book a stay, a table or an experience it lands here, next to the day it belongs to."
        action={
          <ButtonLink to={ROUTES.discover} variant="primary" size="sm">
            Browse Tunisia
          </ButtonLink>
        }
        className={className}
      />
    )
  }

  return (
    <motion.div
      variants={staggerParent(0.08)}
      initial="hidden"
      animate="visible"
      className={cn('space-y-5', className)}
    >
      {reservations.map((reservation) => (
        <ReservationCard key={reservation.id} reservation={reservation} onSelect={onSelect} />
      ))}
    </motion.div>
  )
}
