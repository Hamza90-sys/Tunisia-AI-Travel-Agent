-- =============================================================================
-- TuniTrip AI — initial schema
--
-- Design notes
--   * Relational, not one JSON blob: trip -> trip_days -> itinerary_items, with
--     itinerary_items referencing the shared `places` catalogue. This lets the
--     AI agent patch a single block ("make tomorrow cheaper") instead of
--     rewriting a document, and lets Postgres enforce the shape.
--   * Enums for every closed set, mirrored one-for-one in src/types.
--   * `nova_conversations` / `nova_messages` exist from day one so the Step 2
--     agent has somewhere to persist transcripts and tool calls.
-- =============================================================================

create extension if not exists "pgcrypto";

-- --- Enums -------------------------------------------------------------------
create type public.place_category as enum (
  'beach', 'history', 'food', 'rooftop', 'nightlife', 'nature', 'adventure', 'stay'
);

create type public.trip_status as enum (
  'draft', 'planning', 'ready', 'active', 'completed', 'archived'
);

create type public.budget_level as enum ('shoestring', 'balanced', 'elevated', 'luxury');

create type public.preference_tag as enum (
  'beaches', 'history', 'food', 'nightlife', 'nature', 'adventure'
);

create type public.itinerary_kind as enum (
  'activity', 'meal', 'transfer', 'stay', 'experience', 'free'
);

create type public.reservation_type as enum ('hotel', 'restaurant', 'experience');

create type public.reservation_status as enum ('pending', 'confirmed', 'cancelled', 'completed');

create type public.nova_message_role as enum ('user', 'nova', 'system');

-- --- Shared trigger ----------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- --- profiles ----------------------------------------------------------------
-- One row per auth user. Created automatically by handle_new_user().
create table public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  full_name    text,
  avatar_url   text,
  home_country text,
  locale       text        not null default 'en',
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, nullif(new.raw_user_meta_data ->> 'full_name', ''))
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- --- places ------------------------------------------------------------------
-- Public, read-only catalogue. Shared by Discover, the planner and the agent.
create table public.places (
  id                       uuid primary key default gen_random_uuid(),
  slug                     text not null unique,
  name                     text not null,
  category                 public.place_category not null,
  city                     text not null,
  region                   text not null,
  summary                  text not null,
  description              text,
  latitude                 double precision,
  longitude                double precision,
  -- Key into the client media registry, or an object path in Storage.
  media_key                text,
  price_level              smallint check (price_level between 1 and 4),
  rating                   numeric(2, 1) check (rating >= 0 and rating <= 5),
  review_count             integer,
  tags                     text[] not null default '{}',
  typical_duration_minutes integer,
  is_featured              boolean not null default false,
  created_at               timestamptz not null default now()
);

create index places_category_idx on public.places (category);
create index places_city_idx on public.places (city);
create index places_featured_idx on public.places (is_featured) where is_featured;
create index places_tags_idx on public.places using gin (tags);

-- --- trips -------------------------------------------------------------------
create table public.trips (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.profiles (id) on delete cascade,
  title         text not null default 'Your journey',
  destination   text not null default 'Tunisia',
  start_date    date,
  end_date      date,
  travelers     smallint not null default 2 check (travelers > 0),
  budget_level  public.budget_level not null default 'balanced',
  status        public.trip_status not null default 'draft',
  summary       text,
  -- Ordered city route, e.g. {Tunis,Hammamet,Sousse}.
  route         text[] not null default '{}',
  media_key     text,
  -- The traveller's own words. Kept as the seed for AI regeneration.
  source_prompt text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint trips_dates_ordered check (end_date is null or start_date is null or end_date >= start_date)
);

create index trips_user_idx on public.trips (user_id, updated_at desc);
create index trips_status_idx on public.trips (status);

create trigger trips_set_updated_at
  before update on public.trips
  for each row execute function public.set_updated_at();

-- --- trip_preferences --------------------------------------------------------
-- Many-to-many rather than an array column, so preferences can be joined,
-- counted and used for recommendations.
create table public.trip_preferences (
  trip_id    uuid not null references public.trips (id) on delete cascade,
  preference public.preference_tag not null,
  primary key (trip_id, preference)
);

-- --- trip_days ---------------------------------------------------------------
create table public.trip_days (
  id         uuid primary key default gen_random_uuid(),
  trip_id    uuid not null references public.trips (id) on delete cascade,
  day_index  smallint not null check (day_index > 0),
  date       date,
  city       text not null,
  headline   text,
  created_at timestamptz not null default now(),
  unique (trip_id, day_index)
);

create index trip_days_trip_idx on public.trip_days (trip_id, day_index);

-- --- itinerary_items ---------------------------------------------------------
create table public.itinerary_items (
  id            uuid primary key default gen_random_uuid(),
  trip_day_id   uuid not null references public.trip_days (id) on delete cascade,
  place_id      uuid references public.places (id) on delete set null,
  kind          public.itinerary_kind not null default 'activity',
  title         text not null,
  subtitle      text,
  start_time    time,
  end_time      time,
  notes         text,
  -- Per-person estimate, in the trip's currency (TND for now).
  cost_estimate numeric(10, 2) check (cost_estimate >= 0),
  order_index   smallint not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint itinerary_items_times_ordered check (end_time is null or start_time is null or end_time >= start_time)
);

create index itinerary_items_day_idx on public.itinerary_items (trip_day_id, order_index);
create index itinerary_items_place_idx on public.itinerary_items (place_id);

create trigger itinerary_items_set_updated_at
  before update on public.itinerary_items
  for each row execute function public.set_updated_at();

-- --- reservations ------------------------------------------------------------
create table public.reservations (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references public.profiles (id) on delete cascade,
  trip_id           uuid references public.trips (id) on delete set null,
  place_id          uuid references public.places (id) on delete set null,
  type              public.reservation_type not null,
  status            public.reservation_status not null default 'pending',
  title             text not null,
  location          text not null,
  start_date        date not null,
  end_date          date not null,
  start_time        time,
  party_size        smallint not null default 2 check (party_size > 0),
  nights            smallint check (nights >= 0),
  total_amount      numeric(10, 2) check (total_amount >= 0),
  currency          char(3) not null default 'TND',
  confirmation_code text,
  media_key         text,
  notes             text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  constraint reservations_dates_ordered check (end_date >= start_date)
);

create index reservations_user_idx on public.reservations (user_id, start_date);
create index reservations_trip_idx on public.reservations (trip_id);

create trigger reservations_set_updated_at
  before update on public.reservations
  for each row execute function public.set_updated_at();

-- --- saved_places ------------------------------------------------------------
create table public.saved_places (
  user_id    uuid not null references public.profiles (id) on delete cascade,
  place_id   uuid not null references public.places (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, place_id)
);

-- --- NOVA conversations ------------------------------------------------------
-- Reserved for Step 2. Nothing writes here yet.
create table public.nova_conversations (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles (id) on delete cascade,
  trip_id    uuid references public.trips (id) on delete cascade,
  title      text,
  created_at timestamptz not null default now()
);

create index nova_conversations_user_idx on public.nova_conversations (user_id, created_at desc);

create table public.nova_messages (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.nova_conversations (id) on delete cascade,
  role            public.nova_message_role not null,
  content         text not null,
  -- Tool calls the agent made for this message, when it made any.
  tool_calls      jsonb,
  created_at      timestamptz not null default now()
);

create index nova_messages_conversation_idx on public.nova_messages (conversation_id, created_at);
