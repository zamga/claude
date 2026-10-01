import { expect, test, type Page } from '@playwright/test';

/** Fail on any uncaught error or console error while a test runs. */
function watchErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  return errors;
}

test('the home page leads with the idea and the request form', async ({ page }, info) => {
  const errors = watchErrors(page);
  await page.goto('/');
  await expect(page).toHaveTitle(/Uncovered/);
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Initiating coverage');
  const company = page.getByRole('textbox', { name: 'Company', exact: true });
  await expect(company).toBeVisible();
  if (info.project.name === 'desktop') {
    // The primary action is above the fold on a laptop screen.
    const box = await page.getByRole('button', { name: 'Initiate coverage' }).first().boundingBox();
    expect(box!.y + box!.height).toBeLessThan(900);
  }
  await company.fill('Petrol d.d.');
  await expect(page.getByRole('article', { name: /Cover of the initiation report on Petrol/ })).toBeVisible();
  expect(errors).toEqual([]);
});

test('naming Krka opens the sample report', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('textbox', { name: 'Company', exact: true }).fill('Krka');
  await page.getByRole('button', { name: 'Initiate coverage' }).first().click();
  await expect(page).toHaveURL(/\/report\/krka$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Krka, d. d., Novo mesto');
  await expect(page.getByRole('heading', { level: 1 })).toBeFocused();
});

test('another company carries into the request and becomes a research plan', async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto('/');
  await page.getByRole('textbox', { name: 'Company', exact: true }).fill('Hidria d.o.o.');
  await page.getByRole('button', { name: 'Initiate coverage' }).first().click();
  await expect(page).toHaveURL(/\/initiate$/);
  await expect(page.locator('input[name="company"]')).toHaveValue('Hidria d.o.o.');

  await page.locator('input[name="website"]').fill('not a site');
  await page.getByRole('button', { name: 'See the research plan' }).click();
  await expect(page.getByText('Enter a web address')).toBeVisible();
  await expect(page.locator('input[name="website"]')).toBeFocused();

  await page.locator('input[name="website"]').fill('hidria.com');
  await page.getByRole('radio', { name: 'Credit' }).check();
  await page.getByRole('button', { name: 'See the research plan' }).click();
  const slip = page.getByRole('article', { name: 'Hidria d.o.o.' });
  await expect(slip).toBeVisible();
  await expect(slip.getByRole('heading', { level: 1 })).toBeFocused();
  await expect(slip.getByText('Needs you')).toBeVisible();
  await expect(slip.getByText(/credit view/)).toBeVisible();
  await expect(slip.getByText(/nothing has been sent or stored/i)).toBeVisible();
  expect(errors).toEqual([]);
});

test('the report opens at an anchor and its contents follow the reader', async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto('/report/krka#valuation');
  const section = page.locator('#valuation');
  // Measured from layout, which needs no painted frame: under heavy parallel load the
  // headless compositor can pause, which stalls frame-based checks without the page being wrong.
  await expect.poll(() => section.evaluate((el) => Math.round(el.getBoundingClientRect().top))).toBeLessThan(200);
  await expect(section).toBeFocused();
  await expect(page.locator('a[aria-current="location"]').filter({ visible: true })).toContainText('Valuation');
  expect(errors).toEqual([]);
});

test('every model figure is filled and every note resolves', async ({ page }) => {
  await page.goto('/report/krka');
  await expect(page.locator('.bound').first()).toBeVisible();
  await expect(page.locator('.bound', { hasText: '—' })).toHaveCount(0);
  const notes = await page.locator('sup.fn a').evaluateAll((as) => as.map((a) => a.getAttribute('aria-label')));
  expect(notes.length).toBeGreaterThan(40);
  for (const label of notes) expect(label).toMatch(/^Source \d+: /);
});

test('a note shows its source beside the text, or under it on a phone', async ({ page }, info) => {
  await page.goto('/report/krka');
  const note = page.locator('#summary sup.fn a').first();
  await note.scrollIntoViewIfNeeded();
  if (info.project.name === 'phone') {
    await note.tap();
    const card = page.locator('[id^="note-"]').first();
    await expect(card).toBeVisible();
    await expect(card).toContainText('Krka releases 2025 unaudited financial statements');
    await card.getByRole('button', { name: 'Close source' }).tap();
    await expect(page.locator('[id^="note-"]')).toHaveCount(0);
  } else {
    await note.hover();
    const rail = page.getByRole('complementary', { name: 'Source' });
    await expect(rail).toContainText('Krka releases 2025 unaudited financial statements');
    await expect(rail).toContainText(/Cited \d+ times in this report/);
  }
});

test('unknown addresses get a seal of their own', async ({ page }) => {
  const response = await page.goto('/no/such/page');
  expect(response?.ok()).toBe(true);
  await expect(page.getByRole('heading', { level: 1 })).toContainText('uncovered');
});

test('reduced motion shows everything at rest', async ({ browser }) => {
  const context = await browser.newContext({ reducedMotion: 'reduce', viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  await page.goto('/report/krka#valuation');
  const animated = await page.evaluate(
    () =>
      Array.from(document.querySelectorAll('*')).filter((el) => {
        const cs = getComputedStyle(el);
        return cs.animationName !== 'none' && parseFloat(cs.animationDuration) > 0.01;
      }).length,
  );
  expect(animated).toBe(0);
  await context.close();
});
