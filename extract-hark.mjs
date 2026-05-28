import { chromium } from 'playwright';
import fs from 'fs';

const url = 'https://harkcap.com/';
fs.mkdirSync('extraction', { recursive: true });

const browser = await chromium.launch({ args: ['--no-sandbox'] });
const ctx = await browser.newContext({
  viewport: { width: 1440, height: 1024 },
  userAgent:
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  locale: 'en-US',
});
const page = await ctx.newPage();

let gotoOk = true;
try {
  await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 });
} catch (e) {
  gotoOk = false;
  fs.writeFileSync('extraction/goto-error.txt', String(e));
}
await page.waitForTimeout(3500);

// scroll through to trigger lazy content / scroll animations
await page.evaluate(async () => {
  await new Promise((res) => {
    let y = 0;
    const t = setInterval(() => {
      window.scrollBy(0, 600);
      y += 600;
      if (y >= document.body.scrollHeight) {
        clearInterval(t);
        res();
      }
    }, 120);
  });
});
await page.waitForTimeout(1500);
await page.evaluate(() => window.scrollTo(0, 0));
await page.waitForTimeout(800);

const html = await page.content();
fs.writeFileSync('extraction/hark.html', html);

// ---- collect stylesheet text (inline + same-origin + fetched) ----
const css = await page.evaluate(async () => {
  const out = [];
  for (const sheet of Array.from(document.styleSheets)) {
    try {
      let t = '';
      for (const r of Array.from(sheet.cssRules)) t += r.cssText + '\n';
      out.push({ href: sheet.href, inline: !sheet.href, len: t.length, text: t });
    } catch (e) {
      if (sheet.href) {
        try {
          const r = await fetch(sheet.href);
          const t = await r.text();
          out.push({ href: sheet.href, fetched: true, len: t.length, text: t });
        } catch (e2) {
          out.push({ href: sheet.href, error: String(e2) });
        }
      }
    }
  }
  return out;
});
fs.writeFileSync('extraction/hark-css.json', JSON.stringify(css, null, 2));

// ---- computed design tokens ----
const tokens = await page.evaluate(() => {
  const toHex = (c) => {
    if (!c) return null;
    const m = c.match(/[\d.]+/g);
    if (!m) return null;
    const [r, g, b, a] = m.map(Number);
    if (a === 0) return null;
    return '#' + [r, g, b].map((x) => Math.round(x).toString(16).padStart(2, '0')).join('');
  };
  const els = Array.from(document.querySelectorAll('*'));
  const colorCount = {}, bgCount = {}, fontCount = {}, weightCount = {}, lsCount = {};
  for (const el of els) {
    const s = getComputedStyle(el);
    const rect = el.getBoundingClientRect();
    const area = Math.max(0, rect.width) * Math.max(0, rect.height);
    const c = toHex(s.color);
    if (c) colorCount[c] = (colorCount[c] || 0) + 1;
    const bg = toHex(s.backgroundColor);
    if (bg) bgCount[bg] = (bgCount[bg] || 0) + area; // weight backgrounds by painted area
    const ff = s.fontFamily;
    if (ff) fontCount[ff] = (fontCount[ff] || 0) + 1;
    const fw = s.fontWeight;
    if (fw) weightCount[fw] = (weightCount[fw] || 0) + 1;
    const ls = s.letterSpacing;
    if (ls && ls !== 'normal') lsCount[ls] = (lsCount[ls] || 0) + 1;
  }
  const top = (o, n = 16) => Object.entries(o).sort((a, b) => b[1] - a[1]).slice(0, n);
  const sample = (sel) => {
    const el = document.querySelector(sel);
    if (!el) return null;
    const s = getComputedStyle(el);
    return {
      text: (el.textContent || '').trim().slice(0, 70),
      fontFamily: s.fontFamily,
      fontWeight: s.fontWeight,
      fontSize: s.fontSize,
      lineHeight: s.lineHeight,
      letterSpacing: s.letterSpacing,
      textTransform: s.textTransform,
      color: s.color,
      backgroundColor: s.backgroundColor,
    };
  };
  const sels = ['body', 'h1', 'h2', 'h3', 'h4', 'p', 'nav', 'header', 'a', 'button', 'li', 'footer', 'section'];
  const samples = {};
  for (const sel of sels) samples[sel] = sample(sel);
  return {
    title: document.title,
    bodyBackground: getComputedStyle(document.body).backgroundColor,
    bodyColor: getComputedStyle(document.body).color,
    topTextColors: top(colorCount),
    topBackgroundsByArea: top(bgCount),
    topFontFamilies: top(fontCount),
    fontWeightsUsed: top(weightCount),
    letterSpacingsUsed: top(lsCount),
    samples,
    fontLinks: Array.from(document.querySelectorAll('link'))
      .map((l) => l.href)
      .filter((h) => /font|googleapis|typekit|typography|use\.|cdn/i.test(h)),
    headings: Array.from(document.querySelectorAll('h1,h2,h3'))
      .slice(0, 12)
      .map((h) => ({ tag: h.tagName, text: (h.textContent || '').trim().slice(0, 90) })),
  };
});
fs.writeFileSync('extraction/hark-tokens.json', JSON.stringify(tokens, null, 2));

// ---- screenshots ----
try {
  await page.screenshot({ path: 'extraction/hark-fold.png' });
} catch (e) {}
try {
  await page.screenshot({ path: 'extraction/hark-full.png', fullPage: true });
} catch (e) {}

fs.writeFileSync(
  'extraction/STATUS.txt',
  `gotoOk=${gotoOk}\nfinalUrl=${page.url()}\ntitle=${tokens.title}\nbodyBg=${tokens.bodyBackground}\nbodyColor=${tokens.bodyColor}\n`
);
await browser.close();
console.log('EXTRACTION COMPLETE');
