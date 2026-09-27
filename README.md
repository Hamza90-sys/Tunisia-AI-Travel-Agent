# TuniTrip AI

> What if visiting Tunisia was as simple as talking to a local?

We help travellers discover places in Tunisia and start planning a trip from a
natural-language request. Our prototype, **TuniTrip AI**, provides a Tunisia
catalogue, discovery pages, a planner, trip and reservation views, and **NOVA**,
an AI travel companion. We use Gemini for NOVA's responses and query embeddings,
then use Supabase pgvector retrieval to ground place recommendations in the
catalogue. We tested the routes and data-driven components with the SSR smoke
suite, where those checks pass; the full suite currently stops at an agent
database mock boundary (`db.from is not a function`). Configured environments
can also run end-to-end RAG and NOVA persistence checks. Current limitations:
itinerary generation, trip writes, reservations, booking providers,
availability and maps are not fully connected. Next step: connect grounded
retrieval to itinerary generation and persist the resulting trip data.

**This repository is Step 1: the production foundation.** Architecture, design
system, NOVA's visual identity, app shell, routing, Supabase backend and the
full component library. The reasoning engine is deliberately *not* connected,
and nothing in the UI pretends otherwise.

---

## Quick start

```bash
npm install
cp .env.example .env.local     # optional — the app runs without it
npm run dev                    # http://localhost:5173
```

Without Supabase credentials the app boots in **catalogue mode**: every page
renders from the local Tunisia catalogue in `src/data`, and auth surfaces say
plainly that accounts are not connected. Add the two env vars and the same
screens switch to live Postgres with no code change.

### Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Vite dev server on :5173 |
| `npm run build` | Typecheck (`tsc -b`) then production build |
| `npm run preview` | Serve the production build |
| `npm run typecheck` | Full TypeScript check |
| `npm run lint` | oxlint |
| `npm run smoke` | Render every route + component and assert output |
| `npm run verify` | typecheck → lint → smoke |
| `npm run db:seed` | Regenerate `supabase/seed.sql` from `src/data/places.ts` |
| `npm run db:embed` | Embed the catalogue into `place_embeddings` (`-- --dry-run` to check locally) |
| `npm run db:verify-rag` | Run a real semantic query through `match_places` |
| `npm run db:embed` | Embed the catalogue into `place_embeddings` (add `-- --dry-run` to skip the network) |
| `npm run db:verify-rag` | Run a semantic query through `match_places` and print the ranked result |

---

## Environment

```ini
# Browser-safe — bundled into the client, protected by row level security
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon / publishable key>

# SERVER ONLY — never prefix these with VITE_
GEMINI_API_KEY=<google ai studio key>
SUPABASE_SERVICE_ROLE_KEY=<service role key>
```

Vite exposes a variable to browser code if, and only if, its name starts with
`VITE_`. `GEMINI_API_KEY` and `SUPABASE_SERVICE_ROLE_KEY` deliberately do not:
they are read by Node-side scripts only, and `@google/genai` is a
**devDependency** so it cannot be pulled into the client bundle.

| Variable | Scope | Needed by |
| --- | --- | --- |
| `VITE_SUPABASE_URL` | browser-safe | app, `db:embed`, `db:verify-rag` |
| `VITE_SUPABASE_ANON_KEY` | browser-safe | app, `db:verify-rag` |
| `GEMINI_API_KEY` | **server only** | `db:embed`, `db:verify-rag` |
| `SUPABASE_SERVICE_ROLE_KEY` | **server only** | `db:embed` |

All four are optional for running the app. Vite reads env files at startup —
restart the dev server after editing `.env.local`.

### Populating the RAG index

```bash
npm run db:embed              # src/data/places.ts -> gemini-embedding-001 -> place_embeddings
npm run db:verify-rag -- "historic Roman sites near Tunis"
```

`db:embed` skips any place whose `content_hash` is unchanged, so re-running it
costs nothing. Until it has run, `place_embeddings` is empty and `matchPlaces()`
returns nothing — which is the point. There is no keyword fallback dressed up as
semantic search, so an un-run pipeline is visible rather than disguised.

Backend setup lives in [`supabase/README.md`](supabase/README.md).

---

## NOVA

NOVA is an abstract Mediterranean orb: a turquoise core, wave patterns moving
inside it, a soft glow. No face, no robot, no stock AI iconography. It is the
product's mark — the same orb sits in the logo, the nav, the planner and the
floating assistant button.

```tsx
<NovaAvatar state="planning" size="lg" />
```

| State | Signal |
| --- | --- |
| `idle` | Slow breath, drifting waves |
| `thinking` | Faster pulse, ring accelerates |
| `searching` | A satellite point orbits the rim |
| `planning` | Concentric rings expand outward |
| `success` | A single bloom settles into a sand-lit rim |

Every state changes tempo and adds *one* mark, so the orb stays recognisably
the same object throughout the product. All motion is transform/opacity only
and collapses under `prefers-reduced-motion`.

Related components: `NovaPlanningState` (the planning checklist),
`NovaPanel` (global assistant drawer), `NovaFloatingButton`, `NovaInlinePrompt`.

### What NOVA can do

NOVA is a real Gemini agent running server-side. One tool so far:

| | |
| --- | --- |
| Model | `gemini-3.8-flash` |
| Tool | `search_places` — semantic search over the catalogue |
| Retrieval | `match_places` RPC over pgvector (the same one `db:verify-rag` uses) |
| Transport | SSE from a Supabase Edge Function, mirrored by a Vite dev proxy |

The orb states are driven by real server events: `thinking` while the model
composes, `searching` while `search_places` is actually executing, `success`
when an answer arrives. Nothing is simulated, and no reply is ever fabricated —
if the agent cannot be reached, the traveller is told so.

NOVA is instructed to ground factual claims about places in what retrieval
returned, to say when the catalogue does not cover a question, and never to
claim a booking was made.

**Not built yet:** itinerary generation, trip writes, reservations, booking
providers, availability, maps. NOVA says so plainly when asked.

Architecture and deployment: [`supabase/README.md`](supabase/README.md).

---

## Design system

Defined once as Tailwind v4 theme tokens in [`src/index.css`](src/index.css).

| Role | Token | Hex |
| --- | --- | --- |
| Primary — Deep Mediterranean Navy | `ink-800` | `#0B1F33` |
| Secondary — Mediterranean Turquoise | `sea-500` | `#18A6A6` |
| Accent — Warm Sand | `sand-500` | `#D8B47A` |
| Background — Warm Off-White | `canvas` | `#F7F5F0` |
| AI surfaces | `ink-900` | `#07131F` |

Each anchor carries a full derived scale (`ink-50`…`ink-950`). Colour is used
sparingly: most surfaces are canvas or ink, with turquoise reserved for NOVA and
interactive accents, and sand for moments of success or emphasis.

Type is **Fraunces** for display and **Inter** for UI. Custom utilities:
`eyebrow`, `grain`, `no-scrollbar`, `mask-fade-x`, `shimmer-sweep`.

### Imagery

No stock photography ships in Step 1. `src/data/media.ts` is a registry of
named media slots; `<MediaFrame mediaKey="carthage" />` resolves each slot in
order: Supabase Storage object → curated remote image → **designed procedural
artwork** (a per-motif composition drawn in SVG — waves, arches, dunes,
skyline, terrace, peaks). A failed image load falls back to the artwork rather
than a broken icon.

Dropping in real Tunisia photography is one line per slot, in one file.

---

## Architecture

```
src/
  animations/      shared Framer Motion variants and easings
  components/
    itinerary/     RouteMap, DaySelector, ItineraryTimeline, ActivityCard, TripSummary
    layout/        AppShell, Navbar, MobileNav, Footer, PageHeader, Logo
    nova/          NovaAvatar, NovaPanel, NovaPlanningState, NovaFloatingButton
    places/        PlaceCard, PlaceGrid, CategoryRail
    reservations/  ReservationCard, ReservationList
    ui/            Button, Card, Chip, Input, Badge, MediaFrame, Empty/Error/Skeleton states
  data/            Tunisia catalogue, demo trip, media registry, geography
  hooks/           useAuth, useNova, useAsync, useNovaPlanning, useMediaQuery, …
  lib/
    supabase/      client, auth, queries, row → domain mappers
    utils/         cn, formatting, constants, geo projection
  pages/           Landing, Planner, Trip, Discover, Reservations, Auth
  types/           domain models + hand-written Database types
supabase/
  migrations/      schema, RLS, storage
  seed.sql         generated from src/data/places.ts
```

### Routes

| Path | Page |
| --- | --- |
| `/` | Landing |
| `/planner` | AI trip planner |
| `/trip` | Trip dashboard |
| `/discover` | Discover Tunisia (`?category=beach` is shareable) |
| `/reservations` | My reservations (sign-in required) |
| `/login` | Sign in with Google |
| `/auth/callback` | Where Google returns the traveller |

Pages are code-split; auth routes render outside `AppShell` because they own the
viewport. `/trip` and `/reservations` render a traveller's own records, so both
sit behind `RequireAuth`, which offers the Google CTA in place of an empty
shell.

### Authentication

**Google is the only identity provider.** There is no email field, no password
field, no sign-up form and no reset flow anywhere in this codebase —
`src/lib/supabase/auth.ts` exposes `signInWithGoogle` and nothing else, and the
smoke suite fails if a `type="password"` input reappears on any auth surface.

One button, `<GoogleButton />`, is the single code path into an account. It is
rendered in the header, the hero, the footer, the sign-in route and the global
`<AuthModal />` (opened through `useAuthModal()` so a visitor is never routed
away from what they were reading).

Enabling the provider is a one-time dashboard step — see `.env.example`.

### Data flow

Components never import fixtures or talk to Supabase directly. Every read goes
through `src/lib/supabase/queries.ts` and returns one envelope:

```ts
{ data, error }
```

**There is no local fallback.** An empty table renders an empty state and a
failed request renders an error state, because a product that silently
substitutes sample data for a broken backend is lying to whoever is looking at
it. `src/data/places.ts` still exists as the seed source for `db:seed` and
`db:embed`, and `src/data/index.ts` deliberately does not re-export it so no
page can reach it by accident.

Row → domain translation lives in `mappers.ts`; the UI only ever sees camelCase
domain models.

### Responsive

Desktop-first, but each breakpoint gets the right *pattern*, not a shrunken
one: the desktop nav is replaced by a bottom tab bar, the NOVA drawer becomes a
bottom sheet, the itinerary's time column moves above its card, and category
rails scroll horizontally with faded edges.

### Accessibility

Semantic landmarks and a skip link; tabs, radio groups and toggles use the
matching ARIA roles and states; the planning checklist is `aria-live`; the
assistant drawer is a labelled `aria-modal` dialog with Escape-to-close and
focus-on-open; decorative art is `aria-hidden`; and all motion respects
`prefers-reduced-motion`.

---

## Verification

`npm run verify` runs a typecheck, the linter, and a render smoke test that
mounts all 8 routes and 25 component cases (including every loading, empty and
error state) through the real providers and asserts each produces markup.

---

## Status

Step 1 ships architecture, visual identity, design system, app shell, routing,
the Supabase foundation, NOVA's component family, responsive UI and the
reusable component library. Live AI reasoning, real search, maps and bookings
are Step 2.
