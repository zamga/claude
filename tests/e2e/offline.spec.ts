import { expect, test } from './fixtures';

test('offline labels cached data and recovers when the connection returns', async ({
  page,
  context,
}) => {
  await page.goto('/stocks/NVDA');
  await expect(page.getByText(/as of 14:25 ET/).first()).toBeVisible();
  await context.setOffline(true);
  await page.getByRole('radio', { name: '1W' }).click();
  // The screen labels its quote and chart as a saved copy; the app-wide banner says why.
  await expect(page.getByText('Offline · updates paused')).toBeVisible();
  await expect(page.getByRole('status').filter({ hasText: 'You’re offline.' })).toBeVisible();
  await expect(page.getByRole('heading', { name: /Reconnect/ })).toBeVisible();
  // Retrying while still offline keeps the cached labels instead of pretending to refresh.
  await page.getByRole('main').getByRole('button', { name: 'Try again' }).click();
  await expect(page.getByText('Offline · updates paused')).toBeVisible();
  // Reconnecting refreshes automatically and clears every offline label together.
  await context.setOffline(false);
  await expect(page.getByText('Offline · updates paused')).toHaveCount(0);
  await expect(page.getByRole('status').filter({ hasText: 'You’re offline.' })).toHaveCount(0);
  await expect(page.getByText(/as of 14:25 ET/).first()).toBeVisible();
});
