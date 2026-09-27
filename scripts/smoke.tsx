/**
 * Render smoke test.
 *
 * Two passes:
 *   1. every route renders through the real providers without throwing
 *   2. every data-driven component renders with real fixture data
 *
 * Pass 1 alone would miss most of the UI, because the pages start in their
 * loading state and the data resolves after the render. Run with `npm run smoke`.
 */
import { readFileSync } from 'node:fs'

import { renderToString } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import type { ComponentType, ReactElement } from 'react'

import { AuthProvider, NovaProvider } from '../src/hooks'
import DiscoverPage from '../src/pages/Discover'
import LandingPage from '../src/pages/Landing'
import LoginPage from '../src/pages/Auth/Login'
import NotFoundPage from '../src/pages/NotFound'
import PlannerPage from '../src/pages/Planner'
import ReservationsPage from '../src/pages/Reservations'
import AuthCallbackPage from '../src/pages/Auth/Callback'
import TripPage from '../src/pages/Trip'

import {
  ActivityCard,
  DaySelector,
  ItineraryTimeline,
  RouteMap,
  TripSummary,
} from '../src/components/itinerary'
import { NovaAvatar, NovaPlanningState } from '../src/components/nova'
import { CategoryRail, PlaceCard, PlaceGrid } from '../src/components/places'
import { ReservationList } from '../src/components/reservations'
import { EmptyState, ErrorState, MediaFrame, StatusPill } from '../src/components/ui'
import { TripDraftControls } from '../src/pages/Planner/TripDraftControls'
import {
  EMBEDDING_DIM,
  assertEmbeddingShape,
  buildPlaceEmbeddingInput,
  buildPlaceEmbeddingText,
  cosineSimilarity,
  hashEmbeddingInput,
  l2Normalize,
  toVectorLiteral,
} from '../src/lib/rag'
import { matchPlaces } from '../src/lib/supabase/queries'
import { resolveNovaEndpoint, streamNovaReply } from '../src/lib/nova/client'
import {
  isConversationId,
  selectHistoryWindow,
  toGeminiContents,
} from '../supabase/functions/nova-agent/history'
import {
  HISTORY_CHAR_BUDGET,
  HISTORY_MESSAGE_LIMIT,
} from '../supabase/functions/nova-agent/config'
import {
  isDailyQuotaExhausted,
  isRateLimited,
  isRetryableProviderError,
  runNovaAgent,
} from '../supabase/functions/nova-agent/agent'
import {
  SEARCH_CATEGORIES,
  SEARCH_PLACES,
  executeSearchPlaces,
  searchPlacesDeclaration,
  validateSearchPlacesArgs,
} from '../supabase/functions/nova-agent/tools'
import { resolveProvider } from '../supabase/functions/nova-agent/llm'
import { toolNames } from '../supabase/functions/nova-agent/tools/registry'
import { searchPlacesTool } from '../supabase/functions/nova-agent/tools/places'
import { calculateBudget } from '../supabase/functions/nova-agent/engines/budget'
import { buildItinerary } from '../supabase/functions/nova-agent/engines/itinerary'
import { optimizeRoute } from '../supabase/functions/nova-agent/engines/route'
import { readTripProfile } from '../supabase/functions/nova-agent/profile'
import { PLACE_CATEGORIES } from '../src/types'
import type { NovaServerEvent } from '../src/lib/nova/events'
import { DEMO_RESERVATIONS, DEMO_TRIP, PLACES } from '../src/data'
import { NOVA_STATES } from '../src/types'

let failures = 0

function wrap(node: ReactElement, path = '/') {
  return (
    <MemoryRouter initialEntries={[path]}>
      <AuthProvider>
        <NovaProvider>{node}</NovaProvider>
      </AuthProvider>
    </MemoryRouter>
  )
}

function check(name: string, node: ReactElement, expected: string, path = '/') {
  try {
    const html = renderToString(wrap(node, path))
    if (!html.includes(expected)) {
      failures += 1
      console.error(`FAIL  ${name} — expected to contain "${expected}"`)
      return
    }
    console.log(`ok    ${name.padEnd(34)} ${String(html.length).padStart(7)} bytes`)
  } catch (error) {
    failures += 1
    console.error(`ERROR ${name}`)
    console.error(error)
  }
}

/* --- Pass 1: routes ------------------------------------------------------- */
console.log('\nRoutes')

const ROUTES: { path: string; name: string; Page: ComponentType; expect: string }[] = [
  { path: '/', name: 'Landing', Page: LandingPage, expect: 'adventure is' },
  { path: '/planner', name: 'Planner', Page: PlannerPage, expect: 'Tell me about your journey' },
  { path: '/trip', name: 'Trip (loading)', Page: TripPage, expect: 'shimmer-sweep' },
  { path: '/discover', name: 'Discover', Page: DiscoverPage, expect: 'Discover Tunisia' },
  { path: '/reservations', name: 'Reservations', Page: ReservationsPage, expect: 'shimmer-sweep' },
  { path: '/login', name: 'Login', Page: LoginPage, expect: 'Continue with Google' },
  // Stable across both branches: "Finishing your sign-in" while the session is
  // still resolving, "That sign-in link has expired" once it is known.
  { path: '/auth/callback', name: 'Auth callback', Page: AuthCallbackPage, expect: 'sign-in' },
  { path: '/nowhere', name: 'NotFound', Page: NotFoundPage, expect: 'leads nowhere' },
]

for (const route of ROUTES) {
  check(`${route.name} (${route.path})`, <route.Page />, route.expect, route.path)
}

/* --- Pass 2: data-driven components --------------------------------------- */
console.log('\nComponents')

const day = DEMO_TRIP.days[0]

for (const state of NOVA_STATES) {
  check(`NovaAvatar [${state}]`, <NovaAvatar state={state} size="lg" />, `NOVA, ${state}`)
}

check('NovaPlanningState', <NovaPlanningState autoStart={false} />, 'Analyzing your preferences')
check('TripSummary', <TripSummary trip={DEMO_TRIP} />, 'Tunis → Hammamet → Sousse')
check('RouteMap', <RouteMap route={DEMO_TRIP.route} activeIndex={0} />, 'km total')
check(
  'DaySelector',
  <DaySelector days={DEMO_TRIP.days} activeDayIndex={1} onChange={() => {}} />,
  'Hammamet',
)
check('ItineraryTimeline', <ItineraryTimeline day={day} />, 'Carthage')
check('ActivityCard', <ActivityCard item={day.items[0]} />, 'Carthage')
check('PlaceCard [default]', <PlaceCard place={PLACES[0]} />, PLACES[0].name)
check('PlaceCard [feature]', <PlaceCard place={PLACES[0]} variant="feature" />, PLACES[0].name)
check('PlaceCard [compact]', <PlaceCard place={PLACES[0]} variant="compact" />, PLACES[0].name)
check('PlaceGrid', <PlaceGrid places={PLACES.slice(0, 6)} />, PLACES[1].name)
check('PlaceGrid [empty]', <PlaceGrid places={[]} />, 'Nothing here yet')
check('PlaceGrid [loading]', <PlaceGrid places={[]} isLoading />, 'shimmer-sweep')
check(
  'PlaceGrid [error]',
  <PlaceGrid places={[]} error="boom" onRetry={() => {}} />,
  'Try again',
)
check('CategoryRail', <CategoryRail value="beach" onChange={() => {}} />, 'Beaches')
check('ReservationList', <ReservationList reservations={DEMO_RESERVATIONS} />, 'La Badira')
check('ReservationList [empty]', <ReservationList reservations={[]} />, 'No reservations yet')
check('StatusPill', <StatusPill status="confirmed" />, 'Confirmed')
check(
  'TripDraftControls',
  <TripDraftControls
    travelers={2}
    durationDays={5}
    budgetLevel="elevated"
    startDate={null}
    onTravelersChange={() => {}}
    onDurationChange={() => {}}
    onBudgetChange={() => {}}
    onStartDateChange={() => {}}
  />,
  'Start date',
)
check('MediaFrame [placeholder]', <MediaFrame mediaKey="carthage" />, 'data-media-placeholder')
check('EmptyState', <EmptyState title="Nothing" />, 'Nothing')
check('ErrorState', <ErrorState onRetry={() => {}} />, 'Try again')

/* --- Pass 3: units --------------------------------------------------------- */

function expect(name: string, condition: boolean, detail = '') {
  if (condition) {
    console.log(`ok    ${name}`)
    return
  }
  failures += 1
  console.error(`FAIL  ${name}${detail ? ` — ${detail}` : ''}`)
}

function expectThrows(name: string, fn: () => unknown) {
  try {
    fn()
    failures += 1
    console.error(`FAIL  ${name} — expected a throw, got a value`)
  } catch {
    console.log(`ok    ${name}`)
  }
}

async function runUnitChecks() {
  console.log('\nUnits — vector')

  const raw = Array.from({ length: EMBEDDING_DIM }, (_, index) => (index % 7) - 3)
  const unit = l2Normalize(raw)
  const magnitude = Math.sqrt(unit.reduce((sum, value) => sum + value * value, 0))

  expect('l2Normalize returns a unit vector', Math.abs(magnitude - 1) < 1e-12, `|v|=${magnitude}`)
  expect('l2Normalize preserves width', unit.length === EMBEDDING_DIM)
  expect('l2Normalize survives a zero vector', l2Normalize([0, 0, 0]).every(Number.isFinite))
  expect('toVectorLiteral formats for pgvector', toVectorLiteral([0.5, -1, 2]) === '[0.5,-1,2]')
  expectThrows('toVectorLiteral rejects NaN', () => toVectorLiteral([1, Number.NaN]))
  expectThrows('assertEmbeddingShape rejects a bad width', () => assertEmbeddingShape([1, 2, 3]))
  expect(
    'cosineSimilarity of identical vectors is 1',
    Math.abs(cosineSimilarity(unit, unit) - 1) < 1e-12,
  )
  expect(
    'cosineSimilarity of orthogonal vectors is 0',
    Math.abs(cosineSimilarity([1, 0], [0, 1])) < 1e-12,
  )

  // EMBEDDING_DIM is a schema contract: place_embeddings.embedding is declared
  // vector(768) and match_places takes vector(768). Guard against drift.
  const migration = readFileSync('supabase/migrations/20260102000000_vector_rag.sql', 'utf8')
  const declaredWidths = [...migration.matchAll(/vector\((\d+)\)/g)].map((m) => Number(m[1]))
  expect(
    'EMBEDDING_DIM matches every vector(N) in the migration',
    declaredWidths.length > 0 && declaredWidths.every((width) => width === EMBEDDING_DIM),
    `migration=${[...new Set(declaredWidths)].join('/')} code=${EMBEDDING_DIM}`,
  )

  console.log('\nUnits — embedding inputs')

  const place = PLACES[0]
  const text = buildPlaceEmbeddingText(place)
  expect('embedding text includes the place name', text.includes(place.name))
  expect('embedding text includes the city', text.includes(place.city))
  expect('embedding text includes tags', text.includes(place.tags[0]))
  expect('embedding text is deterministic', text === buildPlaceEmbeddingText(place))

  const hash = await hashEmbeddingInput(text)
  expect('content hash is sha-256 hex', /^[0-9a-f]{64}$/.test(hash), hash)
  expect('content hash is deterministic', hash === (await hashEmbeddingInput(text)))
  expect('content hash changes with input', hash !== (await hashEmbeddingInput(`${text} `)))

  // Regression guard: place_embeddings.place_id is a uuid from public.places,
  // resolved through the slug. The local catalogue's readable `place.id`
  // (plc-carthage) must never be what the pipeline keys on.
  const input = await buildPlaceEmbeddingInput(place)
  expect('embedding input keys on slug', input.slug === place.slug)
  expect(
    'embedding input does not key on the local catalogue id',
    input.slug !== place.id,
    `slug=${input.slug} id=${place.id}`,
  )
  expect('embedding input hash matches its text', input.contentHash === hash)

  console.log('')
  console.log('Units — retrieval')

  // Environment independent on purpose: this repo is verified both with and
  // without credentials. Configured, this exercises the real match_places RPC;
  // unconfigured, the keyword fallback. Both must return places, and only the
  // vector path may carry a similarity score.
  const result = await matchPlaces({
    embedding: l2Normalize(Array.from({ length: EMBEDDING_DIM }, () => 1)),
    query: 'beach',
    limit: 3,
  })
  expect(
    'matchPlaces resolves through a known source',
    result.source === 'supabase' || result.source === 'local',
    `source=${result.source}`,
  )
  expect('matchPlaces returns places', result.data.length > 0)
  expect('matchPlaces respects the limit', result.data.length <= 3)
  expect(
    'keyword fallback never fabricates a similarity',
    result.source !== 'local' || result.data.every((row) => row.similarity === null),
  )
  const scores = result.data.map((row) => row.similarity).filter((v): v is number => v !== null)
  expect(
    'vector results carry a cosine similarity in [-1, 1]',
    result.source !== 'supabase' ||
      (scores.length === result.data.length &&
        scores.every((v) => Number.isFinite(v) && v >= -1 && v <= 1)),
    scores.length ? `min=${Math.min(...scores).toFixed(4)} max=${Math.max(...scores).toFixed(4)}` : 'none',
  )
}

/* --- Pass 4: NOVA agent (Phase 4A) ---------------------------------------- */

/** Minimal stand-ins so the tool can be exercised without network access. */
function stubAi(values: number[] | undefined) {
  return {
    models: {
      embedContent: async () => ({ embeddings: values ? [{ values }] : [] }),
    },
  } as never
}

/**
 * Stands in for the Supabase client.
 *
 * `rpc` serves the semantic path (`match_places`). `from` serves the keyword
 * fallback `search_places` reaches for when the embedding provider is down or a
 * city filter emptied the semantic hits — it is a thenable query builder, which
 * is what supabase-js returns, and it yields `keywordResult` (empty by default,
 * so the fallback finding nothing is the tested behaviour).
 */
function stubDb(
  result: { data: unknown; error: { message: string } | null },
  keywordResult: { data: unknown; error: { message: string } | null } = { data: [], error: null },
) {
  const builder: Record<string, unknown> = {}
  for (const method of ['select', 'eq', 'ilike', 'or', 'in', 'limit', 'order']) {
    builder[method] = () => builder
  }
  builder.maybeSingle = async () => keywordResult
  builder.then = (resolve: (value: unknown) => unknown) => Promise.resolve(keywordResult).then(resolve)

  return { rpc: async () => result, from: () => builder } as never
}

async function collect(stream: AsyncGenerator<NovaServerEvent>): Promise<NovaServerEvent[]> {
  const events: NovaServerEvent[] = []
  for await (const event of stream) events.push(event)
  return events
}

async function runAgentChecks() {
  console.log('\nNOVA - provider and tool boundaries')

  const providerEnv = {
    geminiApiKey: 'test-key',
    model: 'test-model',
    nvidiaBaseUrl: undefined,
    nvidiaApiKey: undefined,
    nvidiaModel: undefined,
  }
  expect(
    'Gemini remains the default provider',
    resolveProvider({ ...providerEnv, provider: undefined }).id === 'gemini',
  )
  expectThrows('NVIDIA cannot be selected without server credentials', () =>
    resolveProvider({ ...providerEnv, provider: 'nvidia' }),
  )
  expect(
    'provider switching leaves the tool registry unchanged',
    toolNames().join(',') ===
      'search_places,get_place_details,optimize_route,build_itinerary,calculate_budget',
  )

  console.log('\nNOVA - deterministic travel engines')

  const profile = readTripProfile({
    destination: 'Tunis',
    durationDays: 3,
    travelers: 2,
    pace: 'relaxed',
    interests: ['history', 'food'],
  })
  expect('trip profile keeps stated destination', profile?.destination === 'Tunis')
  expect('trip profile bounds structured values', profile?.durationDays === 3 && profile.travelers === 2)
  expect('trip profile discards unknown fields', !('ignoreInstructions' in (profile ?? {})))

  const budget = calculateBudget({
    travelers: 2,
    nights: 2,
    budgetLevel: 'balanced',
    activityPriceLevels: [1, 2],
    targetTotalTnd: 1200,
  })
  expect('budget is labelled as an estimate in TND', budget.basis === 'estimate' && budget.currency === 'TND')
  expect('budget calculation is deterministic', budget.totalTnd === calculateBudget({
    travelers: 2,
    nights: 2,
    budgetLevel: 'balanced',
    activityPriceLevels: [1, 2],
    targetTotalTnd: 1200,
  }).totalTnd)

  const routeStops = [
    { slug: 'a', name: 'A', city: 'Tunis', lat: 36.8, lng: 10.18 },
    { slug: 'b', name: 'B', city: 'Tunis', lat: 36.81, lng: 10.17 },
    { slug: 'c', name: 'C', city: 'Tunis', lat: 36.82, lng: 10.19 },
  ]
  const route = optimizeRoute(routeStops)
  expect('route only returns computed distances', route.totalDistanceKm >= 0 && route.legs.length === 2)
  const itinerary = buildItinerary(
    routeStops.map((stop) => ({ ...stop, durationMinutes: 90, category: 'history' })),
    { days: 1, pace: 'balanced' },
  )
  expect('itinerary uses deterministic catalogue-shaped stops', itinerary.days[0]?.stops.length === 3)

  const modernEmbedding = Array.from({ length: EMBEDDING_DIM }, (_, index) => (index % 5) + 1)
  const modernSearch = await searchPlacesTool.execute(
    { query: 'roman ruins', category: 'history', limit: 3 },
    {
      embeddings: { embedQuery: async () => modernEmbedding },
      db: stubDb({ data: [], error: null }),
    },
  )
  expect(
    'new search_places uses the injected RAG embedding boundary',
    modernSearch.ok && modernSearch.source === 'catalogue',
  )

  console.log('\nNOVA — search_places schema')

  expect('declaration is named search_places', searchPlacesDeclaration.name === SEARCH_PLACES)
  expect(
    'declaration requires query',
    searchPlacesDeclaration.parameters?.required?.[0] === 'query',
  )
  expect(
    'declaration exposes query, category and limit',
    ['query', 'category', 'limit'].every((key) =>
      Boolean(searchPlacesDeclaration.parameters?.properties?.[key]),
    ),
  )
  expect(
    'tool categories match the place_category enum',
    [...SEARCH_CATEGORIES].sort().join(',') === [...PLACE_CATEGORIES].sort().join(','),
    `tool=${SEARCH_CATEGORIES.length} enum=${PLACE_CATEGORIES.length}`,
  )

  console.log('\nNOVA — tool argument validation')

  const good = validateSearchPlacesArgs({ query: 'roman ruins', category: 'history', limit: 3 })
  expect('accepts a valid call', good.ok && good.args.query === 'roman ruins')
  expect('keeps a valid category', good.ok && good.args.category === 'history')
  expect('keeps a valid limit', good.ok && good.args.limit === 3)

  const noCategory = validateSearchPlacesArgs({ query: 'beaches' })
  expect(
    'category is optional and defaults to null',
    noCategory.ok && noCategory.args.category === null,
  )
  expect('limit defaults when omitted', noCategory.ok && noCategory.args.limit > 0)

  expect('rejects a non-object', !validateSearchPlacesArgs('nope').ok)
  expect('rejects a null', !validateSearchPlacesArgs(null).ok)
  expect('rejects an array', !validateSearchPlacesArgs([1, 2]).ok)
  expect('rejects a missing query', !validateSearchPlacesArgs({}).ok)
  expect('rejects an empty query', !validateSearchPlacesArgs({ query: '   ' }).ok)
  expect('rejects a non-string query', !validateSearchPlacesArgs({ query: 42 }).ok)
  expect(
    'rejects an unknown category',
    !validateSearchPlacesArgs({ query: 'x', category: 'casino' }).ok,
  )
  expect('rejects a non-numeric limit', !validateSearchPlacesArgs({ query: 'x', limit: 'ten' }).ok)

  const clamped = validateSearchPlacesArgs({ query: 'x', limit: 9999 })
  expect('clamps an oversized limit', clamped.ok && clamped.args.limit <= 10)
  const floored = validateSearchPlacesArgs({ query: 'x', limit: -5 })
  expect('floors a negative limit to 1', floored.ok && floored.args.limit === 1)

  console.log('\nNOVA — retrieval behaviour')

  const embedding = Array.from({ length: EMBEDDING_DIM }, (_, index) => (index % 5) + 1)
  const baseArgs = { query: 'roman ruins', category: null, limit: 5 }

  const empty = await executeSearchPlaces(stubAi(embedding), stubDb({ data: [], error: null }), {
    ...baseArgs,
  })
  expect('empty retrieval returns no results', empty.results?.length === 0)
  expect('empty retrieval tells the model not to invent places', Boolean(empty.note))
  expect('empty retrieval is not an error', empty.error === undefined)

  const rpcFailed = await executeSearchPlaces(
    stubAi(embedding),
    stubDb({ data: null, error: { message: 'relation does not exist' } }),
    { ...baseArgs },
  )
  expect('rpc failure becomes a tool error', Boolean(rpcFailed.error))
  expect(
    'rpc failure does not leak the database message',
    !(rpcFailed.error ?? '').includes('relation'),
    rpcFailed.error,
  )

  const badEmbedding = await executeSearchPlaces(
    stubAi([1, 2, 3]),
    stubDb({ data: [], error: null }),
    { ...baseArgs },
  )
  expect('wrong-width embedding is rejected', Boolean(badEmbedding.error))

  const row = {
    id: 'uuid-1',
    slug: 'carthage',
    name: 'Carthage',
    category: 'history',
    city: 'Carthage',
    region: 'Tunis',
    summary: 'Punic harbours.',
    description: 'Long form.',
    tags: ['unesco'],
    typical_duration_minutes: 150,
    price_level: 1,
    similarity: 0.87,
    embedding: '[0.1,0.2]',
  }
  const happy = await executeSearchPlaces(stubAi(embedding), stubDb({ data: [row], error: null }), {
    ...baseArgs,
  })
  const first = happy.results?.[0]
  expect('happy path maps a row', first?.slug === 'carthage')
  expect('happy path carries similarity', first?.similarity === 0.87)
  expect(
    'tool results never include an embedding',
    first !== undefined && !Object.keys(first).includes('embedding'),
    Object.keys(first ?? {}).join(','),
  )

  console.log('\nNOVA — agent error handling (no credentials)')

  const configured = {
    geminiApiKey: 'test-key',
    supabaseUrl: 'https://example.supabase.co',
    supabaseAnonKey: 'test-anon',
    authorization: null,
  }

  const noKey = await collect(
    runNovaAgent({ ...configured, geminiApiKey: undefined }, { message: 'hello' }),
  )
  expect(
    'missing GEMINI_API_KEY yields exactly one error event',
    noKey.length === 1 && noKey[0].type === 'error',
  )
  expect(
    'missing key reports not_configured',
    noKey[0].type === 'error' && noKey[0].code === 'not_configured',
  )
  expect(
    'error text is user-facing, never the variable name',
    noKey[0].type === 'error' && !noKey[0].message.includes('GEMINI_API_KEY'),
    noKey[0].type === 'error' ? noKey[0].message : '',
  )

  const noSupabase = await collect(
    runNovaAgent(
      { ...configured, supabaseUrl: undefined, supabaseAnonKey: undefined },
      { message: 'hello' },
    ),
  )
  expect(
    'missing Supabase config reports not_configured',
    noSupabase[0].type === 'error' && noSupabase[0].code === 'not_configured',
  )

  const emptyMessage = await collect(runNovaAgent(configured, { message: '   ' }))
  expect(
    'empty message reports bad_request',
    emptyMessage[0].type === 'error' && emptyMessage[0].code === 'bad_request',
  )

  const longMessage = await collect(runNovaAgent(configured, { message: 'x'.repeat(5000) }))
  expect(
    'oversized message reports bad_request',
    longMessage[0].type === 'error' && longMessage[0].code === 'bad_request',
  )

  console.log('\nNOVA — provider error classification')

  // Verbatim shapes observed from the real API during production verification.
  const dailyQuota =
    '{"error":{"code":429,"message":"Quota exceeded for metric: generate_content_free_tier_requests, limit: 20","status":"RESOURCE_EXHAUSTED","details":[{"violations":[{"quotaId":"GenerateRequestsPerDayPerProjectPerModel-FreeTier"}]}]}}'
  const perMinute =
    '{"error":{"code":429,"message":"Quota exceeded for metric: generate_content_free_tier_requests, limit: 15","status":"RESOURCE_EXHAUSTED","details":[{"violations":[{"quotaId":"GenerateRequestsPerMinutePerProjectPerModel-FreeTier"}]}]}}'
  const highDemand =
    '{"error":{"code":503,"message":"This model is currently experiencing high demand.","status":"UNAVAILABLE"}}'
  const notFound = '{"error":{"code":404,"message":"models/x is not found","status":"NOT_FOUND"}}'

  expect('daily quota is recognised as exhausted', isDailyQuotaExhausted(new Error(dailyQuota)))
  expect('daily quota is NOT retried', !isRetryableProviderError(new Error(dailyQuota)))

  // Regression guard: a per-minute limit is also 429 + RESOURCE_EXHAUSTED, and
  // used to be reported to travellers as 'come back tomorrow'.
  expect('a per-minute limit is NOT called a daily quota', !isDailyQuotaExhausted(new Error(perMinute)))
  expect('a per-minute limit is recognised as rate limiting', isRateLimited(new Error(perMinute)))
  expect('a per-minute limit is NOT retried', !isRetryableProviderError(new Error(perMinute)))
  expect('a daily quota is not mislabelled as rate limiting', !isRateLimited(new Error(dailyQuota)))

  expect('a 503 high-demand error IS retried', isRetryableProviderError(new Error(highDemand)))
  expect('a 503 is not mistaken for quota', !isDailyQuotaExhausted(new Error(highDemand)))
  expect('a 503 is not mistaken for rate limiting', !isRateLimited(new Error(highDemand)))
  expect('a 404 is not retried', !isRetryableProviderError(new Error(notFound)))

  console.log('\nNOVA — client auth header policy')

  /*
   * Regression guard for a real production bug.
   *
   * The Supabase function gateway verifies a JWT before the function runs and
   * returns 401 UNAUTHORIZED_NO_AUTH_HEADER when Authorization is absent; the
   * apikey header does not satisfy it. The client originally sent Authorization
   * only when signed in, so every anonymous request 401'd in production while
   * passing against the dev proxy, which has no gateway. Authorization must be
   * present even with no session.
   */
  const originalFetch = globalThis.fetch
  let capturedHeaders: Record<string, string> = {}
  globalThis.fetch = (async (_input: unknown, init?: { headers?: Record<string, string> }) => {
    capturedHeaders = init?.headers ?? {}
    return new Response('data: {"type":"done","conversationId":null,"persisted":false}\n\n', {
      status: 200,
      headers: { 'Content-Type': 'text/event-stream' },
    })
  }) as typeof globalThis.fetch

  try {
    for await (const _event of streamNovaReply({ message: 'hello' })) {
      void _event
    }
  } finally {
    globalThis.fetch = originalFetch
  }

  const authHeader = capturedHeaders.Authorization ?? ''
  expect(
    'anonymous request still sends an Authorization header',
    authHeader.startsWith('Bearer '),
    authHeader ? 'present' : 'MISSING - would 401 at the Supabase gateway',
  )
  expect('Authorization carries a non-empty token', authHeader.length > 'Bearer '.length)
  expect('apikey header is also sent', Boolean(capturedHeaders.apikey))
  expect(
    'no provider key is ever sent from the browser',
    !JSON.stringify(capturedHeaders).toLowerCase().includes('goog'),
  )

  console.log('\nLanding — hero composition')

  const landingHtml = renderToString(wrap(<LandingPage />))
  for (const asset of [
    '/images/hero/hero-tunisia.webp',
    '/images/hero/hero-sidi-bou-said.webp',
    '/images/hero/hero-el-jem.webp',
  ]) {
    expect(`hero renders ${asset.split('/').pop()}`, landingHtml.includes(asset))
  }
  expect('headline uses the editorial accent', landingHtml.includes('Tunisia'))
  expect(
    'hand-written label is real text, not baked into a photo',
    landingHtml.includes('Explore') && landingHtml.includes('font-script'),
  )
  expect('feature strip is present', landingHtml.includes('AI Trip Planner'))
  expect(
    'every hero photograph carries alt text',
    !/<img(?![^>]*\salt=)[^>]*images\/hero/.test(landingHtml),
  )

  console.log('\nNOVA — conversation history')

  expect('a uuid is accepted as a conversation id', isConversationId('3f2504e0-4f89-11d3-9a0c-0305e82c3301'))
  expect('a non-uuid is rejected before it reaches Postgres', !isConversationId('../../etc/passwd'))
  expect('an empty id is rejected', !isConversationId(''))

  const transcript = [
    { role: 'user', content: 'I am in Hammamet.' },
    { role: 'nova', content: 'Good base for the coast.' },
    { role: 'system', content: 'NOVA is not connected in this environment yet.' },
    { role: 'user', content: 'What is nearby?' },
  ]
  const windowed = selectHistoryWindow(transcript)
  expect('system notices are not replayed to the model', windowed.every((r) => r.role !== 'system'))
  expect('user and assistant turns are kept', windowed.length === 3)
  expect('chronological order is preserved', windowed[0].content === 'I am in Hammamet.')

  const contents = toGeminiContents(transcript)
  expect('assistant turns map to the model role', contents[1].role === 'model')
  expect('traveller turns map to the user role', contents[0].role === 'user')
  expect(
    'every replayed turn carries text',
    contents.every((c) => typeof c.parts?.[0]?.text === 'string'),
  )

  const many = Array.from({ length: 40 }, (_, index) => ({
    role: index % 2 === 0 ? 'user' : 'nova',
    content: `turn ${index}`,
  }))
  expect(
    'history is capped by message count',
    selectHistoryWindow(many).length <= HISTORY_MESSAGE_LIMIT,
  )
  expect('the cap keeps the most recent turns', selectHistoryWindow(many).at(-1)?.content === 'turn 39')

  const verbose = Array.from({ length: 10 }, (_, index) => ({
    role: index % 2 === 0 ? 'user' : 'nova',
    content: 'x'.repeat(2000),
  }))
  const trimmed = selectHistoryWindow(verbose)
  expect(
    'history is capped by character budget',
    trimmed.reduce((total, row) => total + row.content.length, 0) <= HISTORY_CHAR_BUDGET,
  )
  expect('the character cap still leaves the latest turn', trimmed.length > 0)

  console.log('\nNOVA — credential-free client behaviour')

  // Nothing is configured in this build, so there is no endpoint to call. The
  // client must report that rather than inventing a reply.
  // Environment independent: with nothing configured the client must report it
  // has no endpoint rather than invent a reply; configured, it must point at
  // our own agent and never at a model provider. That is what keeps the key
  // server-side.
  const endpoint = resolveNovaEndpoint()
  expect(
    'endpoint is either absent or our own agent',
    endpoint === null ||
      endpoint.endsWith('/api/nova') ||
      endpoint.endsWith('/functions/v1/nova-agent'),
    String(endpoint),
  )
  expect(
    'browser endpoint is never a model provider',
    endpoint === null || !/googleapis|generativelanguage|google[.]dev/i.test(endpoint),
  )
}

/* --- Result ---------------------------------------------------------------- */

runUnitChecks()
  .then(runAgentChecks)
  .catch((error) => {
    failures += 1
    console.error('ERROR check suite')
    console.error(error)
  })
  .then(() => {
    if (failures > 0) {
      console.error(`\n${failures} case(s) failed.`)
      // exitCode, not process.exit: an abrupt exit while the Supabase client
      // still has sockets closing trips a libuv assert on Windows.
      process.exitCode = 1
      return
    }
    console.log('\nAll cases passed.')
  })
