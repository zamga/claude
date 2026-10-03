import { expect, isPhone, test } from './fixtures';

test.describe('chart contract', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/stocks/NVDA');
    await expect(page.getByRole('slider', { name: /NVDA price chart/ })).toBeVisible();
  });

  test('keyboard inspects, Enter pins, Escape returns to the latest quote', async ({ page }) => {
    const chart = page.getByRole('slider', { name: /NVDA price chart/ });
    const latest = await chart.getAttribute('aria-valuetext');
    expect(latest).toMatch(/^Showing latest/);
    await chart.focus();
    await page.keyboard.press('ArrowLeft');
    await page.keyboard.press('ArrowLeft');
    await expect(page.getByText(/^Inspecting · /)).toBeVisible();
    await expect(chart).toHaveAttribute('aria-valuetext', /\d{2}:\d{2} ET: \$/);
    await page.keyboard.press('Enter');
    await expect(page.getByText(/^Pinned · /)).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByText(/^Pinned · /)).toHaveCount(0);
    await expect(page.getByText(/^Inspecting · /)).toHaveCount(0);
  });

  test('a tap or click pins the nearest observation; the hero says so', async ({ page }) => {
    const chart = page.getByRole('slider', { name: /NVDA price chart/ });
    const box = (await chart.boundingBox())!;
    if (isPhone(page)) {
      await chart.tap({ position: { x: box.width * 0.4, y: box.height / 2 } });
    } else {
      await chart.click({ position: { x: box.width * 0.4, y: box.height / 2 } });
    }
    await expect(page.getByText(/^Pinned · /)).toBeVisible();
    // The pinned label describes the same sample as the accessible value.
    const valuetext = await chart.getAttribute('aria-valuetext');
    const pinned = await page.getByText(/^Pinned · /).textContent();
    expect(valuetext).toContain(pinned!.replace('Pinned · ', ''));
  });

  test('range changes keep the chart and status coherent', async ({ page }) => {
    await page.getByRole('radio', { name: '1M' }).click();
    await expect(page.getByRole('slider', { name: /NVDA price chart, 1M/ })).toBeVisible();
    await expect(page.getByRole('radio', { name: '1M' })).toHaveAttribute('aria-checked', 'true');
  });

  test('the data table offers the same values', async ({ page }) => {
    await page.getByRole('button', { name: 'Show data table' }).first().click();
    const table = page.getByRole('region', { name: /price data table/ }).first();
    await expect(table.getByRole('row').nth(1)).toBeVisible();
  });
});
