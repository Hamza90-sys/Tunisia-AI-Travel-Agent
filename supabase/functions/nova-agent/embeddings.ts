/**
 * Query embedding boundary for the existing TuniTravel RAG index.
 *
 * The catalogue was indexed with Gemini's 768-dimensional embedding model, so
 * query vectors must remain compatible with it even after the conversational
 * LLM moves to NVIDIA. This is intentionally separate from `llm/`.
 */
import { GoogleGenAI } from '@google/genai'

import { EMBEDDING_MODEL, EMBEDDING_TASK_QUERY } from '../../../src/lib/rag/model.ts'
import {
  EMBEDDING_DIM,
  assertEmbeddingShape,
  l2Normalize,
} from '../../../src/lib/rag/vector.ts'

export interface EmbeddingProvider {
  embedQuery(query: string): Promise<number[]>
}

export class EmbeddingError extends Error {}

export function createGeminiEmbeddingProvider(apiKey: string | undefined): EmbeddingProvider {
  return {
    async embedQuery(query: string): Promise<number[]> {
      if (!apiKey) throw new EmbeddingError('Gemini embedding is not configured.')

      try {
        const ai = new GoogleGenAI({ apiKey })
        const response = await ai.models.embedContent({
          model: EMBEDDING_MODEL,
          contents: query,
          config: { taskType: EMBEDDING_TASK_QUERY, outputDimensionality: EMBEDDING_DIM },
        })
        const values = response.embeddings?.[0]?.values
        if (!values || values.length !== EMBEDDING_DIM) {
          throw new EmbeddingError('The embedding model returned an incompatible vector.')
        }
        const embedding = l2Normalize(values)
        assertEmbeddingShape(embedding, 'query embedding')
        return embedding
      } catch (error) {
        if (error instanceof EmbeddingError) throw error
        throw new EmbeddingError('The query embedding could not be created.')
      }
    },
  }
}
