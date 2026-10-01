import { defineConfig, devices } from '@playwright/test';

/*
 * End-to-end and accessibility checks against the production build, on a
 * desktop and a phone. Run with `npm run test:e2e`.
 *
 * Two servers: the static site as any static host serves it (no engine, so
 * the request page shows its preview), and the Node server running the
 * scripted engine, for the live request flow and engine-written reports.
 */
export const SITE_PORT = 4321;
export const ENGINE_PORT = 4322;

export default defineConfig({
  testDir: 'e2e',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['list']] : 'list',
  use: {
    baseURL: `http://localhost:${SITE_PORT}`,
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } },
    { name: 'phone', use: { ...devices['Pixel 7'] } },
  ],
  webServer: [
    {
      command: `npm run build && npx vite preview --port ${SITE_PORT} --strictPort`,
      url: `http://localhost:${SITE_PORT}`,
      reuseExistingServer: !process.env.CI,
      timeout: 180_000,
    },
    {
      // Starts once the site build above is served, since the server renders with it.
      command: `npm run build:server && node scripts/wait-for.mjs http://localhost:${SITE_PORT} && node dist-server/main.js`,
      url: `http://127.0.0.1:${ENGINE_PORT}/api/health`,
      reuseExistingServer: !process.env.CI,
      timeout: 240_000,
      env: {
        PORT: String(ENGINE_PORT),
        HOST: '127.0.0.1',
        UNCOVERED_ENGINE: 'fixture',
        UNCOVERED_FIXTURE_PACE: '250',
        UNCOVERED_RATE_LIMIT: '1000',
        UNCOVERED_MAX_CONCURRENT: '20',
        UNCOVERED_DATA_DIR: 'test-results/engine-data',
      },
    },
  ],
});
