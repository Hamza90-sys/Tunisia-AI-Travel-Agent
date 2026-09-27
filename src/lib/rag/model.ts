/**
 * Embedding model configuration.
 *
 * Deliberately dependency-free so it can be imported from anywhere: the
 * browser bundle, the Node embedding pipeline, and the Deno edge function.
 * Nothing here imports a type from `@/types`, which would drag the UI type
 * barrel (and `lucide-react`) into a server runtime.
 */

/**
 * Embedding model of record.
 *
 * gemini-embedding-001 is the stable text model. Its sibling
 * gemini-embedding-2 is multimodal and self-normalising, but it is still
 * preview — and a pgvector column's width is fixed at migration time, so
 * adopting it later means a re-embed plus a column change either way.
 *
 * Stored on every row in `place_embeddings.model`, which is half of the
 * `(place_id, model)` unique key, so two models can coexist during a swap.
 */
export const EMBEDDING_MODEL = 'gemini-embedding-001'

/**
 * Task types for gemini-embedding-001. Documents and queries must be embedded
 * with the matching pair or similarity scores degrade.
 */
export const EMBEDDING_TASK_DOCUMENT = 'RETRIEVAL_DOCUMENT'
export const EMBEDDING_TASK_QUERY = 'RETRIEVAL_QUERY'
