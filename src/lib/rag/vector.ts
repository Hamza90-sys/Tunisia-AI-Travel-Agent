/**
 * Vector helpers for semantic retrieval.
 *
 * Pure maths and encoding only — nothing here calls an embedding provider, so
 * this module is safe to import from the browser bundle, a Node script, or a
 * Deno edge function alike.
 */

/**
 * Width of every stored vector.
 *
 * 768 rather than gemini-embedding-001's native 3072 because pgvector's HNSW
 * and ivfflat indexes cap at 2000 dimensions for the `vector` type. Changing
 * this constant is a schema change: `place_embeddings.embedding` is declared
 * `vector(768)` and `match_places` takes `vector(768)`.
 */
export const EMBEDDING_DIM = 768

/**
 * Scales a vector to unit length.
 *
 * Required, not cosmetic: gemini-embedding-001 only auto-normalises at its
 * native 3072 dimensions. Truncated 768-dimension vectors come back
 * un-normalised, and feeding those to a cosine index silently degrades ranking
 * because magnitude leaks into the distance.
 */
export function l2Normalize(vector: number[]): number[] {
  let sumOfSquares = 0
  for (const value of vector) sumOfSquares += value * value

  const magnitude = Math.sqrt(sumOfSquares)
  // A zero vector has no direction to preserve. Return a copy rather than
  // dividing by zero, and let the caller decide whether that is an error.
  if (magnitude === 0 || !Number.isFinite(magnitude)) return [...vector]

  return vector.map((value) => value / magnitude)
}

/**
 * Encodes a vector as the pgvector text literal, `[0.1,0.2,…]`.
 *
 * PostgREST hands RPC arguments to Postgres as text and lets the target type's
 * input function parse them, so the literal — not a JSON array — is what
 * `match_places(query_embedding vector(768))` expects.
 */
export function toVectorLiteral(vector: number[]): string {
  for (const value of vector) {
    if (!Number.isFinite(value)) {
      throw new Error(
        'Refusing to encode a vector containing NaN or Infinity — Postgres would reject the literal with an opaque parse error.',
      )
    }
  }
  return `[${vector.join(',')}]`
}

/** Throws unless `vector` is exactly `EMBEDDING_DIM` finite numbers. */
export function assertEmbeddingShape(vector: number[], context = 'embedding'): void {
  if (vector.length !== EMBEDDING_DIM) {
    throw new Error(
      `${context} has ${vector.length} dimensions; place_embeddings.embedding is vector(${EMBEDDING_DIM}).`,
    )
  }
  if (!vector.every(Number.isFinite)) {
    throw new Error(`${context} contains a non-finite value.`)
  }
}

/**
 * Cosine similarity in [-1, 1]. For unit vectors this equals the dot product,
 * and matches what `1 - (a <=> b)` computes in Postgres.
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error(`Cannot compare vectors of different widths (${a.length} vs ${b.length}).`)
  }

  let dot = 0
  let magA = 0
  let magB = 0
  for (let index = 0; index < a.length; index += 1) {
    dot += a[index] * b[index]
    magA += a[index] * a[index]
    magB += b[index] * b[index]
  }

  const denominator = Math.sqrt(magA) * Math.sqrt(magB)
  return denominator === 0 ? 0 : dot / denominator
}
