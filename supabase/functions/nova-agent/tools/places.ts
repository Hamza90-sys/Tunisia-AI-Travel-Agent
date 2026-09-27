/**
 * Catalogue tools: semantic search and place lookup.
 *
 * Both read the existing Supabase catalogue. `search_places` goes through the
 * one authoritative RAG path — embed, then `match_places()` over pgvector.
 * There is no second knowledge base and no second vector store; the NOVA
 * repository's local `ragEngine` was rejected precisely to avoid that.
 */
import { invalid } from './types.ts'
import type { NovaTool, ToolContext, ToolResult } from './types.ts'
import { SEARCH_LIMIT_DEFAULT, SEARCH_LIMIT_MAX } from '../config.ts'
import { toVectorLiteral } from '../../../../src/lib/rag/vector.ts'

export const PLACE_CATEGORIES = [
  'beach',
  'history',
  'food',
  'rooftop',
  'nightlife',
  'nature',
  'adventure',
  'stay',
] as const

/** Catalogue columns a tool may expose. Never embeddings. */
const PLACE_COLUMNS =
  'id, slug, name, category, city, region, summary, description, tags, typical_duration_minutes, price_level, rating, latitude, longitude'

export interface CataloguePlace {
  id: string
  slug: string
  name: string
  category: string
  city: string
  region: string
  summary: string
  description: string | null
  tags: string[]
  typicalDurationMinutes: number | null
  priceLevel: number | null
  rating: number | null
  latitude: number | null
  longitude: number | null
}

type Row = Record<string, unknown>

function toPlace(row: Row): CataloguePlace {
  return {
    id: String(row.id ?? ''),
    slug: String(row.slug ?? ''),
    name: String(row.name ?? ''),
    category: String(row.category ?? ''),
    city: String(row.city ?? ''),
    region: String(row.region ?? ''),
    summary: String(row.summary ?? ''),
    description: (row.description as string | null) ?? null,
    tags: (row.tags as string[] | null) ?? [],
    typicalDurationMinutes: (row.typical_duration_minutes as number | null) ?? null,
    priceLevel: (row.price_level as number | null) ?? null,
    rating: (row.rating as number | null) ?? null,
    latitude: (row.latitude as number | null) ?? null,
    longitude: (row.longitude as number | null) ?? null,
  }
}

export const searchPlacesTool: NovaTool = {
  definition: {
    name: 'search_places',
    description:
      'Semantic search over the curated catalogue of Tunisian places. Use it for any question about where to go, what to see, where to eat, or where to stay.',
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description:
            'What the traveller is looking for, in natural language. Include the qualities that matter, not just a place name.',
        },
        city: {
          type: 'string',
          description: 'Restrict results to one Tunisian city, e.g. "Tunis". Omit for anywhere.',
        },
        category: { type: 'string', enum: [...PLACE_CATEGORIES] },
        limit: { type: 'integer', minimum: 1, maximum: SEARCH_LIMIT_MAX },
      },
      required: ['query'],
    },
  },

  describe(args) {
    const query = typeof args.query === 'string' ? args.query : ''
    return `Searching Tunisia for “${query}”`
  },

  async execute(args, { db, embeddings }): Promise<ToolResult> {
    if (typeof args.query !== 'string' || !args.query.trim()) {
      return invalid('Missing required argument "query" (a non-empty string).')
    }
    const query = args.query.trim().slice(0, 400)

    let category: string | null = null
    if (args.category !== undefined && args.category !== null) {
      if (
        typeof args.category !== 'string' ||
        !(PLACE_CATEGORIES as readonly string[]).includes(args.category)
      ) {
        return invalid(`Invalid "category". Expected one of: ${PLACE_CATEGORIES.join(', ')}.`)
      }
      category = args.category
    }

    let limit = SEARCH_LIMIT_DEFAULT
    if (args.limit !== undefined && args.limit !== null) {
      if (typeof args.limit !== 'number' || !Number.isFinite(args.limit)) {
        return invalid('Invalid "limit". Expected a number.')
      }
      limit = Math.min(Math.max(Math.trunc(args.limit), 1), SEARCH_LIMIT_MAX)
    }

    let city: string | null = null
    if (typeof args.city === 'string' && args.city.trim()) {
      city = args.city.trim().slice(0, 80)
    }

    /*
     * Semantic path first: embed the query, then rank with pgvector.
     *
     * `match_places` has no city parameter, so a city filter is applied after
     * ranking — which means over-fetching, or a city's entries get squeezed out
     * of the top-k by better global matches before the filter ever runs.
     */
    const overFetch = city ? Math.min(limit * 4, SEARCH_LIMIT_MAX * 4) : limit

    let results: (CataloguePlace & { similarity: number })[] = []
    let retrieval: 'semantic' | 'keyword' = 'semantic'

    let embedding: number[] | null = null
    try {
      embedding = await embeddings.embedQuery(query)
    } catch (error) {
      // Not fatal. The embedding provider is Gemini, and the chat model may be
      // something else entirely (NIM/Llama) — a Gemini outage or an exhausted
      // quota must not take catalogue search down with it.
      console.warn(`[nova-agent] embedding unavailable, falling back to keyword search: ${
        error instanceof Error ? error.message : String(error)
      }`)
    }

    if (embedding) {
      const { data, error } = await db.rpc('match_places', {
        query_embedding: toVectorLiteral(embedding),
        match_count: overFetch,
        filter_category: category as never,
      })

      if (error) {
        console.error(`[nova-agent] match_places failed: ${error.message}`)
      } else {
        const rows = (data ?? []) as unknown as Row[]
        results = rows.map((row) => ({ ...toPlace(row), similarity: Number(row.similarity ?? 0) }))
      }
    }

    if (city) {
      const needle = city.toLowerCase()
      results = results.filter((place) => place.city.toLowerCase().includes(needle))
    }

    /*
     * Keyword fallback. Reached when the embedding provider is down, when the
     * vector index has not been built, or when a city filter removed every
     * semantic hit. It reads the SAME catalogue table — it is not a second
     * knowledge base, and `retrieval` records which path answered so nothing
     * downstream mistakes a keyword match for a semantic one.
     */
    if (!results.length) {
      retrieval = 'keyword'

      let keyword = db.from('places').select(PLACE_COLUMNS)
      if (category) keyword = keyword.eq('category', category as never)
      if (city) keyword = keyword.ilike('city', `%${city}%`)
      else {
        const escaped = query.replace(/[%,()]/g, ' ').trim()
        if (escaped) {
          keyword = keyword.or(
            `name.ilike.%${escaped}%,city.ilike.%${escaped}%,summary.ilike.%${escaped}%`,
          )
        }
      }

      const { data, error } = await keyword.limit(limit)

      if (error) {
        console.error(`[nova-agent] keyword search failed: ${error.message}`)
        return invalid('The place catalogue could not be searched right now.')
      }

      results = ((data ?? []) as unknown as Row[]).map((row) => ({
        ...toPlace(row),
        // Not a similarity. Keyword hits are unranked, and inventing a score
        // here would let a downstream reader compare two different things.
        similarity: 0,
      }))
    }

    results = results.slice(0, limit)

    if (!results.length) {
      return {
        ok: true,
        source: 'catalogue',
        data: { results: [], retrieval },
        note: 'Nothing in the catalogue matched. Say so rather than naming places from memory.',
      }
    }

    console.log(
      `[nova-agent] search_places(${retrieval}) query="${query}" city=${city ?? '-'} -> ${results.length}`,
    )

    return { ok: true, source: 'catalogue', data: { results, retrieval } }
  },
}

export const getPlaceDetailsTool: NovaTool = {
  definition: {
    name: 'get_place_details',
    description:
      'Full catalogue record for one place, by its slug. Use after search_places when the traveller asks about a specific place in more depth.',
    parameters: {
      type: 'object',
      properties: {
        slug: { type: 'string', description: 'The place slug from a previous search result.' },
      },
      required: ['slug'],
    },
  },

  describe(args) {
    return `Looking up ${typeof args.slug === 'string' ? args.slug : 'a place'}`
  },

  async execute(args, { db }): Promise<ToolResult> {
    if (typeof args.slug !== 'string' || !args.slug.trim()) {
      return invalid('Missing required argument "slug".')
    }

    const { data, error } = await db
      .from('places')
      .select(PLACE_COLUMNS)
      .eq('slug', args.slug.trim())
      .maybeSingle()

    if (error) {
      console.error(`[nova-agent] place lookup failed: ${error.message}`)
      return invalid('That place could not be looked up right now.')
    }
    if (!data) {
      return {
        ok: true,
        source: 'catalogue',
        data: { found: false },
        note: 'No such place in the catalogue. Do not describe it from memory.',
      }
    }

    return {
      ok: true,
      source: 'catalogue',
      data: { found: true, place: toPlace(data as unknown as Row) },
    }
  },
}

/** Fetches catalogue rows for a set of slugs, preserving the caller's order. */
export async function fetchPlacesBySlug(
  db: ToolContext['db'],
  slugs: string[],
): Promise<CataloguePlace[]> {
  if (!slugs.length) return []

  const { data, error } = await db.from('places').select(PLACE_COLUMNS).in('slug', slugs)
  if (error || !data) return []

  const bySlug = new Map<string, CataloguePlace>()
  for (const row of data) {
    const place = toPlace(row as unknown as Row)
    bySlug.set(place.slug, place)
  }

  return slugs
    .map((slug) => bySlug.get(slug))
    .filter((place): place is CataloguePlace => Boolean(place))
}
