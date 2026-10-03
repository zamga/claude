import { expect, test } from './fixtures';

test('register, verify through the demo mailbox, choose preferences and resume', async ({
  page,
}) => {
  const email = `e2e-${Date.now()}@example.com`;
  await page.goto('/auth/register?returnTo=%2Fwatchlist');
  await page.getByLabel('Name').fill('E2E Reader');
  await page.getByLabel('Email address').fill(email);
  await page.getByLabel('Password', { exact: true }).fill('correct horse battery');
  await page.getByLabel('Confirm password').fill('correct horse battery');
  await page.getByText('I accept the account terms and privacy notice').click();
  await page.getByRole('button', { name: /^Create account/ }).click();
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Check your');
  await expect(page.getByRole('button', { name: /Resend in \d+ s/ })).toBeVisible();
  await page.getByRole('button', { name: 'Verify email' }).first().click();
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Email');
  await page.getByRole('button', { name: /^Continue/ }).click();
  await expect(page).toHaveURL(/\/onboarding/);
  await page.getByRole('radio', { name: 'Months' }).click();
  await page.getByRole('button', { name: /^Continue/ }).click();
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Stay in');
  await page.getByRole('button', { name: /start reading/i }).click();
  await expect(page).toHaveURL(/\/watchlist/);
  // S25: a new account's watchlist explains first use and offers both ways in.
  await expect(page.getByRole('button', { name: 'Explore today’s picks' })).toBeVisible();
  await page.getByRole('button', { name: 'Search for a company' }).click();
  await expect(page).toHaveURL(/\/search/);
});

test('a wrong password keeps the email and clears the password', async ({ page }) => {
  await page.goto('/auth/sign-in');
  await page.getByLabel('Email address').fill('alex@example.com');
  await page.getByLabel('Password', { exact: true }).fill('not-the-password');
  await page.getByRole('button', { name: /^Sign in/ }).click();
  await expect(
    page.getByText('That email and password combination is not recognised.'),
  ).toBeVisible();
  await expect(page.getByLabel('Email address')).toHaveValue('alex@example.com');
  await expect(page.getByLabel('Password', { exact: true })).toHaveValue('');
});
