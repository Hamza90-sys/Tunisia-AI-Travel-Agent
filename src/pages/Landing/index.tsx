import {
  DiscoverPreview,
  FeatureStrip,
  FinalCta,
  Hero,
  HowItWorks,
  NovaShowcase,
} from './sections'

/**
 * Landing page.
 *
 * Composed of section components so each one can be reordered, A/B tested or
 * reused without untangling a single long file.
 */
export default function LandingPage() {
  return (
    <>
      <Hero />
      <FeatureStrip />
      <HowItWorks />
      <NovaShowcase />
      <DiscoverPreview />
      <FinalCta />
    </>
  )
}
