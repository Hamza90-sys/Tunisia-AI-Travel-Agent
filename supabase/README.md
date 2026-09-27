# Supabase setup

Everything the app needs on the backend: schema, row level security, a public
storage bucket and a generated catalogue seed.

## Files

| File | What it does |
| --- | --- |
| `migrations/20260101000000_init.sql` | Enums, tables, indexes, `updated_at` triggers, `handle_new_user` |
| `migrations/20260101000100_rls.sql` | Row level security policies for every table |
| `migrations/20260101000200_storage.sql` | Public `place-media` bucket + read policy |
| `migrations/20260102000000_vector_rag.sql` | pgvector, `place_embeddings`, HNSW index, `match_places()` |
| `migrations/20260102000100_nova_persistence.sql` | `nova_messages.tool_results`, `nova_conversations.provider_interaction_id` |
| `seed.sql` | 25 curated Tunisia places — **generated**, see below |

## Option A — hosted project (fastest)

1. Create a project at <https://supabase.com/dashboard>.
2. Open **SQL Editor** and run, in order:
   - `migrations/20260101000000_init.sql`
   - `migrations/20260101000100_rls.sql`
   - `migrations/20260101000200_storage.sql`
   - `migrations/20260102000000_vector_rag.sql`
   - `migrations/20260102000100_nova_persistence.sql`
   - `seed.sql`
3. Copy **Project URL** and the **anon / publishable key** from
   *Project settings → API* into `.env.local` (see `.env.example`).
4. Restart `npm run dev` — Vite only reads env files at startup.

## Option B — Supabase CLI

```bash
npx supabase init          # once, if supabase/config.toml does not exist
npx supabase link --project-ref <your-project-ref>
npx supabase db push       # applies everything in migrations/
npx supabase db execute --file supabase/seed.sql
```

For a fully local stack, `npx supabase start` runs Postgres, Auth and Storage in
Docker and applies the migrations automatically; use the printed local URL and
anon key in `.env.local`.

## Auth configuration

- **Google is the only provider the UI uses.** There is no email/password path
  in the codebase, so the Email provider can be switched off entirely.
- Enable it in three places, once:
  1. *Google Cloud console → Credentials → OAuth 2.0 Client ID (Web)* with the
     authorised redirect URI `https://<project-ref>.supabase.co/auth/v1/callback`
  2. *Supabase → Authentication → Providers → Google* — paste the client ID and
     secret, enable
  3. *Supabase → Authentication → URL Configuration* — add your site URL and
     `http://localhost:5173` to the redirect allow-list
- `handle_new_user()` copies `full_name` out of `raw_user_meta_data`, which is
  where Google's OAuth response puts the display name, so a profile row always
  exists for a signed-in user. The avatar is read from the session's
  `user_metadata.avatar_url` in the client rather than copied into `profiles`.
- Until step 2 is done the button reports the provider's own error. It never
  pretends to sign anyone in.

## Regenerating the seed

`supabase/seed.sql` is generated from `src/data/places.ts`, which is a seed
source only — the UI never reads it, so the catalogue you see in the app is
always whatever is in Postgres. Edit the TypeScript
catalogue, then:

```bash
npm run db:seed
```

The insert is idempotent (`on conflict (slug) do update`), so it is safe to run
repeatedly.

## Regenerating types

`src/types/database.ts` is hand-written to match these migrations. Once the
project is linked you can replace it with generated output:

```bash
npx supabase gen types typescript --linked > src/types/database.ts
```

> One caveat if you hand-edit that file: Supabase's `GenericTable` constraint
> requires each `Row` to satisfy `Record<string, unknown>`. Declare rows as
> object **type aliases**, not interfaces — interfaces have no implicit index
> signature, and the mismatch silently degrades every query result to `never`.

## Semantic retrieval (RAG)

NOVA finds places by meaning, not by keyword. The pieces:

```
src/data/places.ts  ->  gemini-embedding-001  ->  L2 normalise  ->  place_embeddings
                                                                          |
                     NOVA query  ->  embed  ->  match_places()  <---------+
```

**Why embeddings are not a column on `places`.** The app reads the catalogue
with `select('*')` in several places. A `vector(768)` column would ship 768
floats on every Discover page load. A side table also lets us re-embed, or run
two models side by side, without touching the catalogue or its RLS.

**Why 768 dimensions and not the model's native 3072.** pgvector's HNSW and
ivfflat indexes cap at 2000 dimensions for the `vector` type, so 3072 could not
be indexed at all. `gemini-embedding-001` supports Matryoshka truncation to
768 — but it only auto-normalises at 3072, so **the writer must L2-normalise**
truncated vectors. `l2Normalize()` in `src/lib/rag/vector.ts` does this, and
the smoke test asserts the result is a unit vector.

`EMBEDDING_DIM` in `src/lib/rag/vector.ts` is a schema contract with
`vector(768)` in the migration. `npm run verify` cross-checks the two and fails
if they drift.

### Security

| Object | Decision |
| --- | --- |
| `place_embeddings` | RLS **on with zero policies** — deny by default. Table grants are also revoked from `anon`/`authenticated`, so the intent is visible at the catalog level, not only in a policy. |
| Writes | Only the service role, which bypasses RLS. The offline embedding pipeline is the sole writer; nothing in the browser can insert a vector. |
| `match_places()` | `security definer`, the single audited hole in that wall. Safe because everything it surfaces already lives in the world-readable `places` table, and it returns **similarity scores, never embeddings**. |
| search_path | Pinned at definition time (`public, extensions`) so the function body cannot be redirected to attacker-controlled objects. |
| `match_count` | Clamped server-side to 1..50 so a caller cannot request an unbounded scan. |

### Populating the index

```bash
npm run db:embed              # embed every changed place
npm run db:embed -- --dry-run # local half only: no Gemini, no Supabase
npm run db:embed -- --force   # re-embed everything, ignoring content_hash
npm run db:embed -- --prune   # also delete rows for places no longer in the catalogue
npm run db:verify-rag         # semantic query -> match_places -> ranked results
```

`npm run db:embed` populates `place_embeddings`. It reads `src/data/places.ts`
as the only source of truth, builds deterministic text per place, hashes it,
embeds with `gemini-embedding-001` at 768 dimensions, L2-normalises, and upserts
on `(place_id, model)`.

Re-running is cheap and safe: a place whose `content_hash` is unchanged is
skipped, so a second run embeds nothing. Failures are always reported and never
swallowed — a run with any failure exits non-zero and says which place failed
and why.

**Deleted places.** Rows whose `place_id` is no longer in the catalogue are
*reported, not removed*. Deleting data is not something a sync script should do
implicitly, so it is opt-in via `--prune`. To remove them by hand instead:

```sql
delete from public.place_embeddings pe
where not exists (select 1 from public.places p where p.id = pe.place_id);
```

**Credentials.** The pipeline needs `GEMINI_API_KEY` and
`SUPABASE_SERVICE_ROLE_KEY`, both **server-only** (no `VITE_` prefix, never in
the browser). The service role is required because `place_embeddings` denies
writes to every other role — that is the RLS design working, not a workaround.

`npm run db:verify-rag` deliberately uses the **anon** key instead, so it proves
the security model end to end: the anon role cannot select from
`place_embeddings`, yet `match_places` still returns ranked results.

Retrieval is reached from the app through `matchPlaces()` in
`src/lib/supabase/queries.ts`, which returns the usual `{ data, error }`
envelope. It has **no keyword fallback**: when Supabase is absent it returns an
error, and when `place_embeddings` is empty it returns no rows.

That is deliberate. A keyword fallback labelled as semantic search would hide an
un-run embedding pipeline behind plausible-looking results, and "the retrieval
index is empty" is something the operator needs to see, not something the
product should paper over.

## Data model

```
auth.users
   └── profiles (1:1)
         ├── trips
         │     ├── trip_preferences        (trip_id, preference)
         │     └── trip_days
         │           └── itinerary_items ──► places
         ├── reservations ──► places, trips
         ├── saved_places ──► places
         ├── reviews ──► places, trips       (public once is_published)
         └── nova_conversations            (+ provider_interaction_id)
               └── nova_messages           (+ tool_calls, tool_results)

places
   └── place_embeddings (1 row per model)  ──► read only via match_places()
```

`place_embeddings` hangs off `places` (cascade on delete) and is unreadable
from the browser; see **Semantic retrieval** above.

`places` is a public, read-only catalogue. Everything else is owner-scoped:
trip children are protected through `public.owns_trip(trip_id)`, so guessing an
itinerary id gets you nothing.

`reviews` is the one table with a public read *and* a client write: anyone may
read a row once `is_published` is true, and a signed-in traveller may write,
edit and delete their own. `is_published` cannot be set from the client at all —
the `reviews_guard_publication` trigger forces it back to its previous value
whenever the caller is `anon` or `authenticated`, so the RLS policy cannot be
sidestepped by an UPDATE that flips the flag.

**Nothing seeds `reviews`.** `supabase/seed.sql` covers the catalogue only. The
landing page's testimonial section reads this table and renders an empty state
until real travellers write real reviews — inventing testimonials is the one
thing a travel product must never do. If the migration has not been applied,
`fetchReviews()` treats the missing relation as "no reviews" rather than an
error, so an un-migrated environment shows the same empty state.

`nova_conversations` and `nova_messages` are not written yet. They are shaped
for the Gemini Interactions API: because that API keeps conversation state
server-side and resumes from `previous_interaction_id`, the client never
replays a wire-format transcript. These tables are therefore our own display
and audit log, which is why the display roles stay `user` / `nova` / `system`
and no enum change was needed.

## NOVA agent (Edge Function)

`supabase/functions/nova-agent` is the server-side Gemini agent. The browser
posts a message to it and reads a stream of events back; it never talks to
Gemini directly and holds no provider key.

### Secrets

The function needs exactly one secret. `SUPABASE_URL` and `SUPABASE_ANON_KEY`
are injected by the platform, and there is deliberately **no service-role key**:
the agent runs entirely under the caller's own JWT, so `match_places` and the
`nova_messages` writes are governed by the RLS already in place.

```bash
supabase secrets set GEMINI_API_KEY=your-key
supabase secrets list          # confirm it is set
```

### Deploy

```bash
supabase link --project-ref <your-project-ref>   # once
supabase functions deploy nova-agent
```

The function is verified by default, meaning Supabase requires an `apikey`
header. The browser client sends the anon key, so no `--no-verify-jwt` flag is
needed or wanted.

### Check it

```bash
curl -N -X POST \
  "https://<project-ref>.supabase.co/functions/v1/nova-agent" \
  -H "apikey: <anon-key>" \
  -H "Content-Type: application/json" \
  -d '{"message":"historic Roman sites near Tunis"}'
```

A healthy response is a stream of `data:` lines ending in a `done` event. A
`not_configured` error means `GEMINI_API_KEY` was not set as a secret.

Logs: `supabase functions logs nova-agent`.

### Local development

`npm run dev` needs no deployment. `vite.config.ts` registers a dev-only
middleware on `/api/nova` that loads the *same* `agent.ts` through Vite's SSR
module loader and streams the same events, reading `GEMINI_API_KEY` from
`.env.local` on the Node side. One agent implementation, two transports — so
local behaviour and deployed behaviour cannot drift.

### Model quota — read before a demo

The free Gemini tier caps `gemini-3.8-flash` at **20 `generateContent` requests
per day**. One NOVA message costs two (one to decide on the tool, one to answer),
so the default model supports roughly **ten messages a day**. Production
verification exhausted it, which is how this was found.

`gemini-3.5-flash-lite` was verified working with headroom. Switch without
touching code by setting the server-side variable:

```bash
# local
echo "NOVA_MODEL=gemini-3.5-flash-lite" >> .env.local

# deployed
supabase secrets set NOVA_MODEL=gemini-3.5-flash-lite
```

`NOVA_MODEL` has no `VITE_` prefix, so it never reaches the browser. Check your
own limits at <https://ai.dev/rate-limit>.

A daily-quota 429 is classified as terminal and surfaces as `quota_exceeded`
("NOVA has reached its daily request limit for today"). It is deliberately **not**
retried — the API suggests "retry in 51s", which is wrong for a per-day quota.
Transient 503 "high demand" responses *are* retried, up to 3 attempts with
exponential backoff.

### Verifying the agent

```bash
npm run verify:nova                    # against the Vite dev proxy
npm run verify:nova -- --endpoint=https://<ref>.supabase.co/functions/v1/nova-agent
```

41 assertions covering a real authenticated request, persistence read back with
the user's own JWT, RLS isolation between two real users, anonymous behaviour,
the error matrix and a secret-leak audit of the wire. It creates and deletes two
throwaway auth users; the service-role key is used **only** for those fixtures,
never for an assertion.

### The auth boundary (measured against the deployed function)

JWT verification is **on**. The gateway checks `Authorization` before your
function code runs. Measured behaviour:

| Request | Result |
| --- | --- |
| `apikey` only, no `Authorization` | `401 UNAUTHORIZED_NO_AUTH_HEADER` — function never runs |
| no headers | `401 UNAUTHORIZED_NO_AUTH_HEADER` |
| `Authorization: Bearer <malformed>` | `401 UNAUTHORIZED_INVALID_JWT_FORMAT` — function never runs |
| `Authorization: Bearer <anon key>` | **200** — runs as the `anon` role, answers, persists nothing |
| `Authorization: Bearer <user JWT>` | **200** — runs as that user, persists under their RLS |

Two consequences worth internalising:

**The `apikey` header does not authenticate a function call.** Only
`Authorization` does. The anon key happens to be a valid project JWT, which is
what makes anonymous NOVA possible *without* turning JWT verification off — the
client always sends `Authorization: Bearer <session token ?? anon key>`.

**A malformed JWT is rejected before the function.** That is stricter than any
application check, so there is no application-level error to observe for that
case in production. The dev proxy has no gateway, so the same request reaches
the agent and the grounding guard turns it into `retrieval_error`. Both are
correct for their transport; `npm run verify:nova` asserts whichever applies and
prints which boundary is in play.

Do **not** deploy with `--no-verify-jwt` to "fix" anonymous access. That would
expose the function to unauthenticated callers on the open internet and let
anyone spend your Gemini quota.
