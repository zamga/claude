/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** "1" when /api/company is deployed alongside the app. */
  readonly VITE_LIVE_API?: string;
  /** "hash" to use hash routing on static hosts without SPA rewrites. */
  readonly VITE_ROUTER?: string;
}
