import { defineConfig, devices } from '@playwright/test';

/**
 * End-to-end and accessibility tests against the production build.
 * Chromium gets WebGL through SwiftShader. The app treats software GL as
 * incapable and draws the flat chart, so most tests cover that path; the
 * relief test forces WebGL on to cover the other.
 */
const gl = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'];

export default defineConfig({
  testDir: 'e2e',
  // Pixel baselines are opt-in: they only compare within one rendering environment.
  testIgnore: process.env.VISUAL ? [] : ['**/visual.spec.ts'],
  timeout: 45_000,
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: 'http://localhost:4173',
    trace: 'retain-on-failure',
    launchOptions: { args: gl },
  },
  webServer: {
    command: 'npm run build:fast && npx vite preview --port 4173 --strictPort',
    url: 'http://localhost:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } },
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
  ],
});
