import { chromium } from '@playwright/test';
const out = process.argv[2];
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto('http://localhost:4173/', { waitUntil: 'networkidle' });
await page.waitForTimeout(2500);
const list = page.locator('section[aria-labelledby="anatomy-title"] ol');
const top = await list.evaluate((el) => el.getBoundingClientRect().top + window.scrollY);
// The deal runs from the list's top at 88% of the viewport to 18%: stand at about 40% of the way.
await page.evaluate((y) => window.scrollTo(0, y - 900 * 0.6), top);
await page.waitForTimeout(1600);
await page.screenshot({ path: `${out}/anatomy-deal-40.png` });
const reg = page.locator('section[aria-labelledby="register-title"]');
await reg.evaluate((el) => el.scrollIntoView({ block: 'start' }));
await page.waitForTimeout(1500);
await page.screenshot({ path: `${out}/register2.png` });
await browser.close();
