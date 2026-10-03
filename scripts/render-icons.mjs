/**
 * Renders PWA icons and the Open Graph image from the brand mark and the bundled fonts.
 * Usage: npm run icons   (uses Playwright's Chromium; set CHROMIUM_PATH to use another build)
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const favicon = readFileSync(resolve(root, 'public/favicon.svg'), 'utf8');
// Fonts are inlined as data URLs: pages created with setContent cannot load file:// resources.
const dataUrl = (file) =>
  `data:font/woff2;base64,${readFileSync(resolve(root, file)).toString('base64')}`;
const serif = dataUrl('public/fonts/freeserif-700-latin.woff2');
const sans = dataUrl('public/fonts/roboto-flex-400-700-latin.woff2');
const executablePath = process.env.CHROMIUM_PATH || undefined;

const fontFaces = `
  @font-face { font-family: 'FreeSerif'; src: url('${serif}') format('woff2'); font-weight: 700; }
  @font-face { font-family: 'Roboto Flex'; src: url('${sans}') format('woff2'); font-weight: 400 700; }
`;

function iconHtml(size, { maskable = false } = {}) {
  const inner = favicon.replace('<rect width="64" height="64" rx="12" fill="#F8F5ED"/>', '');
  const markSize = maskable ? size * 0.62 : size;
  return `<!doctype html><html><head><style>
    html, body { margin: 0; width: ${size}px; height: ${size}px; background: #F8F5ED; }
    .wrap { width: ${size}px; height: ${size}px; display: grid; place-items: center; }
    svg { width: ${markSize}px; height: ${markSize}px; }
  </style></head><body><div class="wrap">${inner.replace('<svg ', `<svg width="${markSize}" height="${markSize}" `)}</div></body></html>`;
}

const ogHtml = `<!doctype html><html><head><style>
  ${fontFaces}
  html, body { margin: 0; width: 1200px; height: 630px; background: #F8F5ED; color: #111613; }
  .page { position: relative; box-sizing: border-box; width: 1200px; height: 630px; padding: 72px 80px; display: grid; grid-template-columns: 1.1fr 0.9fr; gap: 48px; }
  .eyebrow { display: flex; align-items: center; gap: 16px; font: 600 18px/1 'Roboto Flex', sans-serif; letter-spacing: 0.18em; text-transform: uppercase; color: #BB321D; }
  .eyebrow::before { content: ''; width: 56px; height: 5px; background: #F3482D; }
  h1 { margin: 36px 0 0; font: 700 150px/0.82 FreeSerif, serif; letter-spacing: -0.045em; }
  p { margin: 32px 0 0; font: 400 26px/1.4 'Roboto Flex', sans-serif; color: #4e554d; max-width: 560px; }
  .card { align-self: center; background: #101512; color: #F4F1E8; border-radius: 20px; padding: 36px; }
  .card .t { font: 600 14px/1 'Roboto Flex', sans-serif; letter-spacing: 0.18em; text-transform: uppercase; color: #9AA199; }
  .card .k { margin-top: 14px; font: 700 76px/1 FreeSerif, serif; letter-spacing: -0.02em; }
  .card .q { margin-top: 10px; font: 700 40px/1 FreeSerif, serif; }
  .card .q span { margin-left: 14px; font: 500 24px 'Roboto Flex', sans-serif; color: #8EDDB0; }
  .card svg { margin-top: 26px; display: block; }
  .demo { position: absolute; right: 80px; bottom: 40px; font: 500 14px 'Roboto Flex', sans-serif; letter-spacing: 0.1em; text-transform: uppercase; color: #626960; }
</style></head><body><div class="page">
  <div>
    <div class="eyebrow">Daily selection</div>
    <h1>Stock<br/>picks.</h1>
    <p>Sourced ideas, valuation you can question, and every outcome on the record.</p>
  </div>
  <div class="card">
    <div class="t">Pick analysis</div>
    <div class="k">NVDA</div>
    <div class="q">$142.80<span>+2.34%</span></div>
    <svg width="380" height="120" viewBox="0 0 380 120"><defs><linearGradient id="g" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#8EDDB0" stop-opacity="0.35"/><stop offset="1" stop-color="#8EDDB0" stop-opacity="0"/></linearGradient></defs>
      <path d="M0 96 L30 88 L58 92 L86 74 L112 80 L140 62 L168 54 L196 60 L224 46 L252 52 L280 34 L308 40 L336 22 L380 14 L380 120 L0 120Z" fill="url(#g)"/>
      <path d="M0 96 L30 88 L58 92 L86 74 L112 80 L140 62 L168 54 L196 60 L224 46 L252 52 L280 34 L308 40 L336 22 L380 14" fill="none" stroke="#8EDDB0" stroke-width="3" stroke-linejoin="round"/></svg>
  </div>
  <div class="demo">Demo build · illustrative data · not advice</div>
</div></body></html>`;

const browser = await chromium.launch({ executablePath });
const page = await browser.newPage({ deviceScaleFactor: 1 });
const shots = [
  { file: 'public/icons/icon-192.png', html: iconHtml(192), size: 192 },
  { file: 'public/icons/icon-512.png', html: iconHtml(512), size: 512 },
  {
    file: 'public/icons/icon-maskable-512.png',
    html: iconHtml(512, { maskable: true }),
    size: 512,
  },
  { file: 'public/apple-touch-icon.png', html: iconHtml(180), size: 180 },
];
for (const shot of shots) {
  await page.setViewportSize({ width: shot.size, height: shot.size });
  await page.setContent(shot.html);
  writeFileSync(resolve(root, shot.file), await page.screenshot({ type: 'png' }));
}
await page.setViewportSize({ width: 1200, height: 630 });
await page.setContent(ogHtml, { waitUntil: 'load' });
await page.evaluate(() => document.fonts.ready);
writeFileSync(resolve(root, 'public/og-image.png'), await page.screenshot({ type: 'png' }));
await browser.close();
console.log('Rendered icons and og-image.png');
