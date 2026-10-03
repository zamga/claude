import { defineConfig, devices } from '@playwright/test';

/**
 * End-to-end journeys against the production build (vite preview). Set CHROMIUM_PATH to use a
 * preinstalled browser; otherwise run `npx playwright install chromium` first.
 */
const executablePath = process.env.CHROMIUM_PATH || undefined;
const port = Number(process.env.E2E_PORT ?? 4173);

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  timeout: 45_000,
  expect: { timeout: 8_000 },
  use: {
    baseURL: `http://localhost:${port}`,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    launchOptions: { executablePath },
    locale: 'en-GB',
    timezoneId: 'Europe/Ljubljana',
  },
  projects: [
    { name: 'phone', use: { ...devices['Pixel 7'], launchOptions: { executablePath } } },
    {
      name: 'desktop',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1440, height: 900 },
        launchOptions: { executablePath },
      },
    },
  ],
  webServer: {
    command: `npx vite preview --port ${port} --strictPort`,
    url: `http://localhost:${port}`,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
