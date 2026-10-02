import { expect, test, type Page } from '@playwright/test';

/*
 * The interactions the design is built on: the headline that takes up the
 * company being typed, the lamp that makes a figure's source legible, the
 * value landscape's assumptions, and the register's seals. Each must also
 * work as plain HTML for assistive technology, and rest when motion is
 * reduced.
 */

function watchErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  return errors;
}

test('the headline takes up the company being typed, and nothing below it moves', async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto('/');
  const heading = page.getByRole('heading', { level: 1 });
  await expect(heading).toHaveAccessibleName(/Initiating coverage on every company\./);
  const submit = page.getByRole('button', { name: 'Initiate coverage' }).first();
  const before = (await submit.boundingBox())!.y;
  await page.getByRole('textbox', { name: 'Company', exact: true }).fill('Kolektor Group d.o.o.');
  await expect(page.locator('[data-typed]')).toContainText('Kolektor Group');
  // The sentence itself stays the same for screen readers and search engines.
  await expect(heading).toHaveAccessibleName(/Initiating coverage on every company\./);
  expect((await submit.boundingBox())!.y).toBeCloseTo(before, 0);
  expect(errors).toEqual([]);
});

test('holding the cover to the lamp makes a figure’s source legible', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop', 'the pointer is the lamp on a desk; a finger on a phone');
  await page.goto('/');
  const cover = page.getByRole('article', { name: /Cover of the initiation report on Krka/ });
  const row = cover.getByText('Revenue 2025');
  const box = (await row.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height, { steps: 6 });
  await expect(cover).toHaveAttribute('data-lamp', 'held');
  await expect
    .poll(async () => Number(await cover.evaluate((el) => getComputedStyle(el).getPropertyValue('--lit'))))
    .toBeGreaterThan(0.6);
  // The source printed under the figure, as microtext and legibly.
  await expect(cover.getByText(/^Reported · Krka, d\. d\. · Mar 2026$/).first()).toBeAttached();
  await page.mouse.move(5, 5);
  await expect(cover).toHaveAttribute('data-lamp', 'free');
});

test('the value landscape answers its assumptions', async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto('/report/krka#valuation');
  const wacc = page.getByRole('slider', { name: /Cost of capital/ });
  await wacc.scrollIntoViewIfNeeded();
  const start = await wacc.getAttribute('aria-valuetext');
  expect(start).toMatch(/^7\.6%: €249 a share$/);
  await wacc.focus();
  for (let i = 0; i < 10; i++) await page.keyboard.press('ArrowRight');
  const moved = await wacc.getAttribute('aria-valuetext');
  expect(moved).not.toBe(start);
  // A higher cost of capital is worth less.
  const value = (text: string | null) => Number(text?.match(/€([\d,]+)/)?.[1]?.replace(',', ''));
  expect(value(moved)).toBeLessThan(value(start));
  await expect(page.getByText(/price implies a cost of capital of/)).toBeVisible();
  await page.getByRole('button', { name: 'Back to the base case' }).click();
  await expect(wacc).toHaveAttribute('aria-valuetext', start!);
  expect(errors).toEqual([]);
});

test('a seal in the register starts an initiation for its company', async ({ page }) => {
  await page.goto('/');
  const seal = page.getByRole('link', { name: /^Pipistrel Not yet covered Initiate coverage/ });
  await seal.scrollIntoViewIfNeeded();
  await seal.click();
  await expect(page).toHaveURL(/\/initiate$/);
  await expect(page.locator('input[name="company"]')).toHaveValue('Pipistrel d.o.o.');
});

test('with reduced motion the lamp is set down, not swept, and nothing turns', async ({ browser }) => {
  const context = await browser.newContext({ reducedMotion: 'reduce', viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  await page.goto('/');
  const cover = page.getByRole('article', { name: /Cover of the initiation report on Krka/ });
  await expect
    .poll(async () => cover.evaluate((el) => getComputedStyle(el).getPropertyValue('--lit').trim()))
    .toBe('0.700');
  const first = await cover.evaluate((el) => getComputedStyle(el).getPropertyValue('--lx'));
  await page.waitForTimeout(1500);
  expect(await cover.evaluate((el) => getComputedStyle(el).getPropertyValue('--lx'))).toBe(first);
  expect(await cover.evaluate((el) => getComputedStyle(el).getPropertyValue('--ry').trim())).toBe('0.00deg');
  await context.close();
});
