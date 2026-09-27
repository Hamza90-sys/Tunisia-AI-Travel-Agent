/**
 * Browser transport for the NOVA agent.
 *
 * Posts to one logical endpoint and parses the server-sent event stream. The
 * browser never talks to Gemini — it has no key and no SDK; `@google/genai` is
 * a devDependency precisely so it cannot end up here.
 */
import { supabase } from '@/lib/supabase/client'
import type { NovaServerEvent } from './events'

/**
 * Where the agent lives.
 *
 * Development goes through the Vite middleware on the same origin; production
 * goes to the deployed Edge Function. `VITE_NOVA_ENDPOINT` overrides both — it
 * is only a URL, so it is safe to expose.
 */
export function resolveNovaEndpoint(): string | null {
  const override = import.meta.env.VITE_NOVA_ENDPOINT?.trim()
  if (override) return override

  if (import.meta.env.DEV) return '/api/nova'

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim()
  return supabaseUrl ? `${supabaseUrl.replace(/\/$/, '')}/functions/v1/nova-agent` : null
}

export interface SendToNovaInput {
  message: string
  conversationId?: string | null
  tripId?: string | null
  signal?: AbortSignal
}

/**
 * Streams one exchange with NOVA.
 *
 * Yields the server's events in order. Transport failures are converted into
 * an `error` event so callers have exactly one failure path — nothing throws
 * a network error at the UI.
 */
export async function* streamNovaReply(
  input: SendToNovaInput,
): AsyncGenerator<NovaServerEvent> {
  const endpoint = resolveNovaEndpoint()

  if (!endpoint) {
    yield {
      type: 'error',
      code: 'not_configured',
      message: 'NOVA is not connected in this environment yet.',
    }
    return
  }

  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim()

  /*
   * Authorization is ALWAYS sent, signed in or not.
   *
   * Supabase's function gateway verifies a JWT before the function runs and
   * rejects a request with no `Authorization` header outright —
   * `401 UNAUTHORIZED_NO_AUTH_HEADER`. The `apikey` header does not satisfy it.
   * The anon key is itself a valid project JWT, so sending it authenticates an
   * anonymous traveller as the `anon` role: the agent runs, answers, and simply
   * persists nothing because that JWT carries no user.
   *
   * Omitting it for signed-out visitors (as this did originally) meant every
   * anonymous request 401'd in production while working fine against the dev
   * proxy, which has no gateway in front of it.
   */
  if (supabase) {
    const { data } = await supabase.auth.getSession()
    const token = data.session?.access_token ?? anonKey
    if (token) headers.Authorization = `Bearer ${token}`
  } else if (anonKey) {
    headers.Authorization = `Bearer ${anonKey}`
  }

  if (anonKey) headers.apikey = anonKey

  let response: Response
  try {
    response = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        message: input.message,
        conversationId: input.conversationId ?? null,
        tripId: input.tripId ?? null,
      }),
      signal: input.signal,
    })
  } catch {
    yield {
      type: 'error',
      code: 'not_configured',
      message: 'NOVA could not be reached. Check that the agent is running.',
    }
    return
  }

  if (!response.ok || !response.body) {
    yield {
      type: 'error',
      code: response.status === 401 ? 'unauthorized' : 'internal_error',
      message:
        response.status === 404
          ? 'The NOVA agent endpoint was not found. Deploy the nova-agent function.'
          : 'NOVA is unavailable right now. Try again in a moment.',
    }
    return
  }

  yield* parseEventStream(response.body)
}

/** Minimal SSE reader: one JSON object per `data:` line, blank line separated. */
async function* parseEventStream(
  body: ReadableStream<Uint8Array>,
): AsyncGenerator<NovaServerEvent> {
  const reader = body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })

      let boundary = buffer.indexOf('\n\n')
      while (boundary !== -1) {
        const frame = buffer.slice(0, boundary)
        buffer = buffer.slice(boundary + 2)
        const event = parseFrame(frame)
        if (event) yield event
        boundary = buffer.indexOf('\n\n')
      }
    }

    const trailing = parseFrame(buffer)
    if (trailing) yield trailing
  } finally {
    reader.releaseLock()
  }
}

function parseFrame(frame: string): NovaServerEvent | null {
  const line = frame
    .split('\n')
    .find((candidate) => candidate.startsWith('data:'))
    ?.slice(5)
    .trim()

  if (!line) return null

  try {
    return JSON.parse(line) as NovaServerEvent
  } catch {
    // A malformed frame must not abort a conversation that is otherwise fine.
    return null
  }
}
