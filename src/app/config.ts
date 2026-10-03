import { DATA_MODE } from '@/data/transport';

/**
 * Startup configuration check (spec page 61): a live build without its required variables must
 * not start as if it worked. Names only; values live in the deployment's secret store.
 */
export const REQUIRED_LIVE_VARIABLES = [
  'VITE_API_BASE_URL',
  'VITE_SUPABASE_URL',
  'VITE_SUPABASE_PUBLISHABLE_KEY',
] as const;

export function missingLiveVariables(): string[] {
  const env = import.meta.env as Record<string, string | undefined>;
  return REQUIRED_LIVE_VARIABLES.filter((name) => !env[name]);
}

export function assertConfiguration(): void {
  if (DATA_MODE !== 'live') return;
  const missing = missingLiveVariables();
  if (missing.length > 0) {
    console.error(`Live mode is missing required configuration: ${missing.join(', ')}`);
    if (!window.location.pathname.startsWith('/maintenance'))
      window.history.replaceState(null, '', '/maintenance?reason=configuration');
  }
}
