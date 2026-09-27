/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string
  readonly VITE_SUPABASE_ANON_KEY?: string
  /**
   * Overrides where the browser posts NOVA messages. Only a URL, so it is safe
   * to expose. Defaults to `/api/nova` in dev and the deployed Edge Function
   * in production. Never put a provider key here.
   */
  readonly VITE_NOVA_ENDPOINT?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
