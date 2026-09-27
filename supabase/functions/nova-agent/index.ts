/**
 * NOVA agent — Supabase Edge Function transport.
 *
 * Deploy with:
 *   supabase functions deploy nova-agent
 *   supabase secrets set GEMINI_API_KEY=...
 *
 * This file is the only Deno-specific part of the agent. All the behaviour
 * lives in `agent.ts`, which the Vite dev proxy runs unchanged, so the local
 * and deployed paths cannot diverge.
 *
 * Secrets: reads GEMINI_API_KEY from the function's environment. SUPABASE_URL
 * and SUPABASE_ANON_KEY are injected by the platform. There is deliberately no
 * service-role key here — the agent works entirely under the caller's own JWT.
 */
import { runNovaAgent } from './agent.ts'
import type {
  NovaAgentRequestBody,
  NovaServerEvent,
} from '../../../src/lib/nova/events.ts'

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function sseHeaders(): HeadersInit {
  return {
    ...CORS_HEADERS,
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
  }
}

function encodeEvent(event: NovaServerEvent): string {
  return `data: ${JSON.stringify(event)}\n\n`
}

Deno.serve(async (request: Request): Promise<Response> => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS })
  }

  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    })
  }

  let body: NovaAgentRequestBody
  try {
    body = (await request.json()) as NovaAgentRequestBody
  } catch {
    // Malformed JSON is reported through the event stream too, so the client
    // has exactly one error path to handle.
    return new Response(
      encodeEvent({ type: 'error', code: 'bad_request', message: 'Malformed request body.' }),
      { status: 200, headers: sseHeaders() },
    )
  }

  const env = {
    geminiApiKey: Deno.env.get('GEMINI_API_KEY'),
    supabaseUrl: Deno.env.get('SUPABASE_URL'),
    supabaseAnonKey: Deno.env.get('SUPABASE_ANON_KEY'),
    authorization: request.headers.get('Authorization'),
    model: Deno.env.get('NOVA_MODEL'),
  }

  const encoder = new TextEncoder()
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const event of runNovaAgent(env, body)) {
          controller.enqueue(encoder.encode(encodeEvent(event)))
        }
      } catch (error) {
        // runNovaAgent yields its own errors; reaching here means the
        // generator itself broke. Still close with a clean client-facing event.
        console.error(`[nova-agent] stream failure: ${String(error)}`)
        controller.enqueue(
          encoder.encode(
            encodeEvent({
              type: 'error',
              code: 'internal_error',
              message: 'Something went wrong on NOVA’s side. Try again.',
            }),
          ),
        )
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, { headers: sseHeaders() })
})
