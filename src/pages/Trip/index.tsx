import { useMemo, useState } from 'react'
import { MapPinned, Sparkles } from 'lucide-react'

import { DaySelector, ItineraryTimeline, RouteMap, TripSummary } from '@/components/itinerary'
import { PageHeader } from '@/components/layout'
import {
  Button,
  ButtonLink,
  Container,
  EmptyState,
  ErrorState,
  Skeleton,
} from '@/components/ui'
import { useAsync, useAuth, useNova } from '@/hooks'
import { fetchActiveTrip } from '@/lib/supabase'
import { ROUTES } from '@/lib/utils'

/**
 * Trip dashboard.
 *
 * Reads through the data layer rather than importing the demo trip directly,
 * so the moment a Supabase trip exists for the signed-in traveller this page
 * renders it with no changes. Loading, error and empty states are all real.
 */
export default function TripPage() {
  const { user } = useAuth()
  const { open: openNova } = useNova()
  const {
    data: result,
    status,
    isLoading,
    reload,
  } = useAsync(() => fetchActiveTrip(user?.id), [user?.id])

  const trip = result?.data ?? null
  const [selectedDayIndex, setSelectedDayIndex] = useState<number | null>(null)

  // Derived rather than synchronised: when a different trip loads, the
  // selection simply falls back to its first day instead of needing an effect.
  const activeDay = useMemo(
    () => trip?.days.find((day) => day.dayIndex === selectedDayIndex) ?? trip?.days[0],
    [trip, selectedDayIndex],
  )
  const activeDayIndex = activeDay?.dayIndex ?? 1

  /** Which city on the route the selected day belongs to. */
  const activeRouteIndex = useMemo(() => {
    if (!trip || !activeDay) return undefined
    const index = trip.route.indexOf(activeDay.city)
    return index >= 0 ? index : undefined
  }, [trip, activeDay])

  if (isLoading) {
    return <TripSkeleton />
  }

  if (status === 'error' || !trip) {
    return (
      <Container className="py-32">
        {status === 'error' ? (
          <ErrorState
            title="We could not load your journey"
            description="Your trip is safe. The connection to the catalogue dropped — try again."
            onRetry={reload}
          />
        ) : (
          <EmptyState
            icon={<MapPinned className="size-5" aria-hidden />}
            title="No journey yet"
            description="Tell NOVA what kind of trip you want and it will build the route, the timings and the places."
            action={
              <ButtonLink to={ROUTES.planner} variant="primary">
                Plan my journey
              </ButtonLink>
            }
          />
        )}
      </Container>
    )
  }

  return (
    <>
      <PageHeader
        tone="dark"
        eyebrow={`${trip.status === 'ready' ? 'Ready to travel' : trip.status}`}
        title="Your journey"
        actions={
          <Button
            variant="onDarkGhost"
            onClick={() => openNova()}
            icon={<Sparkles className="size-4" aria-hidden />}
          >
            Ask NOVA to change it
          </Button>
        }
      >
        <TripSummary trip={trip} onDark />
      </PageHeader>

      <Container size="wide" className="py-14 md:py-20">
        <div className="grid gap-12 lg:grid-cols-[1fr_22rem] lg:gap-14 xl:grid-cols-[1fr_26rem]">
          {/* Itinerary */}
          <div className="min-w-0">
            <DaySelector
              days={trip.days}
              activeDayIndex={activeDayIndex}
              onChange={setSelectedDayIndex}
            />

            <ItineraryTimeline
              className="mt-10"
              day={activeDay}
              actions={
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => openNova(`Make day ${activeDayIndex} cheaper.`)}
                  icon={<Sparkles className="size-3.5" aria-hidden />}
                >
                  Adjust this day
                </Button>
              }
            />
          </div>

          {/* Map rail — sticks alongside the timeline on desktop. */}
          <aside className="lg:sticky lg:top-24 lg:self-start">
            <RouteMap
              route={trip.route}
              activeIndex={activeRouteIndex}
              onSelectCity={(city) => {
                const match = trip.days.find((day) => day.city === city)
                if (match) setSelectedDayIndex(match.dayIndex)
              }}
            />

            <div className="mt-6 rounded-3xl border border-line bg-canvas-raised p-5">
              <p className="eyebrow text-sea-600">Route</p>
              <ol className="mt-4 space-y-3">
                {trip.route.map((city, index) => (
                  <li key={city} className="flex items-center gap-3 text-sm">
                    <span className="font-display text-xs text-sand-600">
                      {String(index + 1).padStart(2, '0')}
                    </span>
                    <span className="flex-1 text-ink-700">{city}</span>
                    <span className="text-xs text-ink-300">
                      {trip.days.filter((day) => day.city === city).length} d
                    </span>
                  </li>
                ))}
              </ol>
            </div>
          </aside>
        </div>
      </Container>
    </>
  )
}

function TripSkeleton() {
  return (
    <>
      <div className="bg-ink-900 pb-14 pt-28 md:pt-36">
        <Container size="wide" className="space-y-6">
          <Skeleton className="h-4 w-24 bg-white/10" />
          <Skeleton className="h-14 w-72 bg-white/10" />
          <Skeleton className="h-28 w-full bg-white/[0.07]" />
        </Container>
      </div>
      <Container size="wide" className="py-14">
        <div className="grid gap-12 lg:grid-cols-[1fr_22rem]">
          <div className="space-y-8">
            <div className="flex gap-3">
              {Array.from({ length: 4 }).map((_, index) => (
                <Skeleton key={index} className="h-24 w-28 shrink-0" />
              ))}
            </div>
            {Array.from({ length: 3 }).map((_, index) => (
              <Skeleton key={index} className="h-28 w-full rounded-3xl" />
            ))}
          </div>
          <Skeleton className="aspect-4/3 w-full rounded-4xl" />
        </div>
      </Container>
    </>
  )
}
