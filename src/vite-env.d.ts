/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** "1" when /api/company is deployed alongside the app. */
  readonly VITE_LIVE_API?: string;
  /** "hash" to use hash routing on static hosts without SPA rewrites. */
  readonly VITE_ROUTER?: string;
  /** Hash builds only: the public URL that shared links open, e.g. a published preview. */
  readonly VITE_SHARE_BASE?: string;
  /** Where field telemetry is sent, e.g. "/api/telemetry". Unset: no telemetry at all. */
  readonly VITE_TELEMETRY_URL?: string;
  /** Share of page views that report telemetry, 0 to 1. Default 1. */
  readonly VITE_TELEMETRY_SAMPLE?: string;
}

/** Short commit hash of the build, injected by vite.config.ts. */
declare const __BUILD_ID__: string;
