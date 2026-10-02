/*
 * Captures the front page's Krka cover as print: the real markup, rendered by
 * Chromium from the built site, alone on white at A4 width, with the lamp
 * switched off so every microtext line is printed as a rule. Any region can
 * then be rasterised at any magnification, so the type stays vector-sharp
 * however close the camera goes.
 */
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const sharp = require('sharp');

/** The cover is laid out at A4's width at 96 dpi, so one CSS pixel is 210/794 mm. */
export const COVER_WIDTH = 794;
export const MM_PER_CSS = 210 / COVER_WIDTH;

// Where the cover sits in a viewport large enough that no capture reaches past its edge.
const VIEWPORT = { width: 3400, height: 3000 };
const AT = { x: 1300, y: 900 };

export async function openCover({ url, executablePath }) {
  const browser = await chromium.launch({
    executablePath,
    args: ['--disable-background-networking', '--disable-component-update', '--hide-scrollbars'],
  });
  const context = await browser.newContext({ viewport: VIEWPORT, reducedMotion: 'reduce', colorScheme: 'light' });
  const page = await context.newPage();
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  // Reduced motion draws the seal finished and sets nothing in motion; give the seal a moment to draw.
  await page.waitForTimeout(800);
  const cover = await page.evaluate(
    ({ width, at }) => {
      const art = document.querySelector('article[data-inspect]');
      if (!art) throw new Error('No inspected cover on the page');
      document.body.replaceChildren(art);
      document.documentElement.style.background = '#fff';
      document.body.style.cssText = 'margin:0;background:#fff;';
      Object.assign(art.style, {
        position: 'absolute',
        left: `${at.x}px`,
        top: `${at.y}px`,
        width: `${width}px`,
        margin: '0',
        transform: 'none',
        boxShadow: 'none',
        border: '0',
        background: '#fff',
      });
      art.style.setProperty('--sheet', '#fff');
      art.style.setProperty('--lit', '0');
      // Print, not inspection: no lamp light, the microtext a rule everywhere, the legible line not shown.
      for (const layer of art.children) if (layer.tagName === 'SPAN') layer.style.display = 'none';
      for (const mark of art.querySelectorAll('[data-lamp-mask]')) {
        if (mark.previousElementSibling) mark.style.display = 'none';
        else {
          mark.style.maskImage = 'none';
          mark.style.webkitMaskImage = 'none';
        }
      }
      const r = art.getBoundingClientRect();
      return { width: r.width, height: r.height };
    },
    { width: COVER_WIDTH, at: AT },
  );
  await page.waitForTimeout(200);
  const cdp = await context.newCDPSession(page);
  const setLayer = (micro) =>
    page.evaluate((micro) => {
      const art = document.querySelector('article[data-inspect]');
      art.style.visibility = micro ? 'hidden' : '';
      for (const mark of art.querySelectorAll('[data-lamp-mask]')) {
        if (!mark.previousElementSibling) mark.style.visibility = micro ? 'visible' : '';
      }
    }, micro);

  return {
    cover,
    /**
     * The box (cover CSS px) of the first element matching the selector that contains `text`, or,
     * given `inner`, of the first occurrence of that text inside it.
     */
    async locate(selector, text, inner) {
      return page.evaluate(
        ({ selector, text, inner, at }) => {
          const el = [...document.querySelectorAll(selector)].find((e) => !text || e.textContent.includes(text));
          if (!el) throw new Error(`Nothing on the cover matches ${selector} with ${text}`);
          let rect = el.getBoundingClientRect();
          if (inner) {
            const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
            let found = false;
            for (let node = walker.nextNode(); node && !found; node = walker.nextNode()) {
              const i = node.textContent.indexOf(inner);
              if (i < 0) continue;
              const range = document.createRange();
              range.setStart(node, i);
              range.setEnd(node, i + inner.length);
              rect = range.getBoundingClientRect();
              found = true;
            }
            if (!found) throw new Error(`No "${inner}" inside ${selector} with ${text}`);
          }
          return { x: rect.x - at.x, y: rect.y - at.y, width: rect.width, height: rect.height };
        },
        { selector, text, inner, at: AT },
      );
    },
    /** The text of the first element matching the selector that contains `text`. */
    async text(selector, text) {
      return page.evaluate(
        ({ selector, text }) =>
          [...document.querySelectorAll(selector)].find((e) => e.textContent.includes(text))?.textContent ?? null,
        { selector, text },
      );
    },
    /** A page of the same site, for composing cards over plates with the site's own fonts. */
    async compose(html, { width, height }) {
      const card = await context.newPage();
      await card.setViewportSize({ width, height });
      // Open a page of the site first, so the card's fonts load from the same origin.
      await card.goto(new URL('/__card', url).href, { waitUntil: 'load' });
      await card.setContent(html, { waitUntil: 'networkidle' });
      await card.evaluate(() => document.fonts.ready);
      const shot = await card.screenshot({ type: 'png' });
      await card.close();
      return shot;
    },
    /**
     * Rasterises the region centred on (cx, cy) in cover CSS px at `zoom` output pixels per CSS px,
     * into an RGB buffer of w × h. Captures at twice the size and downsamples, so edges are clean.
     */
    async grab({ cx, cy, zoom, w, h, layer = 'print' }) {
      // The microtext alone: the line printed in ink that fluoresces, for plates under ultraviolet.
      if (layer === 'micro') await setLayer(true);
      // Chromium relays out a page captured below scale 1, so a wide shot is captured at 1 and shrunk.
      const scale = Math.max(1, zoom * 2);
      const cw = w / zoom;
      const ch = h / zoom;
      const { data } = await cdp.send('Page.captureScreenshot', {
        format: 'png',
        clip: { x: AT.x + cx - cw / 2, y: AT.y + cy - ch / 2, width: cw, height: ch, scale },
        captureBeyondViewport: false,
      });
      if (layer === 'micro') await setLayer(false);
      const { data: raw } = await sharp(Buffer.from(data, 'base64'))
        .resize(w, h, { fit: 'fill', kernel: 'lanczos3' })
        .removeAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true });
      return {
        raw,
        mmPerPx: MM_PER_CSS / zoom,
        originMm: [(cx - cw / 2) * MM_PER_CSS, (cy - ch / 2) * MM_PER_CSS],
      };
    },
    async close() {
      await browser.close();
    },
  };
}
