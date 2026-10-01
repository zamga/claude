import { chromium, devices } from '@playwright/test';
const out = process.argv[2];
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const logs = [];
for (const [name, opts] of [['desk', { viewport: { width: 1440, height: 900 } }], ['phone', devices['Pixel 7']], ['uv', { viewport: { width: 1440, height: 900 }, colorScheme: 'dark' }]]) {
  const page = await browser.newPage(opts);
  page.on('pageerror', (e) => logs.push(`${name}: ${String(e)}`));
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') logs.push(`${name} ${m.type()}: ${m.text().slice(0, 300)}`); });
  await page.goto('http://localhost:4173/', { waitUntil: 'networkidle' });
  const fig = page.locator('figure').filter({ hasText: 'The value landscape' }).first();
  await fig.evaluate((el) => el.scrollIntoView({ block: 'center' }));
  await page.waitForTimeout(3200);
  await page.screenshot({ path: `${out}/${name}-landscape.png` });
  if (name === 'desk') {
    const slider = page.getByRole('slider', { name: /Cost of capital/ });
    await slider.focus();
    for (let i = 0; i < 18; i++) await page.keyboard.press('ArrowRight');
    const g = page.getByRole('slider', { name: /Terminal growth/ });
    await g.focus();
    for (let i = 0; i < 10; i++) await page.keyboard.press('ArrowLeft');
    await page.waitForTimeout(900);
    await page.screenshot({ path: `${out}/${name}-landscape-moved.png` });
    const stage = page.locator('[role="img"][aria-label^="The value landscape"]');
    const box = await stage.boundingBox();
    await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.5);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width * 0.5 + 180, box.y + box.height * 0.5 - 60, { steps: 10 });
    await page.mouse.up();
    await page.waitForTimeout(500);
    await page.screenshot({ path: `${out}/${name}-landscape-turned.png` });
  }
  await page.close();
}
await browser.close();
console.log(logs.length ? logs.join('\n') : 'no console errors');
