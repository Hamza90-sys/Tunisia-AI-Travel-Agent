-- =============================================================================
-- TuniTrip AI — catalogue seed
--
-- GENERATED FILE — do not edit by hand.
-- Source: src/data/places.ts   Regenerate: npm run db:seed
--
-- Landmarks and districts are real. Hotel and venue entries are prototype seed
-- data for the demo and should be replaced with verified partner listings
-- before anything is presented as bookable.
-- =============================================================================

insert into public.places (
  slug, name, category, city, region, summary, description,
  latitude, longitude, media_key, price_level, rating, review_count,
  tags, typical_duration_minutes, is_featured
) values
  ('carthage', 'Carthage', 'history'::public.place_category, 'Carthage', 'Tunis', 'Punic harbours and Roman baths on a ridge above the gulf.', 'The rival of Rome, then one of its great cities. The Antonine Baths, the Punic ports and the Byrsa hill sit inside a UNESCO-listed archaeological park a short ride from central Tunis.', 36.8528, 10.3233, 'carthage', 1, 4.6, 8420, array['unesco', 'ruins', 'half-day', 'sea-view']::text[], 150, true),
  ('sidi-bou-said', 'Sidi Bou Said', 'history'::public.place_category, 'Sidi Bou Said', 'Tunis', 'A cliff village of white walls, blue doors and long views.', 'Cobbled lanes climb to a clifftop above the Gulf of Tunis. Painters have been coming here for a century for the same reason travellers do: the light.', 36.8712, 10.3475, 'sidi-bou-said', 1, 4.8, 14210, array['iconic', 'sunset', 'walkable', 'photography']::text[], 180, true),
  ('medina-of-tunis', 'Medina of Tunis', 'history'::public.place_category, 'Tunis', 'Tunis', 'Seven hundred monuments inside a living UNESCO medina.', 'Souks, madrasas, palaces and the Zitouna Mosque, all still in daily use. Go early for the covered perfume and fabric souks.', 36.797, 10.1706, 'medina-of-tunis', 1, 4.6, 9650, array['unesco', 'souk', 'architecture']::text[], 210, true),
  ('bardo-museum', 'Bardo National Museum', 'history'::public.place_category, 'Tunis', 'Tunis', 'The finest collection of Roman mosaics anywhere.', null, 36.8093, 10.1344, 'bardo-museum', 1, 4.7, 5120, array['museum', 'mosaics', 'indoor', 'rainy-day']::text[], 120, false),
  ('el-jem-amphitheatre', 'El Jem Amphitheatre', 'history'::public.place_category, 'El Jem', 'Mahdia', 'A Roman arena for 35,000, standing almost intact.', null, 35.2967, 10.7069, 'el-jem-amphitheatre', 1, 4.8, 6890, array['unesco', 'ruins', 'day-trip']::text[], 120, true),
  ('dougga', 'Dougga', 'history'::public.place_category, 'Teboursouk', 'Beja', 'The best-preserved Roman town in North Africa, alone in the hills.', null, 36.4228, 9.2181, 'dougga', 1, 4.7, 2140, array['unesco', 'ruins', 'quiet', 'day-trip']::text[], 180, false),
  ('kairouan-great-mosque', 'Great Mosque of Kairouan', 'history'::public.place_category, 'Kairouan', 'Kairouan', 'The oldest mosque in the Maghreb, and its vast stone courtyard.', null, 35.6817, 10.1036, 'kairouan-great-mosque', 1, 4.7, 4380, array['unesco', 'architecture', 'dress-code']::text[], 90, false),
  ('hammamet-beach', 'Hammamet South Beach', 'beach'::public.place_category, 'Hammamet', 'Nabeul', 'Kilometres of soft sand with the old kasbah at one end.', null, 36.3833, 10.5667, 'hammamet-beach', 1, 4.5, 7310, array['sand', 'families', 'swimming', 'sunbeds']::text[], 240, true),
  ('sidi-mahrez-beach', 'Sidi Mahrez Beach', 'beach'::public.place_category, 'Djerba', 'Medenine', 'Djerba at its best: warm shallows that run out forever.', null, 33.8869, 10.8639, 'sidi-mahrez-beach', 1, 4.6, 5240, array['shallow', 'island', 'watersports']::text[], 300, false),
  ('tabarka-coast', 'Tabarka & the Needles', 'beach'::public.place_category, 'Tabarka', 'Jendouba', 'Cork forest meets the sea, with the best diving in the country.', null, 36.9544, 8.758, 'tabarka-coast', 2, 4.5, 2980, array['diving', 'cliffs', 'north-coast', 'green']::text[], 300, false),
  ('cap-angela', 'Cap Angela', 'nature'::public.place_category, 'Bizerte', 'Bizerte', 'The northernmost point of Africa — a cliff, a marker, the sea.', null, 37.3478, 9.7439, 'cap-angela', 1, 4.6, 1180, array['viewpoint', 'hiking', 'landmark', 'sunset']::text[], 120, false),
  ('ichkeul-park', 'Ichkeul National Park', 'nature'::public.place_category, 'Bizerte', 'Bizerte', 'A lake and wetland on the flyway — winter brings the flamingos.', null, 37.15, 9.6667, 'ichkeul-park', 1, 4.4, 940, array['unesco', 'birdwatching', 'walking', 'winter']::text[], 180, false),
  ('chebika-oasis', 'Chebika Mountain Oasis', 'nature'::public.place_category, 'Tozeur', 'Tozeur', 'A spring, a gorge and a palm grove at the foot of red cliffs.', null, 34.3167, 7.9333, 'chebika-oasis', 1, 4.6, 3110, array['oasis', 'gorge', 'waterfall', 'sahara-edge']::text[], 150, true),
  ('ksar-ghilane', 'Ksar Ghilane', 'adventure'::public.place_category, 'Ksar Ghilane', 'Tataouine', 'Where the dunes begin. Camps, camels and an unreasonable sky.', null, 32.9833, 9.6333, 'ksar-ghilane', 3, 4.8, 1620, array['sahara', 'overnight', 'stargazing', '4x4']::text[], 720, true),
  ('matmata', 'Matmata', 'adventure'::public.place_category, 'Matmata', 'Gabes', 'Berber houses dug down into the hills of the south.', null, 33.5439, 9.9667, 'matmata', 2, 4.3, 4260, array['troglodyte', 'film-location', 'south', 'day-trip']::text[], 180, false),
  ('dar-el-jeld', 'Dar El Jeld', 'food'::public.place_category, 'Tunis', 'Tunis', 'Tunisian cooking, formally served, in a restored medina house.', null, 36.7978, 10.1697, 'dar-el-jeld', 4, 4.6, 2240, array['fine-dining', 'medina', 'booking-advised']::text[], 120, true),
  ('la-goulette-grills', 'La Goulette Fish Grills', 'food'::public.place_category, 'La Goulette', 'Tunis', 'Whole fish, charcoal, lemon. The old port eats late.', null, 36.8183, 10.3053, 'la-goulette-grills', 2, 4.4, 3890, array['seafood', 'casual', 'local', 'late']::text[], 90, false),
  ('sousse-medina', 'Sousse Medina & Ribat', 'food'::public.place_category, 'Sousse', 'Sousse', 'Street food inside the walls, then the ribat tower at dusk.', null, 35.8256, 10.6394, 'sousse-medina', 1, 4.4, 5120, array['unesco', 'street-food', 'souk', 'sunset']::text[], 150, false),
  ('sidi-bou-terraces', 'Sidi Bou Said Clifftop Terraces', 'rooftop'::public.place_category, 'Sidi Bou Said', 'Tunis', 'Mint tea and pine nuts, three hundred metres above the water.', null, 36.8705, 10.3486, 'sidi-bou-terraces', 2, 4.7, 9120, array['sunset', 'view', 'tea', 'iconic']::text[], 75, true),
  ('gammarth-bay', 'Gammarth Bay Terraces', 'rooftop'::public.place_category, 'Gammarth', 'Tunis', 'The city dresses up and comes north for the evening.', null, 36.9167, 10.2886, 'gammarth-bay', 3, 4.5, 2760, array['cocktails', 'sea-view', 'smart-casual']::text[], 120, false),
  ('yasmine-marina', 'Yasmine Hammamet Marina', 'nightlife'::public.place_category, 'Hammamet', 'Nabeul', 'Boats, bars and a promenade that stays busy until late.', null, 36.3672, 10.5436, 'yasmine-marina', 2, 4.3, 6410, array['marina', 'bars', 'walkable', 'late']::text[], 180, false),
  ('port-el-kantaoui', 'Port El Kantaoui', 'nightlife'::public.place_category, 'Sousse', 'Sousse', 'The purpose-built marina north of Sousse, at its best after dark.', null, 35.8931, 10.5953, 'port-el-kantaoui', 2, 4.4, 8230, array['marina', 'music', 'dining', 'late']::text[], 180, true),
  ('la-badira', 'La Badira', 'stay'::public.place_category, 'Hammamet', 'Nabeul', 'Adults-only, white-on-white, directly above Hammamet bay.', null, 36.4053, 10.6156, 'la-badira', 4, 4.8, 1980, array['adults-only', 'spa', 'sea-view', 'five-star']::text[], null, false),
  ('villa-didon', 'Villa Didon', 'stay'::public.place_category, 'Carthage', 'Tunis', 'A design hotel on the Byrsa hill, looking down on the ruins.', null, 36.8547, 10.3272, 'villa-didon', 4, 4.6, 1240, array['design', 'city-view', 'rooftop']::text[], null, false),
  ('dar-hi', 'Dar HI', 'stay'::public.place_category, 'Tozeur', 'Tozeur', 'A palm-grove retreat on the edge of the salt flats.', null, 33.9197, 8.1336, 'dar-hi', 3, 4.5, 860, array['design', 'oasis', 'spa', 'sahara-edge']::text[], null, false)
on conflict (slug) do update set
  name                     = excluded.name,
  category                 = excluded.category,
  city                     = excluded.city,
  region                   = excluded.region,
  summary                  = excluded.summary,
  description              = excluded.description,
  latitude                 = excluded.latitude,
  longitude                = excluded.longitude,
  media_key                = excluded.media_key,
  price_level              = excluded.price_level,
  rating                   = excluded.rating,
  review_count             = excluded.review_count,
  tags                     = excluded.tags,
  typical_duration_minutes = excluded.typical_duration_minutes,
  is_featured              = excluded.is_featured;
