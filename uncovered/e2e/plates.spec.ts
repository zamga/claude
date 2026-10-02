import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

/*
 * The photographs: "Look closer", the film from the whole cover to the source
 * printed under one figure, and its contact sheet; the cover under
 * ultraviolet; the lamp resting on a figure from the first paint; and the
 * cards shown where a page is shared.
 */

const FILM = 'section[aria-labelledby="closer-title"]';

function watchErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  return errors;
}

/** Scroll to a point (0 to 1) of the film's own scroll. */
async function scrollFilm(page: Page, progress: number) {
  await page.evaluate(
    ({ selector, progress }) => {
      const track = document.querySelector(selector)!.firstElementChild!;
      const r = track.getBoundingClientRect();
      window.scrollTo({
        top: window.scrollY + r.top + (r.height - window.innerHeight) * progress,
        behavior: 'instant',
      });
    },
    { selector: FILM, progress },
  );
}

test('look closer follows the scroll from the cover to the source printed under a figure', async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto('/');
  // Nothing of the film is fetched until the reader's first scroll.
  await page.mouse.wheel(0, 40);
  const film = page.locator(`${FILM}[data-beat]`);
  await expect(film).toHaveAttribute('data-beat', '0');
  await scrollFilm(page, 0.05);
  await expect(film.locator('canvas')).toHaveAttribute('data-ready', '');
  await expect(film.getByRole('heading', { name: 'Look closer.' })).toBeVisible();
  await scrollFilm(page, 0.53);
  await expect(film).toHaveAttribute('data-beat', '1');
  await scrollFilm(page, 0.96);
  await expect(film).toHaveAttribute('data-beat', '2');
  await expect(film.getByText('Reported · Krka, d. d. · March 2026', { exact: true })).toBeVisible();
  const results = await new AxeBuilder({ page })
    .include(FILM)
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze();
  expect(results.violations.map((v) => v.id)).toEqual([]);
  await film.getByRole('link', { name: 'Open source 1 in the report' }).click();
  await expect(page).toHaveURL(/\/report\/krka#src-r25$/);
  expect(errors).toEqual([]);
});

test('with reduced motion, look closer is a contact sheet of the same three photographs', async ({ browser }) => {
  const context = await browser.newContext({ reducedMotion: 'reduce', viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  await page.goto('/');
  await page.mouse.wheel(0, 40);
  const sheet = page.locator(FILM);
  await sheet.scrollIntoViewIfNeeded();
  await expect(sheet.locator('canvas')).toHaveCount(0);
  const photos = sheet.getByRole('img');
  await expect(photos).toHaveCount(3);
  await expect
    .poll(() => photos.evaluateAll((imgs) => imgs.every((i) => (i as HTMLImageElement).naturalWidth > 0)))
    .toBe(true);
  await context.close();
});

test('before any script runs, the lamp rests on a figure and its source reads', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto('/');
  const row = page.locator('article[data-inspect] [data-rest]');
  await expect(row).toContainText('Revenue 2025');
  const legible = row.getByText('Reported · Krka, d. d. · Mar 2026', { exact: true });
  expect(await legible.evaluate((el) => getComputedStyle(el).maskImage)).toBe('none');
  // A page without scripts keeps the contact sheet, photographs and all.
  await expect(page.locator(`${FILM} img`)).toHaveCount(3);
  await context.close();
});

test('the photograph under ultraviolet offers the page the same lamp', async ({ page }) => {
  await page.goto('/');
  const on = page.getByRole('button', { name: 'Switch the page to UV' });
  await on.scrollIntoViewIfNeeded();
  await on.click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.getByRole('button', { name: 'Back to daylight' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
});

test('every page names a photograph to show where its address is shared', async ({ page, request }) => {
  for (const path of ['/', '/report/krka', '/initiate', '/method']) {
    await page.goto(path);
    const image = await page.locator('meta[property="og:image"]').getAttribute('content');
    expect(image).toMatch(/^\/social\/[a-z-]+\.jpg$/);
    const response = await request.get(image!);
    expect(response.status()).toBe(200);
    expect(response.headers()['content-type']).toContain('image/jpeg');
    await expect(page.locator('meta[name="twitter:card"]')).toHaveAttribute('content', 'summary_large_image');
    await expect(page.locator('meta[property="og:image:alt"]')).toHaveAttribute('content', /.+/);
  }
});
