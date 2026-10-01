import { chromium, devices } from '@playwright/test';
const out = process.argv[2];
const base = 'http://localhost:4173';
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const logs = [];
async function shot(name, ctxOpts, fn) {
  const context = await browser.newContext(ctxOpts);
  const page = await context.newPage();
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') logs.push(`${name} ${m.type()}: ${m.text().slice(0, 200)}`); });
  page.on('pageerror', (e) => logs.push(`${name} pageerror: ${String(e).slice(0, 200)}`));
  await fn(page);
  await context.close();
}
await shot('desk', { viewport: { width: 1440, height: 900 } }, async (page) => {
  await page.goto(base + '/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(700);
  await page.screenshot({ path: `${out}/desk-0700ms.png` });
  await page.waitForSelector('article[data-gl="on"]', { timeout: 8000 }).catch(() => logs.push('desk: no data-gl'));
  await page.waitForTimeout(4200);
  await page.screenshot({ path: `${out}/desk-idle.png` });
  const cover = page.locator('article[data-inspect]').first();
  const box = await cover.boundingBox();
  await page.mouse.move(box.x + box.width * 0.3, box.y + box.height * 0.57, { steps: 12 });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: `${out}/desk-held-watermark.png` });
  await page.mouse.move(box.x + box.width * 0.72, box.y + box.height * 0.74, { steps: 12 });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: `${out}/desk-held-keydata.png` });
  await page.mouse.move(10, 10);
  await page.getByRole('textbox', { name: 'Company' }).fill('Pipistrel d.o.o.');
  await page.waitForTimeout(1800);
  await page.screenshot({ path: `${out}/desk-typed.png` });
  await page.getByRole('textbox', { name: 'Company' }).fill('Kolektor Group d.o.o.');
  await page.waitForTimeout(1800);
  await page.screenshot({ path: `${out}/desk-typed-long.png` });
});
await shot('phone', devices['Pixel 7'], async (page) => {
  await page.goto(base + '/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(3500);
  await page.screenshot({ path: `${out}/phone-top.png` });
});
await browser.close();
console.log(logs.length ? logs.join('\n') : 'no console errors');
