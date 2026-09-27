-- =============================================================================
-- TuniTrip AI — row level security
--
-- Rules
--   * `places` is a public catalogue: anyone may read, nobody may write from
--     the client. Curation happens through the service role.
--   * Everything else is owner-only. Trip children (days, items, preferences)
--     are reached through an EXISTS on the parent trip, so a traveller can
--     never read another traveller's itinerary even by guessing an id.
-- =============================================================================

alter table public.profiles           enable row level security;
alter table public.places             enable row level security;
alter table public.trips              enable row level security;
alter table public.trip_preferences   enable row level security;
alter table public.trip_days          enable row level security;
alter table public.itinerary_items    enable row level security;
alter table public.reservations       enable row level security;
alter table public.saved_places       enable row level security;
alter table public.nova_conversations enable row level security;
alter table public.nova_messages      enable row level security;

-- --- profiles ----------------------------------------------------------------
create policy "profiles are readable by their owner"
  on public.profiles for select
  using ((select auth.uid()) = id);

create policy "profiles are insertable by their owner"
  on public.profiles for insert
  with check ((select auth.uid()) = id);

create policy "profiles are updatable by their owner"
  on public.profiles for update
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

-- --- places ------------------------------------------------------------------
create policy "places are readable by everyone"
  on public.places for select
  to anon, authenticated
  using (true);

-- --- trips -------------------------------------------------------------------
create policy "trips are readable by their owner"
  on public.trips for select
  using ((select auth.uid()) = user_id);

create policy "trips are insertable by their owner"
  on public.trips for insert
  with check ((select auth.uid()) = user_id);

create policy "trips are updatable by their owner"
  on public.trips for update
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "trips are deletable by their owner"
  on public.trips for delete
  using ((select auth.uid()) = user_id);

-- --- trip children -----------------------------------------------------------
-- Helper keeps the four child policies readable and consistent.
create or replace function public.owns_trip(target_trip_id uuid)
returns boolean
language sql
stable
security invoker
set search_path = public
as $$
  select exists (
    select 1
    from public.trips t
    where t.id = target_trip_id
      and t.user_id = (select auth.uid())
  );
$$;

create policy "trip preferences follow their trip"
  on public.trip_preferences for all
  using (public.owns_trip(trip_id))
  with check (public.owns_trip(trip_id));

create policy "trip days follow their trip"
  on public.trip_days for all
  using (public.owns_trip(trip_id))
  with check (public.owns_trip(trip_id));

create policy "itinerary items follow their trip"
  on public.itinerary_items for all
  using (
    exists (
      select 1
      from public.trip_days d
      where d.id = itinerary_items.trip_day_id
        and public.owns_trip(d.trip_id)
    )
  )
  with check (
    exists (
      select 1
      from public.trip_days d
      where d.id = itinerary_items.trip_day_id
        and public.owns_trip(d.trip_id)
    )
  );

-- --- reservations ------------------------------------------------------------
create policy "reservations belong to their owner"
  on public.reservations for all
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- --- saved places ------------------------------------------------------------
create policy "saved places belong to their owner"
  on public.saved_places for all
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- --- NOVA conversations ------------------------------------------------------
create policy "conversations belong to their owner"
  on public.nova_conversations for all
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "messages follow their conversation"
  on public.nova_messages for all
  using (
    exists (
      select 1
      from public.nova_conversations c
      where c.id = nova_messages.conversation_id
        and c.user_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1
      from public.nova_conversations c
      where c.id = nova_messages.conversation_id
        and c.user_id = (select auth.uid())
    )
  );
