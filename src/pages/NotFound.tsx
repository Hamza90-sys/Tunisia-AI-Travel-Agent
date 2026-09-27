import { NovaAvatar } from '@/components/nova'
import { ButtonLink, Container } from '@/components/ui'
import { ROUTES } from '@/lib/utils'

export default function NotFoundPage() {
  return (
    <Container className="flex min-h-[70dvh] flex-col items-center justify-center py-32 text-center">
      <NovaAvatar state="searching" size="lg" />
      <p className="eyebrow mt-10 text-sea-600">404</p>
      <h1 className="mt-4 text-display-sm text-ink-800">This road leads nowhere</h1>
      <p className="mt-4 max-w-sm text-sm leading-relaxed text-ink-500">
        The page you are looking for is not part of the journey. NOVA has already turned the car
        around.
      </p>
      <div className="mt-9 flex flex-wrap justify-center gap-3">
        <ButtonLink to={ROUTES.landing} variant="primary">
          Back to home
        </ButtonLink>
        <ButtonLink to={ROUTES.discover} variant="outline">
          Discover Tunisia
        </ButtonLink>
      </div>
    </Container>
  )
}
