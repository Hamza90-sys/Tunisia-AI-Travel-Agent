/**
 * NOVA's tools. Phase 4A ships exactly one: `search_places`.
 *
 * Security posture:
 *   • The model never sees a connection string, a key, or an RPC name.
 *   • The model cannot choose what runs — `executeSearchPlaces` is the only
 *     code path, and it calls the single existing `match_places` RPC.
 *   • Arguments are validated here, not trusted. An invalid argument becomes a
 *     structured error the model can recover from, not an exception.
 *   • Results never include embeddings.
 */
import { GoogleGenAI, Type } from '@google/genai'
import type { FunctionDeclaration } from '@google/genai'
import type { SupabaseClient } from '@supabase/supabase-js'

import { SEARCH_LIMIT_DEFAULT, SEARCH_LIMIT_MAX } from './config.ts'
import { EMBEDDING_MODEL, EMBEDDING_TASK_QUERY } from '../../../src/lib/rag/model.ts'
import {
  EMBEDDING_DIM,
  assertEmbeddingShape,
  l2Normalize,
  toVectorLiteral,
} from '../../../src/lib/rag/vector.ts'
import type { Database } from '../../../src/types/database.ts'

/** What `search_places` hands back to the model. No vectors, ever. */
export interface SearchPlacesResult {
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
  /** Cosine similarity in [-1, 1] from `match_places`. Internal ranking only. */
  similarity: number
}

/** The tool's response payload, as the model sees it. */
export interface SearchPlacesToolResponse {
  results?: SearchPlacesResult[]
  /** Set when the call could not be answered. The model is told to say so. */
  error?: string
  /** Guidance for the model when a search legitimately returned nothing. */
  note?: string
}

export const SEARCH_PLACES = 'search_places'

/**
 * Categories the tool accepts.
 *
 * Mirrors the `public.place_category` enum. Written out rather than imported
 * from `@/types` so this module stays free of the UI type barrel, which pulls
 * in `lucide-react`.
 */
export const SEARCH_CATEGORIES = [
  'beach',
  'history',
  'food',
  'rooftop',
  'nightlife',
  'nature',
  'adventure',
  'stay',
] as const

export type SearchCategory = (typeof SEARCH_CATEGORIES)[number]

/** Declaration handed to Gemini. */
export const searchPlacesDeclaration: FunctionDeclaration = {
  name: SEARCH_PLACES,
  description:
    'Semantic search over the curated catalogue of Tunisian places. Use it for any question about where to go, what to see, where to eat, or where to stay. Returns ranked places with a short description and tags.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      query: {
        type: Type.STRING,
        description:
          'What the traveller is looking for, in natural language. Include the qualities that matter (mood, setting, activity) rather than just a place name.',
      },
      category: {
        type: Type.STRING,
        enum: [...SEARCH_CATEGORIES],
        description: 'Optional filter. Omit unless the traveller clearly wants one kind of place.',
      },
      limit: {
        type: Type.INTEGER,
        description: `How many places to return. Defaults to ${SEARCH_LIMIT_DEFAULT}, maximum ${SEARCH_LIMIT_MAX}.`,
        minimum: 1,
        maximum: SEARCH_LIMIT_MAX,
      },
    },
    required: ['query'],
  },
}

export interface SearchPlacesArgs {
  query: string
  category: SearchCategory | null
  limit: number
}

export type ArgValidation =
  | { ok: true; args: SearchPlacesArgs }
  | { ok: false; error: string }

/**
 * Validates raw tool arguments from the model.
 *
 * Returns a message rather than throwing: a wrong argument is something the
 * model should be told about so it can retry, not a 500 for the traveller.
 */
export function validateSearchPlacesArgs(raw: unknown): ArgValidation {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    return { ok: false, error: 'Arguments must be an object.' }
  }

  const input = raw as Record<string, unknown>

  if (typeof input.query !== 'string' || !input.query.trim()) {
    return { ok: false, error: 'Missing required argument "query" (a non-empty string).' }
  }
  const query = input.query.trim().slice(0, 400)

  let category: SearchCategory | null = null
  if (input.category !== undefined && input.category !== null) {
    if (
      typeof input.category !== 'string' ||
      !(SEARCH_CATEGORIES as readonly string[]).includes(input.category)
    ) {
      return {
        ok: false,
        error: `Invalid "category". Expected one of: ${SEARCH_CATEGORIES.join(', ')}.`,
      }
    }
    category = input.category as SearchCategory
  }

  let limit = SEARCH_LIMIT_DEFAULT
  if (input.limit !== undefined && input.limit !== null) {
    if (typeof input.limit !== 'number' || !Number.isFinite(input.limit)) {
      return { ok: false, error: 'Invalid "limit". Expected a number.' }
    }
    limit = Math.min(Math.max(Math.trunc(input.limit), 1), SEARCH_LIMIT_MAX)
  }

  return { ok: true, args: { query, category, limit } }
}

/**
 * Runs one semantic search.
 *
 * Embeds the query with the same model and dimension the catalogue was
 * embedded with, normalises it, and calls the existing `match_places` RPC —
 * the single RAG implementation, reused rather than duplicated.
 *
 * `db` is the caller-scoped Supabase client, so the RPC executes under the
 * traveller's own role and the existing grants apply unchanged.
 */
export async function executeSearchPlaces(
  ai: GoogleGenAI,
  db: SupabaseClient<Database>,
  args: SearchPlacesArgs,
): Promise<SearchPlacesToolResponse> {
  let embedding: number[]

  try {
    const response = await ai.models.embedContent({
      model: EMBEDDING_MODEL,
      contents: args.query,
      config: {
        taskType: EMBEDDING_TASK_QUERY,
        outputDimensionality: EMBEDDING_DIM,
      },
    })

    const values = response.embeddings?.[0]?.values
    if (!values || values.length !== EMBEDDING_DIM) {
      return { error: 'The search index is unavailable right now.' }
    }

    embedding = l2Normalize(values)
    assertEmbeddingShape(embedding, 'query embedding')
  } catch {
    return { error: 'The search index is unavailable right now.' }
  }

  const { data, error } = await db.rpc('match_places', {
    query_embedding: toVectorLiteral(embedding),
    match_count: args.limit,
    filter_category: args.category,
  })

  if (error) {
    // The model gets a neutral sentence; the operator gets the detail in logs.
    console.error(`[nova-agent] match_places failed: ${error.message}`)
    return { error: 'The place catalogue could not be searched right now.' }
  }

  const results: SearchPlacesResult[] = (data ?? []).map((row) => ({
    id: row.id,
    slug: row.slug,
    name: row.name,
    category: row.category,
    city: row.city,
    region: row.region,
    summary: row.summary,
    description: row.description,
    tags: row.tags ?? [],
    typicalDurationMinutes: row.typical_duration_minutes,
    priceLevel: row.price_level,
    similarity: row.similarity,
  }))

  if (!results.length) {
    return {
      results: [],
      note: 'No places in the catalogue matched this search. Tell the traveller nothing matched and suggest a different angle. Do not substitute places from memory.',
    }
  }

  return { results }
}
