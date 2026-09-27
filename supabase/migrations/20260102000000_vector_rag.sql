-- =============================================================================
-- TuniTrip AI — pgvector + semantic retrieval for NOVA
--
-- Additive migration. It does not alter, drop or rewrite anything created by
-- 20260101000000_init.sql / _rls.sql / _storage.sql.
--
-- Design notes
--   * Embeddings live in their OWN table, never as a column on `places`.
--     The app reads the catalogue with `select('*')` in several places
--     (fetchPlaces, the itinerary place hydration); a vector column would drag
--     768 floats across the wire on every Discover page load. A side table also
--     lets us re-embed, or run two embedding models side by side, without
--     touching the catalogue or its RLS.
--   * 768 dimensions, not the model default of 3072: pgvector's HNSW and
--     ivfflat indexes cap at 2000 dimensions for the `vector` type, so 3072
--     could not be indexed. gemini-embedding-001 supports Matryoshka
--     truncation to 768 — vectors MUST be L2-normalised by the writer, because
--     that model only auto-normalises at its native 3072.
--   * Retrieval is exposed exclusively through `match_places()`. The table
--     itself is unreadable by anon/authenticated, so raw vectors never reach a
--     browser, and the function returns similarity scores rather than vectors.
-- =============================================================================

-- Supabase keeps extensions out of `public`; `create extension` below targets
-- that schema, and the pinned search_path resolves `vector` either way (a
-- project that already installed pgvector into `public` keeps working).
create schema if not exists extensions;
create extension if not exists vector with schema extensions;

set search_path = public, extensions;

-- --- place_embeddings --------------------------------------------------------
create table public.place_embeddings (
  id           uuid primary key default gen_random_uuid(),
  place_id     uuid not null references public.places (id) on delete cascade,
  -- Embedding model that produced this vector, e.g. 'gemini-embedding-001'.
  model        text not null,
  -- Denormalised vector width. Redundant with the column type today, but it
  -- makes each row self-describing when a second model/width is introduced.
  dim          smallint not null,
  embedding    vector(768) not null,
  -- SHA-256 of the exact text that was embedded. Lets the pipeline skip a
  -- place whose catalogue entry has not changed since the last run.
  content_hash text not null,
  created_at   timestamptz not null default now(),

  -- One current vector per place per model; the pipeline upserts on this key.
  constraint place_embeddings_place_model_key unique (place_id, model),
  constraint place_embeddings_dim_matches check (dim = 768)
);

comment on table public.place_embeddings is
  'Semantic vectors for the public places catalogue. Written by the embedding pipeline (service role) and read only through public.match_places().';

create index place_embeddings_place_idx on public.place_embeddings (place_id);

-- Cosine distance (<=>) matches how the embeddings are compared at query time.
-- Build parameters are the pgvector defaults, stated explicitly so a future
-- catalogue of thousands of places can be tuned without guessing the baseline.
create index place_embeddings_embedding_idx
  on public.place_embeddings
  using hnsw (embedding vector_cosine_ops)
  with (m = 16, ef_construction = 64);

-- --- Row level security ------------------------------------------------------
-- RLS on with NO policies for anon/authenticated: deny by default. The only
-- writer is the embedding pipeline, which authenticates with the service role
-- and therefore bypasses RLS. The grants are revoked as well, so the intent is
-- unmistakable at the catalog level and not only at the policy level.
alter table public.place_embeddings enable row level security;

revoke all on table public.place_embeddings from anon, authenticated;

-- --- Retrieval ---------------------------------------------------------------
-- Returns catalogue columns plus a similarity score. Deliberately does NOT
-- return `embedding` — a browser never needs the vector, and shipping it would
-- undo the point of the side table.
--
-- security definer because place_embeddings is unreadable by the calling roles;
-- the function is the single audited hole in that wall. It is safe because the
-- data it surfaces (public.places) is already world-readable under its own RLS
-- policy, and search_path is pinned at definition time so the body cannot be
-- redirected to attacker-controlled objects.
create or replace function public.match_places(
  query_embedding vector(768),
  match_count integer default 8,
  filter_category public.place_category default null
)
returns table (
  id                       uuid,
  slug                     text,
  name                     text,
  category                 public.place_category,
  city                     text,
  region                   text,
  summary                  text,
  description              text,
  latitude                 double precision,
  longitude                double precision,
  media_key                text,
  price_level              smallint,
  rating                   numeric,
  review_count             integer,
  tags                     text[],
  typical_duration_minutes integer,
  is_featured              boolean,
  similarity               double precision
)
language sql
stable
security definer
set search_path = public, extensions
as $$
  select
    p.id,
    p.slug,
    p.name,
    p.category,
    p.city,
    p.region,
    p.summary,
    p.description,
    p.latitude,
    p.longitude,
    p.media_key,
    p.price_level,
    p.rating,
    p.review_count,
    p.tags,
    p.typical_duration_minutes,
    p.is_featured,
    -- Cosine distance -> similarity. Both operands are unit vectors, so this
    -- lands in [0, 1] with 1 meaning "identical direction".
    1 - (pe.embedding <=> query_embedding) as similarity
  from public.place_embeddings pe
  join public.places p on p.id = pe.place_id
  where filter_category is null or p.category = filter_category
  order by pe.embedding <=> query_embedding
  -- Clamped so a caller cannot ask for an unbounded scan.
  limit least(greatest(coalesce(match_count, 8), 1), 50);
$$;

comment on function public.match_places(vector, integer, public.place_category) is
  'Semantic search over the public places catalogue. Returns catalogue columns plus a cosine similarity score; never returns embeddings.';

revoke all on function public.match_places(vector, integer, public.place_category) from public;
grant execute on function public.match_places(vector, integer, public.place_category)
  to anon, authenticated, service_role;
