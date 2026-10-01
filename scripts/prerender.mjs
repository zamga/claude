/**
 * Prerender every public route into dist/ after `vite build` and the SSR
 * build of src/entry-server.tsx. Writes:
 *   dist/<route>.html        rendered pages with their own title, description,
 *                            canonical URL and Open Graph tags (served at
 *                            /<route> with clean URLs)
 *   dist/app.html            the empty shell, for SPA fallback on other paths
 *   dist/sitemap.xml, dist/robots.txt, dist/llms.txt
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const site = (process.env.SITE_URL ?? 'https://plimsoll.app').replace(/\/$/, '');
const { render, routes } = await import(pathToFileURL(resolve('dist-ssr/entry-server.js')).href);
// The client build's index.html is the template. If this script already ran,
// index.html holds the rendered home page, so fall back to the saved shell.
let template = readFileSync('dist/index.html', 'utf8');
if (!template.includes('<div id="root"></div>')) {
  if (!existsSync('dist/app.html')) throw new Error('dist/index.html is already rendered and dist/app.html is missing; run vite build first.');
  template = readFileSync('dist/app.html', 'utf8');
}

const escape = (s) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function withMeta(html, meta) {
  const url = `${site}${meta.path === '/' ? '/' : meta.path}`;
  return html
    .replace(/<title>[\s\S]*?<\/title>/, `<title>${escape(meta.title)}</title>`)
    .replace(/<meta\s+name="description"[\s\S]*?\/>/, `<meta name="description" content="${escape(meta.description)}" />`)
    .replace(/<meta property="og:title"[^>]*\/>/, `<meta property="og:title" content="${escape(meta.title)}" />`)
    .replace(
      /<meta\s+property="og:description"[\s\S]*?\/>/,
      `<meta property="og:description" content="${escape(meta.description)}" />`,
    )
    .replace('<meta property="og:image" content="/og.png" />', `<meta property="og:image" content="${site}/og.png" />`)
    .replace(
      '<meta property="og:type" content="website" />',
      `<meta property="og:type" content="website" />\n    <meta property="og:url" content="${url}" />\n    <link rel="canonical" href="${url}" />`,
    );
}

writeFileSync('dist/app.html', template);

const list = routes();
for (const meta of list) {
  const body = await render(meta.path);
  const page = withMeta(template.replace('<div id="root"></div>', `<div id="root">${body}</div>`), meta);
  const file = meta.path === '/' ? 'dist/index.html' : join('dist', `${meta.path.slice(1)}.html`);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, page);
  console.log(`prerendered ${meta.path.padEnd(14)} ${(Buffer.byteLength(page) / 1024).toFixed(0)} KB`);
}

const today = new Date().toISOString().slice(0, 10);
writeFileSync(
  'dist/sitemap.xml',
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${list
    .map((m) => `  <url><loc>${site}${m.path}</loc><lastmod>${today}</lastmod></url>`)
    .join('\n')}\n</urlset>\n`,
);
writeFileSync('dist/robots.txt', `User-agent: *\nAllow: /\nSitemap: ${site}/sitemap.xml\n`);
console.log(`sitemap: ${list.length} URLs on ${site}`);

// llms.txt (llmstxt.org): the same map, written for language models and agents.
const link = (m) => `- [${m.title.replace(/ · Plimsoll$/, '')}](${site}${m.path}): ${m.description}`;
const charts = list.filter((m) => m.path.startsWith('/chart/'));
const pages = list.filter((m) => !m.path.startsWith('/chart/') && m.path !== '/');
writeFileSync(
  'dist/llms.txt',
  `# Plimsoll

> Company analysis and valuation drawn as a nautical chart. The share price is sea level; every combination of revenue growth and operating margin is a point on the terrain, worth more (land) or less (water) than the price. The coastline is what the market is betting on.

Values come from a free-cash-flow-to-the-firm discounted cash flow model on figures from SEC filings, with a reverse DCF for the market-implied coastline and 4,000 Monte Carlo draws for the odds. Charts are illustrations of assumptions, not investment advice.

## Charts

${charts.map(link).join('\n')}

## Reference

${pages.map(link).join('\n')}
`,
);
