import { expect, signIn, test } from './fixtures';

test('a paper buy is previewed, saved once and reflected in the position', async ({ page }) => {
  await signIn(page, '/portfolio');
  await page.goto('/paper/transactions/new?instrument=NVDA');
  await expect(
    page.getByRole('heading', { level: 1, name: 'Record a paper trade.' }),
  ).toBeVisible();
  await page.getByLabel('Quantity').fill('10');
  await expect(page.getByText('Shares after')).toBeVisible();
  await expect(page.getByText('160', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Save paper buy' }).click();
  await expect(page.getByText(/You now hold 160\./)).toBeVisible();
  await page.goto('/portfolio/NVDA');
  await expect(page.getByText('Bought 10 NVDA at $142.80')).toBeVisible();
});

test('selling more than you hold is explained, not attempted', async ({ page }) => {
  await signIn(page, '/portfolio');
  await page.goto('/paper/transactions/new?instrument=MSFT&side=sell');
  await page.getByLabel('Quantity').fill('999');
  await page.getByRole('button', { name: 'Save paper sale' }).click();
  await expect(page.getByText('You hold 40 units in this paper position.')).toBeVisible();
});
