import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { ENGINE_PORT, SITE_PORT } from '../playwright.config';

/*
 * The engine, end to end, through the scripted test engine: a request runs
 * live on the request page and becomes a checked report that renders as a
 * document of its own.
 */

test.use({ baseURL: `http://127.0.0.1:${ENGINE_PORT}` });

async function axe(page: Page) {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze();
  return results.violations.map((v) => ({ id: v.id, nodes: v.nodes.slice(0, 5).map((n) => n.target.join(' ')) }));
}

async function startRun(page: Page): Promise<string> {
  await page.goto('/initiate');
  await expect(page.getByRole('note')).toContainText('Test engine');
  await page.getByRole('textbox', { name: 'Company', exact: true }).fill('Primer d.o.o.');
  await page.getByRole('radio', { name: 'Credit' }).check();
  await page.getByLabel('What should the report answer?').fill('Could the company take on more bank debt?');
  await page.getByRole('button', { name: 'Initiate coverage' }).click();
  await expect(page).toHaveURL(/\/initiate\?run=/);
  return new URL(page.url()).searchParams.get('run')!;
}

test('a request runs live and becomes a checked report', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await startRun(page);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Primer d.o.o.');
  // The run reports its stages and counts its evidence as it goes.
  await expect(page.getByRole('heading', { name: 'The initiation is ready.' })).toBeVisible({ timeout: 30_000 });
  await expect(page.locator('dl[aria-label="Evidence so far"]')).toContainText('Passages verified9');
  await expect(page.getByText('Checked the draft: 1 problem sent back')).toBeVisible();
  expect(await page.locator('li[data-state="done"]').count()).toBeGreaterThanOrEqual(6);

  await page.getByRole('link', { name: 'Read the initiation' }).click();
  await expect(page).toHaveURL(/\/report\/primer-/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Primer d.o.o.');
  // A private company is valued as a whole, and the report says the run was a scripted test.
  await expect(page.getByRole('heading', { name: 'What the value implies' })).toBeVisible();
  await expect(page.getByText(/fictional company made for testing/)).toBeVisible();
  // Every model figure is filled.
  for (const bound of await page.locator('.bound').allTextContents()) expect(bound).not.toBe('—');
  expect(errors).toEqual([]);
});

test('a run’s address picks the run up again', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  const id = await startRun(page);
  // Opened again while it runs, the page shows the run as it stands and follows it to the end.
  await page.goto(`/initiate?run=${id}`);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Primer d.o.o.');
  await expect(page.getByRole('heading', { name: 'The initiation is ready.' })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText('Checked the draft: 1 problem sent back')).toBeVisible();
  await page.goto(`/initiate?run=${id}`);
  await expect(page.getByRole('heading', { name: 'The initiation is ready.' })).toBeVisible();
  await expect(page.getByText('Covered', { exact: true }).first()).toBeVisible();
  // The server rendered the slip, so the page hydrated without a mismatch.
  expect(errors).toEqual([]);
});

test('an engine report is a document: it reads without JavaScript', async ({ page, browser }) => {
  const id = await startRun(page);
  await expect(page.getByRole('heading', { name: 'The initiation is ready.' })).toBeVisible({ timeout: 30_000 });
  const context = await browser.newContext({ javaScriptEnabled: false });
  const plain = await context.newPage();
  const res = await plain.goto(`http://127.0.0.1:${ENGINE_PORT}/report/${id}`);
  expect(res?.status()).toBe(200);
  await expect(plain).toHaveTitle('Primer d.o.o.: initiation of coverage · Uncovered');
  await expect(plain.getByRole('heading', { level: 1 })).toHaveText('Primer d.o.o.');
  await expect(plain.locator('#sources li[id^="src-"]').first()).toBeVisible();
  // So is the run that wrote it.
  await plain.goto(`http://127.0.0.1:${ENGINE_PORT}/initiate?run=${id}`);
  await expect(plain.getByRole('heading', { name: 'The initiation is ready.' })).toBeVisible();
  await expect(plain.locator('dl[aria-label="Evidence so far"]')).toContainText('Passages verified9');
  await context.close();
});

test('the request page says whether the engine runs before any script does', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const plain = await context.newPage();
  // The server renders the page for its own engine; a static host serves the build, which has none.
  await plain.goto(`http://127.0.0.1:${ENGINE_PORT}/initiate`);
  await expect(plain.getByRole('note')).toContainText('Test engine.');
  await expect(plain.getByRole('button', { name: 'Initiate coverage' })).toBeVisible();
  await plain.goto(`http://localhost:${SITE_PORT}/initiate`);
  await expect(plain.getByRole('note')).toContainText('Preview.');
  await expect(plain.getByRole('button', { name: 'See the research plan' })).toBeVisible();
  await context.close();
});

test('the live slip and an engine report have no WCAG 2.2 AA violations', async ({ page }) => {
  await startRun(page);
  await expect(page.getByRole('heading', { name: 'The initiation is ready.' })).toBeVisible({ timeout: 30_000 });
  await page.waitForTimeout(2500);
  expect(await axe(page)).toEqual([]);
  await page.getByRole('link', { name: 'Read the initiation' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Primer d.o.o.');
  await page.waitForTimeout(1500);
  expect(await axe(page)).toEqual([]);
});

test('an unknown run says so', async ({ page }) => {
  await page.goto('/initiate?run=nothing-here');
  await expect(page.getByRole('heading', { name: 'No such request' })).toBeVisible();
});
