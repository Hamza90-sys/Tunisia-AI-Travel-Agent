/**
 * Retrieval verification — proves the RAG path end to end.
 *
 *   query text
 *     -> gemini-embedding-001 (RETRIEVAL_QUERY, 768 dims)
 *     -> l2Normalize()
 *     -> match_places() RPC
 *     -> ranked places + cosine similarity
 *
 * Run with `npm run db:verify-rag`, optionally with your own query:
 *
 *   npm run db:verify-rag -- "quiet beaches away from crowds"
 *   npm run db:verify-rag -- --category=history "Roman ruins"
 *
 * Deliberately authenticates with the **anon** key, not the service role. The
 * point is to prove that the security design works for the role the browser
 * actually uses: `place_embeddings` is unreadable, yet `match_places` returns
 * results. Swapping in the service role would prove nothing.
 *
 * Exit codes: 0 verified · 1 could not verify (misconfigured, or no results).
 */
import { GoogleGenAI } from '@google/genai'
import { createClient } from '@supabase/supabase-js'
import { loadEnv } from 'vite'

import {
  EMBEDDING_DIM,
  EMBEDDING_MODEL,
  EMBEDDING_TASK_QUERY,
  assertEmbeddingShape,
  l2Normalize,
  toVectorLiteral,
} from '../src/lib/rag'
import { PLACE_CATEGORIES } from '../src/types'
import type { Database } from '../src/types/database'
import type { PlaceCategory } from '../src/types'

const DEFAULT_QUERY = 'historic Roman sites near Tunis'

const fileEnv = loadEnv('development', process.cwd(), '')

function readEnv(name: string): string | undefined {
  const trimmed = (process.env[name] ?? fileEnv[name])?.trim()
  return trimmed ? trimmed : undefined
}

function parseArgs() {
  const argv = process.argv.slice(2)
  let category: PlaceCategory | null = null
  let limit = 8
  const words: string[] = []

  for (const arg of argv) {
    if (arg.startsWith('--category=')) {
      const value = arg.slice('--category='.length)
      if (!(PLACE_CATEGORIES as readonly string[]).includes(value)) {
        console.error(`Unknown category "${value}". Expected one of: ${PLACE_CATEGORIES.join(', ')}`)
        process.exit(1)
      }
      category = value as PlaceCategory
    } else if (arg.startsWith('--limit=')) {
      const value = Number(arg.slice('--limit='.length))
      if (!Number.isInteger(value) || value < 1 || value > 50) {
        console.error('--limit must be an integer between 1 and 50.')
        process.exit(1)
      }
      limit = value
    } else {
      words.push(arg)
    }
  }

  return { query: words.join(' ').trim() || DEFAULT_QUERY, category, limit }
}

function explainMissing(missing: string[]): never {
  console.error('\nCannot verify retrieval — missing environment variables:\n')
  for (const name of missing) console.error(`  • ${name}`)
  console.error(
    [
      '',
      'This check needs:',
      '  GEMINI_API_KEY          server-side only, to embed the query',
      '  VITE_SUPABASE_URL       project URL',
      '  VITE_SUPABASE_ANON_KEY  the key a browser would use',
      '',
      'Add them to .env.local (see .env.example), then make sure the catalogue',
      'has been embedded:  npm run db:embed',
      '',
    ].join('\n'),
  )
  process.exit(1)
}

async function main(): Promise<void> {
  const { query, category, limit } = parseArgs()

  const names = ['GEMINI_API_KEY', 'VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY'] as const
  const env: Record<string, string> = {}
  const missing: string[] = []
  for (const name of names) {
    const value = readEnv(name)
    if (value) env[name] = value
    else missing.push(name)
  }
  if (missing.length) explainMissing(missing)

  console.log(`\nQuery:    "${query}"`)
  if (category) console.log(`Category: ${category}`)
  console.log(`Model:    ${EMBEDDING_MODEL} (${EMBEDDING_DIM}d, ${EMBEDDING_TASK_QUERY})\n`)

  /* 1. Embed the query. */
  const ai = new GoogleGenAI({ apiKey: env.GEMINI_API_KEY })
  const response = await ai.models.embedContent({
    model: EMBEDDING_MODEL,
    contents: query,
    config: {
      taskType: EMBEDDING_TASK_QUERY,
      outputDimensionality: EMBEDDING_DIM,
    },
  })

  const values = response.embeddings?.[0]?.values
  if (!values) throw new Error('Gemini returned no embedding for the query.')
  if (values.length !== EMBEDDING_DIM) {
    throw new Error(`Query embedding has ${values.length} dimensions; expected ${EMBEDDING_DIM}.`)
  }

  const embedding = l2Normalize(values)
  assertEmbeddingShape(embedding, 'query embedding')

  /* 2. Retrieve through the RPC, as an anonymous browser would. */
  const db = createClient<Database>(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const { data, error } = await db.rpc('match_places', {
    query_embedding: toVectorLiteral(embedding),
    match_count: limit,
    filter_category: category,
  })

  if (error) {
    console.error(`\nmatch_places failed: ${error.message}`)
    console.error(
      'If this says the function does not exist, apply supabase/migrations/20260102000000_vector_rag.sql.',
    )
    process.exit(1)
  }

  if (!data?.length) {
    console.error('\nNo matches. The RPC ran but returned nothing.')
    console.error('Most likely place_embeddings is empty — run: npm run db:embed')
    process.exit(1)
  }

  /* 3. Report. */
  console.log(`${data.length} result(s):\n`)
  console.log(`  ${'#'.padEnd(3)}${'similarity'.padEnd(13)}${'place'.padEnd(32)}category / city`)
  console.log(`  ${'-'.repeat(78)}`)
  data.forEach((row, index) => {
    const rank = String(index + 1).padEnd(3)
    const score = row.similarity.toFixed(4).padEnd(13)
    const name = row.name.length > 30 ? `${row.name.slice(0, 29)}…` : row.name
    console.log(`  ${rank}${score}${name.padEnd(32)}${row.category} / ${row.city}`)
  })

  /* 4. Prove the wall is still up: anon must not be able to read the vectors. */
  const { data: leaked, error: denied } = await db.from('place_embeddings').select('id').limit(1)
  const vectorsExposed = Boolean(leaked?.length)

  console.log('')
  if (vectorsExposed) {
    console.error('SECURITY: place_embeddings is readable with the anon key. It should not be.')
    process.exit(1)
  }
  console.log(
    `Vectors stay server-side: anon select on place_embeddings returned ${
      denied ? `an error (${denied.code ?? 'denied'})` : '0 rows'
    }, as designed.`,
  )
  console.log('\nRetrieval verified.')
}

main().catch((error: unknown) => {
  console.error(`\nVerification failed: ${error instanceof Error ? error.message : String(error)}`)
  process.exit(1)
})
