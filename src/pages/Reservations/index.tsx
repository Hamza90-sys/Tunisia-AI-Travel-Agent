import { useMemo, useState } from 'react'
import { Info, Sparkles } from 'lucide-react'

import { PageHeader } from '@/components/layout'
import { ReservationList } from '@/components/reservations'
import { Button, Chip, Container } from '@/components/ui'
import { useAsync, useAuth, useNova } from '@/hooks'
import { fetchReservations } from '@/lib/supabase'
import { formatCurrency } from '@/lib/utils'
import { RESERVATION_TYPES } from '@/types'
import type { Reservation, ReservationType } from '@/types'

type TypeFilter = ReservationType | 'all'

/** Stable identity — a fresh `[]` each render would invalidate every useMemo. */
const NO_RESERVATIONS: Reservation[] = []

const TYPE_LABELS: Record<ReservationType, string> = {
  hotel: 'Hotels',
  restaurant: 'Restaurants',
  experience: 'Experiences',
}

/**
 * My reservations.
 *
 * UI and data structures only. The page is explicit that nothing here is a
 * live booking — a booking provider has not been connected, and claiming
 * otherwise would be the one thing a travel product must never do.
 */
export default function ReservationsPage() {
  const { user } = useAuth()
  const { open: openNova } = useNova()
  const [filter, setFilter] = useState<TypeFilter>('all')

  const {
    data: result,
    isLoading,
    reload,
  } = useAsync(() => fetchReservations(user?.id), [user?.id])

  const reservations = result?.data ?? NO_RESERVATIONS

  const visible = useMemo(
    () => (filter === 'all' ? reservations : reservations.filter((row) => row.type === filter)),
    [reservations, filter],
  )

  const upcomingTotal = useMemo(
    () =>
      reservations
        .filter((row) => row.status === 'confirmed' || row.status === 'pending')
        .reduce((sum, row) => sum + (row.totalAmount ?? 0), 0),
    [reservations],
  )

  const counts = useMemo(() => {
    const totals: Partial<Record<TypeFilter, number>> = { all: reservations.length }
    for (const row of reservations) totals[row.type] = (totals[row.type] ?? 0) + 1
    return totals
  }, [reservations])

  return (
    <>
      <PageHeader
        eyebrow="Your bookings"
        title="My reservations"
        description="Stays, tables and experiences in one place, ordered by the day they happen."
        actions={
          <Button
            variant="outline"
            onClick={() => openNova('Move my dinner reservation later.')}
            icon={<Sparkles className="size-4" aria-hidden />}
          >
            Ask NOVA
          </Button>
        }
      >
        <div className="flex flex-col gap-6">
          <div className="flex flex-wrap items-center gap-2.5">
            <Chip selected={filter === 'all'} onClick={() => setFilter('all')}>
              All
              {counts.all !== undefined && (
                <span className="text-[11px] opacity-50">{counts.all}</span>
              )}
            </Chip>
            {RESERVATION_TYPES.map((type) => (
              <Chip key={type} selected={filter === type} onClick={() => setFilter(type)}>
                {TYPE_LABELS[type]}
                {counts[type] !== undefined && (
                  <span className="text-[11px] opacity-50">{counts[type]}</span>
                )}
              </Chip>
            ))}
          </div>

          {upcomingTotal > 0 && (
            <p className="text-sm text-ink-500">
              Upcoming commitments{' '}
              <span className="font-medium text-ink-800">{formatCurrency(upcomingTotal)}</span>
            </p>
          )}
        </div>
      </PageHeader>

      <Container size="wide" className="pb-20">
        {/* Honest framing — this prototype does not hold real bookings. */}
        <div
          role="note"
          className="mb-10 flex items-start gap-3 rounded-2xl border border-sand-500/35 bg-sand-500/[0.08] p-4 text-sm text-sand-800"
        >
          <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
          <p className="leading-relaxed">
            <span className="font-medium">Prototype data.</span> These records demonstrate the
            reservation model. No booking provider is connected yet, so nothing here is a real
            reservation.
          </p>
        </div>

        <ReservationList
          reservations={visible}
          isLoading={isLoading}
          error={result?.error ?? null}
          onRetry={reload}
        />
      </Container>
    </>
  )
}
