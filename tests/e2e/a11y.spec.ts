import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';
import { expect, signIn, test } from './fixtures';

const PUBLIC = [
  '/',
  '/stocks/NVDA',
  '/stocks/NVDA/thesis',
  '/stocks/NVDA/valuation',
  '/market',
  '/search',
  '/earnings',
  '/earnings/ern_nvda_q3fy27',
  '/ipos',
  '/ipos/ipo_alto',
  '/research',
  '/research/rep_nvda_thesis',
  '/archive',
  '/archive/performance',
  '/auth/sign-in',
  '/auth/register',
  '/help',
  '/legal/terms',
  '/nope',
];
const PRIVATE = [
  '/watchlist',
  '/watchlist/alerts',
  '/alerts',
  '/alerts/new?instrument=NVDA',
  '/portfolio',
  '/portfolio/NVDA',
  '/paper/transactions/new?instrument=NVDA',
  '/profile',
  '/settings',
  '/settings/notifications',
  '/settings/research',
  '/account/edit',
  '/account/security',
  '/account/data',
  '/account/delete',
  '/demo',
];

async function audit(page: Page, path: string) {
  await page.goto(path);
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(400);
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'])
    .analyze();
  // Any violation fails, whatever its impact.
  expect(
    results.violations.map(
      (violation) =>
        `${path}: ${violation.impact} ${violation.id} (${violation.nodes.length}) ${violation.nodes[0]?.target.join(' ')}`,
    ),
  ).toEqual([]);
}

test.describe('accessibility (axe: WCAG 2.2 A/AA and best-practice rules)', () => {
  for (const path of PUBLIC) {
    test(`public ${path}`, async ({ page }) => audit(page, path));
  }
  test('signed-in screens', async ({ page }) => {
    test.slow();
    await signIn(page);
    for (const path of PRIVATE) await audit(page, path);
  });
});
