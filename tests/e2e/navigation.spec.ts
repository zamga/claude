import { expect, isPhone, test } from './fixtures';

test.describe('navigation contract', () => {
  test('a deep link goes Back to its structural parent', async ({ page }) => {
    await page.goto('/stocks/MSFT');
    await expect(page.getByRole('heading', { level: 1, name: 'MSFT' })).toBeVisible();
    await page.getByRole('button', { name: 'Back' }).first().click();
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole('heading', { level: 1 }).first()).toContainText('Today’s');
  });

  test('Back from a pick restores the list scroll position', async ({ page }) => {
    test.skip(!isPhone(page), 'single-column scroll restoration is a phone behaviour');
    await page.goto('/');
    await expect(page.getByRole('list', { name: 'More picks today' })).toBeVisible();
    await page.mouse.wheel(0, 700);
    await page.waitForTimeout(300);
    const before = await page.evaluate(() => window.scrollY);
    expect(before).toBeGreaterThan(200);
    await page.getByRole('list', { name: 'More picks today' }).getByRole('link').first().click();
    await expect(page).toHaveURL(/\/stocks\//);
    await page.getByRole('button', { name: 'Back' }).first().click();
    await expect(page).toHaveURL(/\/$/);
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(before - 40);
  });

  test('Back returns focus to the row that opened the detail', async ({ page }) => {
    await page.goto('/');
    const row = page.getByRole('list', { name: 'More picks today' }).getByRole('link').first();
    await expect(row).toBeVisible();
    await row.focus();
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/\/stocks\//);
    await page.goBack();
    await expect(page).toHaveURL(/\/$/);
    await expect(row).toBeFocused();
  });

  test('each tab keeps its own place', async ({ page }) => {
    test.skip(!isPhone(page), 'the tab bar is the phone navigation');
    await page.goto('/');
    await page.getByRole('link', { name: /The market/ }).click();
    await expect(page).toHaveURL(/\/market$/);
    await page
      .getByRole('navigation', { name: 'Primary' })
      .getByRole('link', { name: 'Research' })
      .click();
    await expect(page).toHaveURL(/\/research/);
    await page
      .getByRole('navigation', { name: 'Primary' })
      .getByRole('link', { name: 'Picks' })
      .click();
    await expect(page).toHaveURL(/\/market$/);
  });

  test('unknown routes show the 404 with a way back', async ({ page }) => {
    await page.goto('/this/does/not/exist');
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Not');
    await page.getByRole('button', { name: /Today’s picks/ }).click();
    await expect(page).toHaveURL(/\/$/);
  });
});
