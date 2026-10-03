import type { Page } from '@playwright/test';
import { expect, setNetwork, signIn, test } from './fixtures';

async function fillPriceAlert(page: Page, threshold: string) {
  await page.goto('/alerts/new?instrument=NVDA');
  await expect(page.getByRole('heading', { level: 1, name: 'Stay informed.' })).toBeVisible();
  await page.getByLabel('Threshold price').fill(threshold);
}

test.describe('alerts', () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page, '/watchlist');
  });

  test('an identical rule is refused with a link to the existing one', async ({ page }) => {
    // Same company, condition, threshold, repeat and channels as the seeded AMD rule.
    await page.goto('/alerts/new?instrument=AMD');
    await page.getByLabel('Condition').selectOption('cross_below');
    await page.getByLabel('Threshold price').fill('150.00');
    await page.getByLabel('Repeat').selectOption('repeating');
    await page.getByRole('button', { name: 'Create alert' }).click();
    await expect(page.getByText('You already have this alert.', { exact: false })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Open the existing alert' })).toBeVisible();
  });

  test('preview explains a threshold that is already beyond, then creates exactly one rule', async ({
    page,
  }) => {
    await fillPriceAlert(page, '120.00');
    await page.getByRole('button', { name: 'Create alert' }).click();
    const sheet = page.getByRole('dialog', { name: 'Confirm this alert' });
    await expect(sheet).toBeVisible();
    await expect(sheet.getByText(/already above \$120\.00/)).toBeVisible();
    // A double press submits once.
    await sheet.getByRole('button', { name: 'Create alert' }).dblclick();
    await expect(page.getByText('Alert created: NVDA rises above $120.00, once')).toBeVisible();
    await page.goto('/alerts');
    await expect(page.getByRole('link', { name: /NVDA rises above \$120\.00/ })).toHaveCount(1);
  });

  test('a save whose reply is lost can be retried without a duplicate', async ({ page }) => {
    await page.goto('/watchlist');
    await setNetwork(page, { nextWrite: 'lose-response' });
    await fillPriceAlert(page, '175.00');
    await page.getByRole('button', { name: 'Create alert' }).click();
    await page
      .getByRole('dialog', { name: 'Confirm this alert' })
      .getByRole('button', { name: 'Create alert' })
      .click();
    await expect(
      page.getByText('The connection dropped before we heard back', { exact: false }),
    ).toBeVisible();
    await page.getByRole('button', { name: 'Check and try again' }).click();
    await expect(page.getByText('Alert created: NVDA rises above $175.00, once')).toBeVisible();
    await page.goto('/alerts');
    await expect(page.getByRole('link', { name: /NVDA rises above \$175\.00/ })).toHaveCount(1);
  });

  test('opening an inbox item reads it and leads to its exact context', async ({ page }) => {
    await page.goto('/watchlist/alerts');
    const item = page.getByRole('button', { name: /Unread\. NVDA rose above \$140\.00/ });
    await expect(item).toBeVisible();
    await item.click();
    await expect(page).toHaveURL(/\/stocks\/NVDA/);
    await page.goto('/watchlist/alerts');
    await expect(page.getByRole('button', { name: /^NVDA rose above \$140\.00/ })).toBeVisible();
  });
});
