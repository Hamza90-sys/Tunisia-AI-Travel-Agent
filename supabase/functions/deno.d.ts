/**
 * Minimal ambient declarations for the Deno globals used by the edge
 * functions, so `npm run typecheck` can check this directory with the normal
 * Node/DOM TypeScript config instead of skipping it.
 *
 * Only the surface we actually use is declared. Deno supplies the real
 * implementation at runtime; this file emits nothing.
 */
declare namespace Deno {
  export const env: {
    get(key: string): string | undefined
  }

  export function serve(handler: (request: Request) => Response | Promise<Response>): unknown
}
