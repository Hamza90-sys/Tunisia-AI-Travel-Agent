-- =============================================================================
-- TuniTrip AI — storage
--
-- One public bucket for curated Tunisia photography. The client resolves a
-- place's `media_key` to a public URL through `getMediaPublicUrl()`; until a
-- photograph exists the UI falls back to procedural artwork, so an empty
-- bucket is a valid state.
-- =============================================================================

insert into storage.buckets (id, name, public)
values ('place-media', 'place-media', true)
on conflict (id) do nothing;

create policy "place media is readable by everyone"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'place-media');

-- Uploads happen through the service role (curation pipeline), not the client.
