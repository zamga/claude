import { expect, test as base, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

// Pages are prerendered; wait for hydration before interacting.
const test = base.extend({
  page: async ({ page }, use) => {
    const goto = page.goto.bind(page);
    page.goto = async (url, options) => {
      const res = await goto(url, options);
      await page.waitForSelector('html[data-hydrated]', { state: 'attached' });
      return res;
    };
    await use(page);
  },
});

const errorsOf = (page: Page) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  return errors;
};

test('home opens on a live chart and switches companies', async ({ page }) => {
  const errors = errorsOf(page);
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('The price is');
  await expect(page.getByText(/The market is betting on/)).toBeVisible();
  await page.getByRole('button', { name: 'Coca-Cola', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Coca-Cola', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('aside').filter({ hasText: 'sea level $86.08' })).toBeVisible();
  expect(errors).toEqual([]);
});

test('chart page reads, responds to stories, keys and typed values', async ({ page }) => {
  const errors = errorsOf(page);
  await page.goto('/chart/nvda');
  await expect(page.getByRole('heading', { level: 1, name: 'NVIDIA' })).toBeVisible();
  const reading = page.getByLabel('Reading').first();
  await expect(reading).toContainText('Your value');

  const growth = page.getByLabel('Revenue growth, years 1–5, exact value');
  await expect(growth).toHaveValue('30.0');

  // Keyboard: the chart is a focusable control; arrows move the bearing.
  const chart = page.getByRole('group', { name: 'Value chart for NVIDIA' });
  await chart.focus();
  await page.keyboard.press('ArrowRight');
  await expect(growth).toHaveValue('30.5');

  // Typed entry commits on Enter and updates the reading.
  const before = await page.locator('dl[aria-label="Reading"] dd').first().innerText();
  await growth.fill('12');
  await growth.press('Enter');
  await expect(growth).toHaveValue('12.0');
  await expect(page.locator('dl[aria-label="Reading"] dd').first()).not.toHaveText(before);

  // Stories set the bearing.
  await page.getByRole('radio', { name: 'Breakout' }).click();
  await expect(page.getByRole('radio', { name: 'Breakout' })).toHaveAttribute('aria-checked', 'true');
  await expect(growth).not.toHaveValue('12.0');

  // The sea level is editable.
  const price = page.getByLabel('Sea level · share price');
  await price.fill('150');
  await price.press('Enter');
  await expect(page.getByRole('button', { name: /Back to \$228\.38/ })).toBeVisible();
  expect(errors).toEqual([]);
});

test('relief chart renders where WebGL is allowed', async ({ page }) => {
  const errors = errorsOf(page);
  // Software GL normally falls back to the flat chart; force the relief on.
  await page.addInitScript(() => window.localStorage.setItem('plimsoll:gl', '"force"'));
  await page.goto('/chart/nvda');
  await expect(page.locator('canvas[data-visible="true"]')).toHaveCount(1, { timeout: 20_000 });
  await expect(page.getByRole('group', { name: 'Value chart for NVIDIA' })).toBeVisible();
  expect(errors).toEqual([]);
});

test('share link and chart image', async ({ page }) => {
  await page.goto('/chart/ko');
  await page.getByRole('button', { name: 'Copy link' }).click();
  await expect(page.getByRole('status').filter({ hasText: /Link copied|Copy the link below/ })).toBeVisible();
  await expect(page).toHaveURL(/\?s=[A-Za-z0-9_-]{70}/);
  // Where the clipboard is refused, the link is offered as selectable text instead.
  const field = page.getByLabel('Link to this chart');
  if (await field.count()) await expect(field.first()).toHaveValue(/\/chart\/ko\?s=[A-Za-z0-9_-]{70}$/);
  await page.getByRole('button', { name: 'Chart image' }).click();
  await expect(page.getByRole('img', { name: /Chart of Coca-Cola/ })).toBeVisible();
});

test('a shared link reproduces the chart', async ({ page }) => {
  await page.goto('/chart/meta');
  const growth = page.getByLabel('Revenue growth, years 1–5, exact value');
  await growth.fill('9');
  await growth.press('Enter');
  await expect(growth).toHaveValue('9.0');
  await page.getByRole('button', { name: 'Copy link' }).click();
  await expect(page).toHaveURL(/\?s=[A-Za-z0-9_-]{70}/);
  const url = page.url();
  await page.evaluate(() => localStorage.clear());
  await page.goto(url);
  await expect(page.getByLabel('Revenue growth, years 1–5, exact value')).toHaveValue('9.0');
});

test('command palette finds a company', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await page.keyboard.press('Control+k');
  const box = page.getByRole('dialog', { name: 'Chart a company' }).getByRole('combobox', { name: 'Company or ticker' });
  await expect(box).toBeFocused();
  await box.fill('cost');
  await box.press('Enter');
  await expect(page).toHaveURL(/\/chart\/cost$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Costco' })).toBeVisible();
});

test('survey your own company', async ({ page }) => {
  await page.goto('/survey');
  await page.getByRole('button', { name: /Draw the chart/ }).click();
  await expect(page).toHaveURL(/\/chart\/custom$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Harbour Coffee Roasters');
});

test('atlas lists every company and 404 is charted', async ({ page }) => {
  await page.goto('/atlas');
  await expect(page.locator('main ul[role="list"] > li')).toHaveCount(13);
  await page.goto('/no-such-place');
  await expect(page.getByRole('heading', { name: 'Here be dragons.' })).toBeVisible();
});

test('theme switch persists', async ({ page, isMobile }) => {
  await page.goto('/');
  if (isMobile) {
    // On phones the theme control lives in the menu sheet.
    await page.getByRole('button', { name: 'Menu' }).click();
    await page.getByRole('radio', { name: 'Night watch' }).click();
  } else {
    await page.getByRole('radio', { name: 'Night' }).click();
  }
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
});

test('reduced motion opens the flat chart', async ({ browser }) => {
  const context = await browser.newContext({ reducedMotion: 'reduce' });
  const page = await context.newPage();
  await page.goto('http://localhost:4173/chart/aapl');
  await page.waitForSelector('html[data-hydrated]', { state: 'attached' });
  await expect(page.getByRole('group', { name: 'Value chart for Apple' })).toHaveAttribute('data-mode', '2d');
  await context.close();
});

for (const path of ['/', '/chart/nvda', '/atlas', '/method', '/survey', '/nowhere']) {
  test(`no WCAG A/AA violations on ${path}`, async ({ page }) => {
    await page.goto(path);
    await page.waitForTimeout(800);
    const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
    const summary = results.violations.map(
      (v) => `${v.id}: ${v.help} at ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`,
    );
    expect(summary).toEqual([]);
  });
}
