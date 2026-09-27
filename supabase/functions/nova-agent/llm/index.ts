/**
 * Provider selection.
 *
 * One switch, driven by `NOVA_LLM_PROVIDER` (server-side only, no VITE_
 * prefix). Gemini is the default and remains the working provider; nvidia
 * resolves to the seam and fails loudly rather than silently degrading.
 */
import { createGeminiProvider } from './gemini.ts'
import { createNvidiaProvider } from './nvidia.ts'
import { LLMError } from './types.ts'
import type { LLMProvider } from './types.ts'
import { NIM_MODEL_DEFAULT } from '../config.ts'

export * from './types.ts'
export { classifyGeminiError } from './gemini.ts'

export type ProviderId = 'gemini' | 'nvidia'

export const DEFAULT_PROVIDER: ProviderId = 'gemini'

export function isProviderId(value: string | undefined): value is ProviderId {
  return value === 'gemini' || value === 'nvidia'
}

export interface ProviderEnv {
  provider: string | undefined
  geminiApiKey: string | undefined
  model: string
  nvidiaBaseUrl: string | undefined
  nvidiaApiKey: string | undefined
  nvidiaModel: string | undefined
}

/** Builds the configured provider, or throws a normalised error. */
export function resolveProvider(env: ProviderEnv): LLMProvider {
  const id: ProviderId = isProviderId(env.provider) ? env.provider : DEFAULT_PROVIDER

  if (id === 'nvidia') {
    if (!env.nvidiaBaseUrl) {
      throw new LLMError(
        'provider_unavailable',
        'NOVA_LLM_PROVIDER=nvidia but NIM_BASE_URL is not set.',
      )
    }
    /*
     * No API key is required. A NIM container served locally accepts
     * unauthenticated requests; hosted NVIDIA endpoints need a key, so it is
     * passed through when present and simply omitted when not.
     */
    return createNvidiaProvider({
      baseUrl: env.nvidiaBaseUrl,
      apiKey: env.nvidiaApiKey,
      model: env.nvidiaModel ?? NIM_MODEL_DEFAULT,
    })
  }

  if (!env.geminiApiKey) {
    throw new LLMError('unauthorized', 'GEMINI_API_KEY is not set.')
  }

  return createGeminiProvider({ apiKey: env.geminiApiKey, model: env.model })
}
