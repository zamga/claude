import { chromium } from 'playwright';

const browser = await chromium.launch({ args: ['--no-sandbox'] });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
const page = await ctx.newPage();

await page.goto('file://' + process.cwd() + '/index.html', { waitUntil: 'networkidle', timeout: 60000 });
await page.evaluate(() => document.fonts && document.fonts.ready);
await page.waitForTimeout(4500); // fonts + GSAP hero intro

// fold screenshot (with intro animation settled)
await page.screenshot({ path: 'preview/home-fold.png' });

// force all scroll-reveal elements visible so the full-page capture isn't blank below the fold
await page.addStyleTag({
  content:
    '[data-reveal]{opacity:1!important;transform:none!important}' +
    '.line-mask>span{transform:none!important}' +
    '#capabilities .num{opacity:1!important;transform:none!important}',
});
await page.waitForTimeout(600);

await page.screenshot({ path: 'preview/home-full.png', fullPage: true });

await browser.close();
console.log('RENDER COMPLETE');
