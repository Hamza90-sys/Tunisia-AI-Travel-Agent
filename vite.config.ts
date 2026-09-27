import { fileURLToPath, URL } from 'node:url'

import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'
import type { Plugin } from 'vite'

/** Path the browser posts to in development. Mirrors the deployed function. */
const NOVA_DEV_PATH = '/api/nova'

/** Module the dev server runs — the same core the edge function deploys. */
const AGENT_MODULE = '/supabase/functions/nova-agent/agent.ts'

/**
 * Development transport for the NOVA agent.
 *
 * In production the browser talks to the deployed Supabase Edge Function. There
 * is no edge runtime locally, so this middleware plays the same role: it reads
 * the server-only secrets, runs the *identical* agent core through Vite's SSR
 * module loader, and streams the same SSE events. Nothing about the agent is
 * reimplemented here — if it were, dev and production would drift.
 *
 * `GEMINI_API_KEY` is read through `loadEnv` on the Node side. It has no
 * `VITE_` prefix, so it is never part of the client bundle; this middleware is
 * the only thing in the dev server that can see it.
 */
function novaDevProxy(env: Record<string, string>): Plugin {
  return {
    name: 'tunitrip:nova-dev-proxy',
    // Serve only. `vite build` never loads the agent or its dependencies.
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use(NOVA_DEV_PATH, async (request, response) => {
        if (request.method === 'OPTIONS') {
          response.writeHead(204, {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Headers': 'authorization, content-type',
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
          })
          response.end()
          return
        }

        if (request.method !== 'POST') {
          response.writeHead(405, { 'Content-Type': 'application/json' })
          response.end(JSON.stringify({ error: 'Method not allowed' }))
          return
        }

        response.writeHead(200, {
          'Content-Type': 'text/event-stream; charset=utf-8',
          'Cache-Control': 'no-cache, no-transform',
          Connection: 'keep-alive',
        })

        const send = (event: unknown) => response.write(`data: ${JSON.stringify(event)}\n\n`)

        try {
          const chunks: Buffer[] = []
          for await (const chunk of request) chunks.push(chunk as Buffer)

          let body: unknown
          try {
            body = JSON.parse(Buffer.concat(chunks).toString('utf8'))
          } catch {
            // Same code the edge function returns, so the client has one
            // behaviour to handle regardless of which transport served it.
            send({
              type: 'error',
              code: 'bad_request',
              message: 'Malformed request body.',
            })
            return
          }

          // ssrLoadModule transforms the TypeScript and externalises the npm
          // dependencies, so the edge function's source runs here unmodified.
          const module = await server.ssrLoadModule(AGENT_MODULE)
          const runNovaAgent = module.runNovaAgent as (
            agentEnv: unknown,
            requestBody: unknown,
          ) => AsyncGenerator<unknown>

          for await (const event of runNovaAgent(
            {
              geminiApiKey: env.GEMINI_API_KEY,
              supabaseUrl: env.VITE_SUPABASE_URL,
              supabaseAnonKey: env.VITE_SUPABASE_ANON_KEY,
              authorization: request.headers.authorization ?? null,
              model: env.NOVA_MODEL,
            },
            body,
          )) {
            send(event)
          }
        } catch (error) {
          server.config.logger.error(
            `[nova-dev-proxy] ${error instanceof Error ? error.message : String(error)}`,
          )
          send({
            type: 'error',
            code: 'internal_error',
            message: 'Something went wrong on NOVA’s side. Try again.',
          })
        } finally {
          response.end()
        }
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // Empty prefix: this reads server-only variables too. They are used solely
  // inside the dev middleware above and are never passed to `define`, so
  // nothing here can reach the browser bundle.
  const env = loadEnv(mode, process.cwd(), '')

  return {
    plugins: [react(), tailwindcss(), novaDevProxy(env)],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
    server: {
      port: 5173,
      host: true,
    },
  }
})
