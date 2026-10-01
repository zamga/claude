/**
 * Render the Open Graph card (1200×630) and the touch icon (180×180) from
 * the live site, so social previews always match the current design.
 *
 *   npm run build:fast && npx vite preview --port 4173 &
 *   node scripts/social-images.mjs
 */
import { chromium } from '@playwright/test';

const base = process.env.BASE_URL ?? 'http://localhost:4173';
const browser = await chromium.launch({
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});

// Open Graph card: the hero, with relief forced on for headless rendering.
const og = await browser.newContext({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
await og.addInitScript(() => localStorage.setItem('plimsoll:gl', '"force"'));
const page = await og.newPage();
await page.goto(`${base}/`);
await page.waitForSelector('html[data-hydrated]', { state: 'attached' });
await page.addStyleTag({ content: 'header{display:none!important} main{padding-top:0!important}' });
await page.waitForTimeout(4500);
await page.screenshot({ path: 'public/og.png', clip: { x: 0, y: 0, width: 1200, height: 630 } });

// Touch icon: the Plimsoll mark on chart paper.
const icon = await browser.newContext({ viewport: { width: 180, height: 180 }, deviceScaleFactor: 1 });
const ip = await icon.newPage();
await ip.setContent(`<body style="margin:0;display:grid;place-items:center;width:180px;height:180px;background:#f3f5f1">
  <svg viewBox="0 0 32 32" width="120" height="120"><circle cx="16" cy="16" r="10.5" fill="none" stroke="#0d1b26" stroke-width="2.2"/><line x1="1.5" y1="16" x2="30.5" y2="16" stroke="#0d1b26" stroke-width="2.2"/></svg></body>`);
await ip.screenshot({ path: 'public/apple-touch-icon.png' });

await browser.close();
console.log('Wrote public/og.png and public/apple-touch-icon.png');
