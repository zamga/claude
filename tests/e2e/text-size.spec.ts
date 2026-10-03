import type { Page } from '@playwright/test';
import { expect, isPhone, signIn, test } from './fixtures';

const PUBLIC = [
  '/',
  '/stocks/NVDA',
  '/stocks/NVDA/thesis',
  '/stocks/NVDA/valuation',
  '/market',
  '/search',
  '/earnings',
  '/ipos',
  '/ipos/ipo_alto',
  '/research',
  '/archive',
  '/archive/performance',
  '/auth/sign-in',
  '/help',
];

const PRIVATE = [
  '/watchlist',
  '/watchlist/alerts',
  '/alerts',
  '/alerts/new?instrument=NVDA',
  '/portfolio',
  '/portfolio/NVDA',
  '/profile',
  '/settings',
  '/settings/notifications',
];

/**
 * Doubles the text size (as a 32 px browser default or the in-app setting would) and lists every
 * piece of text that leaves its box or the screen. Scrolling strips, ellipsised secondary text and
 * screen-reader-only text are deliberate and skipped.
 */
async function textSpills(page: Page, path: string): Promise<string[]> {
  await page.goto(path);
  await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible();
  await expect(page.locator('[data-skeleton]')).toHaveCount(0);
  await page.evaluate(() => document.fonts.ready);
  await page.evaluate(() => document.documentElement.style.setProperty('--text-scale', '2'));
  await page.evaluate(
    () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
  );
  return page.evaluate(() => {
    const width = window.innerWidth;
    const problems: string[] = [];
    const sideways = document.documentElement.scrollWidth - width;
    if (sideways > 1) problems.push(`the page scrolls sideways by ${sideways}px`);
    for (const element of document.querySelectorAll<HTMLElement>('[data-pane] *')) {
      const style = getComputedStyle(element);
      if (style.display === 'none' || style.visibility === 'hidden') continue;
      const ownText = [...element.childNodes].some(
        (node) => node.nodeType === Node.TEXT_NODE && node.textContent?.trim(),
      );
      if (!ownText) continue;
      const rect = element.getBoundingClientRect();
      if (rect.width <= 2 || rect.height <= 2) continue;
      if (element.closest('[aria-hidden="true"], [role="tablist"], [role="radiogroup"]')) continue;
      if (['auto', 'scroll'].includes(style.overflowX) || style.textOverflow === 'ellipsis')
        continue;
      const spills = style.display !== 'inline' && element.scrollWidth > element.clientWidth + 2;
      if (spills || rect.right > width + 2) {
        problems.push(
          `${element.tagName.toLowerCase()} “${element.textContent?.trim().slice(0, 32)}”`,
        );
      }
    }
    return problems;
  });
}

test.describe('200% text (acceptance check 10)', () => {
  test.beforeEach(({ page }) => {
    test.skip(!isPhone(page), 'enlarged text runs out of room at phone width');
  });

  test('public screens keep every word inside its box', async ({ page }) => {
    for (const path of PUBLIC) expect(await textSpills(page, path), path).toEqual([]);
  });

  test('signed-in screens keep every word inside its box', async ({ page }) => {
    await signIn(page);
    for (const path of PRIVATE) expect(await textSpills(page, path), path).toEqual([]);
  });
});
