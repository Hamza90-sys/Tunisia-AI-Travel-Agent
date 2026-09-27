import { motion } from 'framer-motion'
import { ArrowRight } from 'lucide-react'

import { PlaceCard } from '@/components/places'
import { ButtonLink, Container, SectionHeading } from '@/components/ui'
import { scrollReveal, staggerParent } from '@/animations'
import { getFeaturedPlaces } from '@/data'
import { ROUTES } from '@/lib/utils'

/** A taste of the catalogue, straight from the same data the planner uses. */
export function DiscoverPreview() {
  const places = getFeaturedPlaces(6)

  return (
    <section className="bg-page py-24 md:py-32">
      <Container size="wide">
        <SectionHeading
          eyebrow="The country"
          title={
            <>
              Three thousand years,
              <br />
              twelve hundred kilometres of coast.
            </>
          }
          description="Roman cities, a living medina, the shallowest water in the Mediterranean and the edge of the Sahara — all inside a country you can cross in a day."
          action={
            <ButtonLink
              to={ROUTES.discover}
              variant="outline"
              iconAfter={<ArrowRight className="size-4" aria-hidden />}
            >
              Discover Tunisia
            </ButtonLink>
          }
        />

        <motion.div
          variants={staggerParent(0.07)}
          {...scrollReveal}
          className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-3"
        >
          {places.map((place) => (
            <PlaceCard key={place.id} place={place} />
          ))}
        </motion.div>
      </Container>
    </section>
  )
}
