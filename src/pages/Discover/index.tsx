import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Search, Sparkles, X } from 'lucide-react'

import { PageHeader } from '@/components/layout'
import { CategoryRail, PlaceGrid } from '@/components/places'
import type { CategoryFilter } from '@/components/places'
import { Button, Container, Input, SectionHeading } from '@/components/ui'
import { PLACES, getCategoryMeta, getFeaturedPlaces } from '@/data'
import { useAsync, useNova } from '@/hooks'
import { fetchPlaces } from '@/lib/supabase'
import { PLACE_CATEGORIES } from '@/types'
import type { Place, PlaceCategory } from '@/types'

/** Stable identity — a fresh `[]` each render would invalidate every useMemo. */
const NO_PLACES: Place[] = []

function isCategory(value: string | null): value is PlaceCategory {
  return Boolean(value) && (PLACE_CATEGORIES as readonly string[]).includes(value as string)
}

/**
 * Discover Tunisia.
 *
 * Category filter is reflected in the URL (`/discover?category=beach`) so a
 * traveller can share "the beaches list", and so the footer links land on a
 * pre-filtered view.
 */
export default function DiscoverPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const { open: openNova } = useNova()

  const categoryParam = searchParams.get('category')
  const category: CategoryFilter = isCategory(categoryParam) ? categoryParam : 'all'
  const [search, setSearch] = useState('')

  const {
    data: result,
    isLoading,
    reload,
  } = useAsync(() => fetchPlaces({ category, search }), [category, search])

  const places = result?.data ?? NO_PLACES
  const recommended = useMemo(() => getFeaturedPlaces(3), [])

  const counts = useMemo(() => {
    const totals: Partial<Record<CategoryFilter, number>> = { all: PLACES.length }
    for (const place of PLACES) {
      totals[place.category] = (totals[place.category] ?? 0) + 1
    }
    return totals
  }, [])

  const setCategory = (next: CategoryFilter) => {
    const params = new URLSearchParams(searchParams)
    if (next === 'all') params.delete('category')
    else params.set('category', next)
    setSearchParams(params, { replace: true })
  }

  const activeLabel = category === 'all' ? 'Everywhere' : getCategoryMeta(category).label
  const activeBlurb =
    category === 'all'
      ? 'From the north coast to the edge of the Sahara — the places we would send a friend to.'
      : getCategoryMeta(category).blurb

  return (
    <>
      <PageHeader
        eyebrow="The catalogue"
        title="Discover Tunisia"
        description="Curated places, not an endless list. Every entry here can be dropped straight into your itinerary."
        actions={
          <Button
            variant="outline"
            onClick={() => openNova('Find dinner near me.')}
            icon={<Sparkles className="size-4" aria-hidden />}
          >
            Ask NOVA instead
          </Button>
        }
      >
        <div className="flex flex-col gap-6">
          <div className="max-w-md">
            <Input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search places, cities, tags…"
              aria-label="Search the catalogue"
              icon={<Search className="size-4" aria-hidden />}
            />
          </div>

          <CategoryRail value={category} onChange={setCategory} counts={counts} />
        </div>
      </PageHeader>

      <Container size="wide" className="pb-20">
        {/* --- Filtered results -------------------------------------------- */}
        <section aria-labelledby="results-heading">
          <div className="flex flex-wrap items-end justify-between gap-4 border-b border-line pb-6">
            <div>
              <h2 id="results-heading" className="text-2xl text-ink-800">
                {activeLabel}
              </h2>
              <p className="mt-1.5 max-w-lg text-sm text-ink-500">{activeBlurb}</p>
            </div>

            <div className="flex items-center gap-3">
              <p className="text-xs text-ink-400">
                {isLoading ? 'Loading…' : `${places.length} places`}
              </p>
              {(search || category !== 'all') && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setSearch('')
                    setCategory('all')
                  }}
                  icon={<X className="size-3.5" aria-hidden />}
                >
                  Clear
                </Button>
              )}
            </div>
          </div>

          <PlaceGrid
            className="mt-10"
            places={places}
            isLoading={isLoading}
            error={result?.error ?? null}
            onRetry={reload}
            emptyTitle={`Nothing matching “${search || activeLabel}”`}
            emptyDescription="Try a different category, or ask NOVA to look somewhere else in Tunisia."
          />
        </section>

        {/* --- Recommended -------------------------------------------------- */}
        <section className="mt-24" aria-labelledby="recommended-heading">
          <SectionHeading
            eyebrow="Recommended for you"
            title={<span id="recommended-heading">Where we would start</span>}
            description="Based on the most-loved places in the catalogue. Once NOVA knows your trip, this list is built from your own preferences."
          />

          <PlaceGrid className="mt-12" places={recommended} columns={3} variant="feature" />
        </section>
      </Container>
    </>
  )
}
