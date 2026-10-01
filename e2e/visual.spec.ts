import { expect, test } from '@playwright/test';

/*
 * Visual regression: every public page in both themes, against committed
 * baselines. Screenshots only compare within one rendering environment, so CI
 * runs these inside the pinned Playwright container, and they are opt-in
 * locally (VISUAL=1, see playwright.config.ts). Record new baselines with
 * `npm run test:visual:update`, or from CI with the workflow's
 * "update_baselines" input, and review the images like any other diff.
 */

const PAGES = [
  { name: 'home', path: '/' },
  { name: 'chart-nvda', path: '/chart/nvda' },
  { name: 'atlas', path: '/atlas' },
  { name: 'method', path: '/method' },
  { name: 'survey', path: '/survey' },
  { name: 'not-found', path: '/no-such-chart' },
];

for (const theme of ['light', 'dark'] as const) {
  for (const { name, path } of PAGES) {
    test(`${name} in ${theme}`, async ({ page }) => {
      // Reduced motion settles every entrance; the chart draws flat and seeded, so pixels repeat.
      await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' });
      await page.goto(path);
      await page.waitForSelector('html[data-hydrated]', { state: 'attached' });
      await page.evaluate(() => document.fonts.ready.then(() => undefined));
      await expect(page).toHaveScreenshot(`${name}-${theme}.png`, {
        fullPage: true,
        animations: 'disabled',
        caret: 'hide',
        maxDiffPixelRatio: 0.002,
      });
    });
  }
}
