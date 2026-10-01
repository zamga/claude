import { chromium, devices } from '@playwright/test';
const out = process.argv[2];
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const logs = [];
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
page.on('pageerror', (e) => logs.push(`pageerror: ${String(e)}`));
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') logs.push(`${m.type()}: ${m.text().slice(0, 300)}`); });
await page.goto('http://localhost:4173/', { waitUntil: 'networkidle' });
await page.waitForTimeout(2500);
console.log('lenis on:', await page.evaluate(() => document.documentElement.classList.contains('lenis')));
// Scroll down with the wheel through the anatomy section, screenshot mid-deal and dealt.
const anatomy = page.locator('section[aria-labelledby="anatomy-title"]');
const top = await anatomy.evaluate((el) => el.getBoundingClientRect().top + window.scrollY);
await page.evaluate((y) => window.scrollTo(0, y - 900), top);
await page.waitForTimeout(800);
for (let i = 0; i < 4; i++) { await page.mouse.wheel(0, 120); await page.waitForTimeout(120); }
await page.waitForTimeout(700);
await page.screenshot({ path: `${out}/anatomy-mid.png` });
for (let i = 0; i < 8; i++) { await page.mouse.wheel(0, 120); await page.waitForTimeout(120); }
await page.waitForTimeout(1200);
await page.screenshot({ path: `${out}/anatomy-dealt.png` });
const register = page.locator('section[aria-labelledby="register-title"]');
await register.evaluate((el) => el.scrollIntoView({ block: 'start' }));
await page.waitForTimeout(1500);
const card = page.getByRole('link', { name: /Pipistrel d.o.o.: not yet covered/ });
await card.hover();
await page.waitForTimeout(2200);
await page.screenshot({ path: `${out}/register.png` });
// Transition: back to top, follow the sample link.
await page.evaluate(() => window.scrollTo(0, 0));
await page.waitForTimeout(800);
await page.getByRole('link', { name: 'Krka, d. d., Novo mesto' }).first().click();
await page.waitForTimeout(250);
await page.screenshot({ path: `${out}/transition-mid.png` });
await page.waitForTimeout(1500);
await page.screenshot({ path: `${out}/transition-end.png` });
await browser.close();
console.log(logs.length ? logs.join('\n') : 'no console errors');
