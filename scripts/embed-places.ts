/**
 * Embedding pipeline — populates `public.place_embeddings`.
 *
 *   src/data/places.ts
 *     -> buildPlaceEmbeddingText()      deterministic text per place
 *     -> sha-256                        content_hash, for change detection
 *     -> gemini-embedding-001           768-dimension vector
 *     -> l2Normalize()                  required at non-native widths
 *     -> upsert place_embeddings        on (place_id, model)
 *
 * Server-side only. Run with `npm run db:embed`.
 *
 * This file is never bundled into the browser: it reads `GEMINI_API_KEY` and
 * `SUPABASE_SERVICE_ROLE_KEY`, neither of which carries the `VITE_` prefix, so
 * Vite cannot expose them to client code even by accident.
 *
 * Flags
 *   --dry-run  Build text, hashes and shapes locally. No Gemini, no Supabase.
 *   --force    Re-embed every place even when its content_hash is unchanged.
 *   --prune    Delete rows whose place_id is no longer in the catalogue.
 */
import { GoogleGenAI } from '@google/genai'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { loadEnv } from 'vite'

import { PLACES } from '../src/data/places'
import {
  EMBEDDING_DIM,
  EMBEDDING_MODEL,
  EMBEDDING_TASK_DOCUMENT,
  assertEmbeddingShape,
  buildPlaceEmbeddingInput,
  l2Normalize,
  toVectorLiteral,
} from '../src/lib/rag'
import type { Database } from '../src/types/database'
import type { PlaceEmbeddingInput } from '../src/lib/rag'

/**
 * Texts per embedContent call.
 *
 * The API accepts far more, but the catalogue is small and a modest batch keeps
 * a single transient failure from taking 100 places down with it. Batches that
 * do fail are retried item-by-item before anything is reported as failed.
 */
const BATCH_SIZE = 16

/** Attempts per request, including the first. */
const MAX_ATTEMPTS = 3

const args = new Set(process.argv.slice(2))
const isDryRun = args.has('--dry-run')
const isForce = args.has('--force')
const shouldPrune = args.has('--prune')

/* --- Environment ----------------------------------------------------------- */

// Reads .env, .env.local and friends exactly the way Vite does, so the script
// and the dev server agree on precedence. Real process env wins, for CI.
const fileEnv = loadEnv('development', process.cwd(), '')

function readEnv(name: string): string | undefined {
  const value = process.env[name] ?? fileEnv[name]
  const trimmed = value?.trim()
  return trimmed ? trimmed : undefined
}

function requireEnv(names: string[]): Record<string, string> {
  const resolved: Record<string, string> = {}
  const missing: string[] = []

  for (const name of names) {
    const value = readEnv(name)
    if (value) resolved[name] = value
    else missing.push(name)
  }

  if (missing.length) {
    console.error('\nCannot run the embedding pipeline — missing environment variables:\n')
    for (const name of missing) console.error(`  • ${name}`)
    console.error(
      [
        '',
        'Add them to .env.local (see .env.example). None of these may carry the',
        'VITE_ prefix — GEMINI_API_KEY and SUPABASE_SERVICE_ROLE_KEY are server',
        'secrets and must never reach the browser bundle.',
        '',
        'To exercise the local half of the pipeline without credentials:',
        '  npm run db:embed -- --dry-run',
        '',
      ].join('\n'),
    )
    process.exit(1)
  }

  return resolved
}

/* --- Helpers --------------------------------------------------------------- */

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = []
  for (let index = 0; index < items.length; index += size) {
    out.push(items.slice(index, index + size))
  }
  return out
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

function describeError(error: unknown): string {
  if (error instanceof Error) return error.message
  return String(error)
}

/** Retries transient failures (rate limits, 5xx, network) with backoff. */
async function withRetry<T>(label: string, run: () => Promise<T>): Promise<T> {
  let lastError: unknown

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    try {
      return await run()
    } catch (error) {
      lastError = error
      const message = describeError(error)
      const retryable = /\b(429|500|502|503|504|ECONNRESET|ETIMEDOUT|fetch failed)\b/i.test(message)

      if (!retryable || attempt === MAX_ATTEMPTS) break

      const backoff = 500 * 2 ** (attempt - 1)
      console.warn(`      retry ${attempt}/${MAX_ATTEMPTS - 1} for ${label} in ${backoff}ms — ${message}`)
      await sleep(backoff)
    }
  }

  throw lastError
}

/**
 * Validates one raw embedding and returns it normalised.
 *
 * Throws rather than padding or truncating: a wrong-width vector means the
 * model or the config changed, and silently reshaping it would poison the
 * index with vectors that are not comparable to the rest.
 */
function normalizeEmbedding(values: number[] | undefined, placeName: string): number[] {
  if (!values) {
    throw new Error(`Gemini returned no embedding values for "${placeName}".`)
  }
  if (values.length !== EMBEDDING_DIM) {
    throw new Error(
      `Gemini returned ${values.length} dimensions for "${placeName}"; expected ${EMBEDDING_DIM}. ` +
        'Refusing to pad or truncate — check outputDimensionality and the model id.',
    )
  }
  if (!values.every(Number.isFinite)) {
    throw new Error(`Gemini returned a non-finite value for "${placeName}".`)
  }

  const normalized = l2Normalize(values)
  // gemini-embedding-001 only self-normalises at its native 3072 width, so this
  // assertion is what guarantees the cosine index compares like with like.
  assertEmbeddingShape(normalized, `embedding for "${placeName}"`)
  return normalized
}

/* --- Main ------------------------------------------------------------------ */

interface PlanEntry {
  input: PlaceEmbeddingInput
  name: string
  text: string
}

async function buildPlan(): Promise<PlanEntry[]> {
  const entries: PlanEntry[] = []
  for (const place of PLACES) {
    const input = await buildPlaceEmbeddingInput(place)
    entries.push({ input, name: place.name, text: input.text })
  }
  return entries
}

async function runDryRun(plan: PlanEntry[]): Promise<void> {
  console.log(`Dry run — ${plan.length} places, no network calls.\n`)

  const hashes = new Map<string, string>()
  let problems = 0

  for (const [index, entry] of plan.entries()) {
    const position = `[${String(index + 1).padStart(2, ' ')}/${plan.length}]`
    const shortHash = entry.input.contentHash.slice(0, 12)
    console.log(
      `${position} ${entry.name.padEnd(30)} ${String(entry.text.length).padStart(4)} chars  ${shortHash}…`,
    )

    // Determinism: the same place must always hash the same way, or the
    // skip-unchanged logic silently re-embeds the catalogue on every run.
    const repeat = await buildPlaceEmbeddingInput(PLACES[index])
    if (repeat.contentHash !== entry.input.contentHash) {
      console.error(`         NOT DETERMINISTIC — hash changed between runs`)
      problems += 1
    }

    const key = `${entry.input.slug}:${entry.input.model}`
    if (hashes.has(key)) {
      console.error(`         DUPLICATE (slug, model) key — would break the upsert`)
      problems += 1
    }
    hashes.set(key, entry.input.contentHash)

    if (entry.input.dim !== EMBEDDING_DIM) {
      console.error(`         dim ${entry.input.dim} != EMBEDDING_DIM ${EMBEDDING_DIM}`)
      problems += 1
    }
  }

  console.log(`\nModel:      ${EMBEDDING_MODEL}`)
  console.log(`Dimensions: ${EMBEDDING_DIM}`)
  console.log(`Task type:  ${EMBEDDING_TASK_DOCUMENT}`)
  console.log(`Unique keys: ${hashes.size}/${plan.length}`)
  console.log(`\nSample text — ${plan[0].name}:`)
  console.log(
    plan[0].text
      .split('\n')
      .map((line) => `  | ${line}`)
      .join('\n'),
  )

  if (problems > 0) {
    console.error(`\n${problems} problem(s) found in the local pipeline.`)
    process.exit(1)
  }
  console.log('\nLocal pipeline OK. No embeddings were generated (dry run).')
}

interface RunTotals {
  embedded: number
  skipped: number
  failed: number
}

/**
 * Maps every catalogue slug to the `public.places.id` uuid that
 * `place_embeddings.place_id` references.
 *
 * The local catalogue's `place.id` (`plc-carthage`) is a readable local handle
 * with no relationship to the database's generated uuid, so slug is the only
 * usable join key — and `places.slug` is `unique`, which is what makes it safe.
 */
async function resolvePlaceIds(
  db: SupabaseClient<Database>,
  plan: PlanEntry[],
): Promise<Map<string, string>> {
  const { data, error } = await db.from('places').select('id, slug')

  if (error) {
    throw new Error(`Could not read public.places: ${error.message}`)
  }

  const idBySlug = new Map((data ?? []).map((row) => [row.slug, row.id]))
  const missing = plan.filter((entry) => !idBySlug.has(entry.input.slug))

  if (missing.length) {
    console.error(
      `\n${missing.length} of ${plan.length} catalogue slug(s) have no row in public.places:\n`,
    )
    for (const entry of missing) {
      console.error(`  • ${entry.input.slug.padEnd(28)} (${entry.name})`)
    }
    console.error(
      [
        '',
        'public.places supplies the uuid that place_embeddings.place_id references,',
        'so nothing can be embedded until those rows exist. Apply supabase/seed.sql',
        '(regenerate it first with `npm run db:seed` if the catalogue changed), then',
        're-run this command.',
        '',
      ].join('\n'),
    )
    process.exit(1)
  }

  return idBySlug
}

async function runLive(plan: PlanEntry[]): Promise<RunTotals> {
  const env = requireEnv(['GEMINI_API_KEY', 'VITE_SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'])

  const ai = new GoogleGenAI({ apiKey: env.GEMINI_API_KEY })
  // Service role: the only writer allowed by the RLS design. It bypasses RLS,
  // which is exactly why it lives in a local script and never in the app.
  const db = createClient<Database>(env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  /* 1. Catalogue slug -> database uuid. Fails loudly if any slug is absent. */
  const idBySlug = await resolvePlaceIds(db, plan)
  const placeIdFor = (entry: PlanEntry): string => {
    const placeId = idBySlug.get(entry.input.slug)
    // resolvePlaceIds has already exited on any gap, so this is belt-and-braces
    // rather than a real branch — but it beats casting away the undefined.
    if (!placeId) throw new Error(`No public.places row for slug "${entry.input.slug}".`)
    return placeId
  }

  /* 2. What is already stored for this model. */
  const { data: existingRows, error: readError } = await db
    .from('place_embeddings')
    .select('place_id, content_hash')
    .eq('model', EMBEDDING_MODEL)

  if (readError) {
    throw new Error(`Could not read place_embeddings: ${readError.message}`)
  }

  const storedHashes = new Map((existingRows ?? []).map((row) => [row.place_id, row.content_hash]))

  /* 3. Orphans — rows for places that no longer exist in the catalogue. */
  const catalogueIds = new Set(plan.map(placeIdFor))
  const orphanIds = [...storedHashes.keys()].filter((id) => !catalogueIds.has(id))

  /* 4. Partition into "needs embedding" and "unchanged". */
  const pending = plan.filter(
    (entry) => isForce || storedHashes.get(placeIdFor(entry)) !== entry.input.contentHash,
  )
  const skipped = plan.length - pending.length

  console.log(`Catalogue:  ${plan.length} places`)
  console.log(`Stored:     ${storedHashes.size} rows for ${EMBEDDING_MODEL}`)
  console.log(`To embed:   ${pending.length}${isForce ? ' (--force)' : ''}`)
  console.log(`Unchanged:  ${skipped}\n`)

  if (!pending.length) {
    console.log('Nothing to do — every place is already embedded at its current content hash.')
    return { embedded: 0, skipped, failed: 0 }
  }

  /* 5. Embed, in batches, retrying a failed batch item-by-item. */
  console.log('Embedding places...')

  const vectors = new Map<string, number[]>()
  const failures: { name: string; reason: string }[] = []
  let processed = 0

  async function embedTexts(texts: string[]): Promise<(number[] | undefined)[]> {
    const response = await ai.models.embedContent({
      model: EMBEDDING_MODEL,
      contents: texts,
      config: {
        taskType: EMBEDDING_TASK_DOCUMENT,
        outputDimensionality: EMBEDDING_DIM,
      },
    })
    // The API documents embeddings as being returned in request order.
    const embeddings = response.embeddings ?? []
    if (embeddings.length !== texts.length) {
      throw new Error(
        `Gemini returned ${embeddings.length} embeddings for ${texts.length} inputs.`,
      )
    }
    return embeddings.map((embedding) => embedding.values)
  }

  function record(entry: PlanEntry, values: number[] | undefined): void {
    processed += 1
    const position = `[${String(processed).padStart(2, ' ')}/${pending.length}]`
    try {
      vectors.set(entry.input.slug, normalizeEmbedding(values, entry.name))
      console.log(`${position} ${entry.name}`)
    } catch (error) {
      const reason = describeError(error)
      failures.push({ name: entry.name, reason })
      console.error(`${position} ${entry.name} — FAILED: ${reason}`)
    }
  }

  for (const batch of chunk(pending, BATCH_SIZE)) {
    try {
      const values = await withRetry(`batch of ${batch.length}`, () =>
        embedTexts(batch.map((entry) => entry.text)),
      )
      batch.forEach((entry, index) => record(entry, values[index]))
    } catch (batchError) {
      // One bad input should not cost the whole batch — fall back to singles so
      // the failure is attributed to the place that actually caused it.
      console.warn(
        `      batch failed (${describeError(batchError)}); retrying ${batch.length} items individually`,
      )
      for (const entry of batch) {
        try {
          const values = await withRetry(entry.name, () => embedTexts([entry.text]))
          record(entry, values[0])
        } catch (itemError) {
          processed += 1
          const reason = describeError(itemError)
          failures.push({ name: entry.name, reason })
          console.error(
            `[${String(processed).padStart(2, ' ')}/${pending.length}] ${entry.name} — FAILED: ${reason}`,
          )
        }
      }
    }
  }

  /* 6. Upsert everything that embedded cleanly. */
  const rows = pending
    .filter((entry) => vectors.has(entry.input.slug))
    .map((entry) => ({
      place_id: placeIdFor(entry),
      model: entry.input.model,
      dim: entry.input.dim,
      embedding: toVectorLiteral(vectors.get(entry.input.slug) as number[]),
      content_hash: entry.input.contentHash,
    }))

  if (rows.length) {
    console.log(`\nUpserting ${rows.length} rows...`)
    const { error: writeError } = await db
      .from('place_embeddings')
      .upsert(rows, { onConflict: 'place_id,model' })

    if (writeError) {
      throw new Error(`Upsert into place_embeddings failed: ${writeError.message}`)
    }
  }

  /* 7. Orphans: report by default, delete only when explicitly asked. */
  if (orphanIds.length) {
    if (shouldPrune) {
      const { error: pruneError } = await db
        .from('place_embeddings')
        .delete()
        .eq('model', EMBEDDING_MODEL)
        .in('place_id', orphanIds)

      if (pruneError) {
        throw new Error(`Prune failed: ${pruneError.message}`)
      }
      console.log(`\nPruned ${orphanIds.length} orphaned row(s) (--prune).`)
    } else {
      console.warn(
        `\n${orphanIds.length} stored embedding(s) reference a place that is no longer in ` +
          'src/data/places.ts. They were left untouched — re-run with --prune to delete them.',
      )
      for (const id of orphanIds) console.warn(`  • ${id}`)
    }
  }

  return { embedded: rows.length, skipped, failed: failures.length }
}

/* --- Entry point ----------------------------------------------------------- */

async function main(): Promise<void> {
  console.log(`\nTuniTrip AI — embedding pipeline`)
  console.log(`Source of truth: src/data/places.ts (${PLACES.length} places)\n`)

  const plan = await buildPlan()

  if (isDryRun) {
    await runDryRun(plan)
    return
  }

  const totals = await runLive(plan)

  console.log('')
  console.log(`Successfully embedded: ${totals.embedded}`)
  console.log(`Skipped unchanged:     ${totals.skipped}`)
  console.log(`Failed:                ${totals.failed}`)

  if (totals.failed > 0) {
    console.error('\nSome places could not be embedded. The table was not fully updated.')
    process.exit(1)
  }

  console.log('\nDone. Verify retrieval with: npm run db:verify-rag')
}

main().catch((error: unknown) => {
  console.error(`\nEmbedding pipeline failed: ${describeError(error)}`)
  process.exit(1)
})
