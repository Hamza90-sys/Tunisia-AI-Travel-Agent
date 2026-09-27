/**
 * Gemini provider.
 *
 * The only place in the agent that imports `@google/genai`. Everything the
 * orchestrator sees is `LLMRequest` / `LLMResponse`, so replacing this file
 * replaces the provider.
 */
import { GoogleGenAI, Type } from '@google/genai'
import type { Content, FunctionDeclaration, Part, Schema } from '@google/genai'

import { LLMError } from './types.ts'
import type {
  LLMErrorKind,
  LLMProvider,
  LLMRequest,
  LLMResponse,
  LLMToolCall,
  LLMToolDefinition,
} from './types.ts'

/** Translates plain JSON Schema into Gemini's `Schema` dialect. */
function toGeminiSchema(schema: Record<string, unknown>): Schema {
  const jsonType = String(schema.type ?? 'object').toUpperCase()
  const type = (Type as unknown as Record<string, Type>)[jsonType] ?? Type.OBJECT

  const out: Schema = { type }

  if (typeof schema.description === 'string') out.description = schema.description
  if (Array.isArray(schema.enum)) out.enum = schema.enum.map(String)
  if (Array.isArray(schema.required)) out.required = schema.required.map(String)
  if (typeof schema.minimum === 'number') out.minimum = schema.minimum
  if (typeof schema.maximum === 'number') out.maximum = schema.maximum

  if (schema.items && typeof schema.items === 'object') {
    out.items = toGeminiSchema(schema.items as Record<string, unknown>)
  }

  if (schema.properties && typeof schema.properties === 'object') {
    const properties: Record<string, Schema> = {}
    for (const [key, value] of Object.entries(schema.properties as Record<string, unknown>)) {
      properties[key] = toGeminiSchema(value as Record<string, unknown>)
    }
    out.properties = properties
  }

  return out
}

function toDeclaration(tool: LLMToolDefinition): FunctionDeclaration {
  return {
    name: tool.name,
    description: tool.description,
    parameters: toGeminiSchema(tool.parameters),
  }
}

/** Pulls the provider's HTTP code and gRPC status out of an SDK error. */
function providerStatus(message: string): { code: number | null; status: string } {
  const code = Number(message.match(/"code"\s*:\s*(\d{3})/)?.[1] ?? Number.NaN)
  const status = message.match(/"status"\s*:\s*"([A-Z_]+)"/)?.[1] ?? ''
  return { code: Number.isFinite(code) ? code : null, status }
}

/**
 * Maps a Gemini failure onto the normalised categories.
 *
 * `PerDay` in the quotaId is the only reliable marker of daily exhaustion —
 * a per-minute limit reports the same 429 and RESOURCE_EXHAUSTED, and
 * conflating them tells travellers to come back tomorrow over a 60-second
 * hiccup.
 */
export function classifyGeminiError(message: string): LLMErrorKind {
  if (/PerDay/i.test(message)) return 'quota_exceeded'

  const { code, status } = providerStatus(message)

  if (code === 429 || status === 'RESOURCE_EXHAUSTED') return 'rate_limited'
  if (code === 401 || code === 403 || status === 'PERMISSION_DENIED') return 'unauthorized'
  if (code === 400 || status === 'INVALID_ARGUMENT') return 'bad_request'
  if ((code !== null && code >= 500) || /UNAVAILABLE|INTERNAL|DEADLINE_EXCEEDED/.test(status)) {
    return 'provider_unavailable'
  }
  if (/fetch failed|ECONNRESET|ETIMEDOUT|network/i.test(message)) return 'provider_unavailable'

  return 'internal_error'
}

export interface GeminiProviderOptions {
  apiKey: string
  model: string
}

export function createGeminiProvider(options: GeminiProviderOptions): LLMProvider {
  const ai = new GoogleGenAI({ apiKey: options.apiKey })

  return {
    id: 'gemini',
    model: options.model,

    async generateWithTools(request: LLMRequest): Promise<LLMResponse> {
      /*
       * Gemini threads everything through one `contents` array: prior turns,
       * the current message, the model's tool calls, then the tool results as
       * a user turn. Building it here keeps that shape out of the orchestrator.
       */
      const contents: Content[] = request.history.map((turn) => ({
        role: turn.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: turn.text }],
      }))

      contents.push({ role: 'user', parts: [{ text: request.message }] })

      if (request.toolCycle.length) {
        contents.push({
          role: 'model',
          parts: request.toolCycle.map(({ call }) => ({
            functionCall: {
              id: call.id ?? undefined,
              name: call.name,
              args: call.arguments,
            },
          })),
        })
        contents.push({
          role: 'user',
          parts: request.toolCycle.map(({ result }) => ({
            functionResponse: {
              id: result.id ?? undefined,
              name: result.name,
              response: result.response,
            },
          })) as Part[],
        })
      }

      let response
      try {
        response = await ai.models.generateContent({
          model: options.model,
          contents,
          config: {
            systemInstruction: request.system,
            tools: request.tools.length
              ? [{ functionDeclarations: request.tools.map(toDeclaration) }]
              : undefined,
            ...(request.maxOutputTokens ? { maxOutputTokens: request.maxOutputTokens } : {}),
          },
        })
      } catch (error) {
        const detail = error instanceof Error ? error.message : String(error)
        throw new LLMError(classifyGeminiError(detail), detail)
      }

      const toolCalls: LLMToolCall[] = (response.functionCalls ?? []).map((call) => ({
        id: call.id ?? null,
        name: call.name ?? '',
        arguments: (call.args ?? {}) as Record<string, unknown>,
      }))

      return {
        text: (response.text ?? '').trim(),
        toolCalls,
        usage: {
          inputTokens: response.usageMetadata?.promptTokenCount ?? null,
          outputTokens: response.usageMetadata?.candidatesTokenCount ?? null,
        },
        model: options.model,
      }
    },
  }
}
