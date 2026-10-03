import type { Page } from '@playwright/test';
import { CONDITIONS_KEY, expect, test } from './fixtures';

/** Keep every demo request slow (about 2.6 s) so loading skeletons stay on screen. */
async function slowNetwork(page: Page): Promise<void> {
  await page.addInitScript((key) => {
    sessionStorage.setItem(
      key,
      JSON.stringify({ offline: false, slow: true, nextWrite: 'normal', instant: false }),
    );
  }, CONDITIONS_KEY);
}

/** Running shimmer animations, and whether each one animates only `transform`. */
function shimmer(page: Page) {
  return page.evaluate(() =>
    document
      .getAnimations()
      .filter((animation) => (animation as CSSAnimation).animationName === 'shimmer')
      .map((animation) =>
        ((animation.effect as KeyframeEffect | null)?.getKeyframes() ?? []).every((frame) =>
          Object.keys(frame).every((key) =>
            ['transform', 'offset', 'easing', 'composite', 'computedOffset'].includes(key),
          ),
        ),
      ),
  );
}

function motionTokens(page: Page) {
  return page.evaluate(() => {
    const style = getComputedStyle(document.documentElement);
    return ['--detail-offset', '--sheet-offset', '--press-scale', '--dur-detail-enter'].map(
      (name) => style.getPropertyValue(name).trim(),
    );
  });
}

test.describe('motion (acceptance check 09)', () => {
  test('full motion: loading skeletons shimmer with a transform-only sheen', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await slowNetwork(page);
    await page.goto('/market');
    await expect(page.locator('[data-skeleton]').first()).toBeVisible();
    await expect(page.locator('html')).toHaveAttribute('data-motion', 'full');
    const running = await shimmer(page);
    expect(running.length).toBeGreaterThan(0);
    expect(running.every(Boolean)).toBe(true);
  });

  test('reduced motion: no shimmer and no movement, states still shown', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await slowNetwork(page);
    await page.goto('/market');
    await expect(page.locator('[data-skeleton]').first()).toBeVisible();
    await expect(page.locator('html')).toHaveAttribute('data-motion', 'reduced');
    expect(await shimmer(page)).toEqual([]);
    expect(await motionTokens(page)).toEqual(['0px', '0px', '1', '90ms']);
    // The loaded screen replaces the placeholders without any movement.
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page.locator('[data-skeleton]')).toHaveCount(0, { timeout: 10_000 });
  });

  test('the in-app Motion setting previews reduced motion immediately', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.goto('/settings');
    await expect(page.locator('html')).toHaveAttribute('data-motion', 'full');
    await page.getByLabel('Motion').selectOption('reduce');
    await expect(page.locator('html')).toHaveAttribute('data-motion', 'reduced');
    expect(await motionTokens(page)).toEqual(['0px', '0px', '1', '90ms']);
  });
});
