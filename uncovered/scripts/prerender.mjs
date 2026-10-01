/*
 * Write each page as static HTML after the client and server builds:
 * dist/index.html, dist/report/krka.html and so on, plus dist/404.html.
 * Each page gets its own title and description, and the styles and code of its
 * lazily loaded page, so it paints complete before any script runs.
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');
const { render, structuredData, ROUTES, NOT_FOUND } = await import(
  pathToFileURL(join(root, 'dist-ssr', 'entry-server.js')).href
);
const template = await readFile(join(dist, 'index.html'), 'utf8');
const manifest = JSON.parse(await readFile(join(dist, '.vite', 'manifest.json'), 'utf8'));

/** The page module each route loads lazily. */
const PAGES = {
  '/report/krka': 'src/pages/Report.tsx',
  '/initiate': 'src/pages/Initiate.tsx',
  '/method': 'src/pages/Method.tsx',
  '/404': 'src/pages/NotFound.tsx',
};

const escapeHtml = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** A chunk's own file, its static imports and every stylesheet among them. */
function assets(source) {
  const js = new Set();
  const css = new Set();
  const visit = (key) => {
    const entry = manifest[key];
    if (!entry || js.has(entry.file)) return;
    js.add(entry.file);
    (entry.css ?? []).forEach((f) => css.add(f));
    (entry.imports ?? []).forEach(visit);
  };
  visit(source);
  return { js: [...js], css: [...css] };
}

const entryCss = new Set(
  Object.values(manifest)
    .filter((e) => e.isEntry)
    .flatMap((e) => e.css ?? []),
);

for (const route of [...ROUTES, NOT_FOUND]) {
  const html = await render(route.path);
  const source = PAGES[route.path];
  const { js, css } = source ? assets(source) : { js: [], css: [] };
  const siteUrl = process.env.SITE_URL?.replace(/\/+$/, '');
  const data = structuredData(route.path);
  const head = [
    // The address search engines should treat as the page's own, when the deployment names it.
    ...(siteUrl && route.path !== '/404'
      ? [
          `<link rel="canonical" href="${siteUrl}${route.path === '/' ? '/' : route.path}">`,
          `<meta property="og:url" content="${siteUrl}${route.path === '/' ? '/' : route.path}">`,
        ]
      : []),
    ...(data ? [`<script type="application/ld+json">${JSON.stringify(data).replace(/</g, '\\u003c')}</script>`] : []),
  ];
  const links = [
    ...css.filter((f) => !entryCss.has(f)).map((f) => `<link rel="stylesheet" crossorigin href="/${f}">`),
    ...js.map((f) => `<link rel="modulepreload" crossorigin href="/${f}">`),
    ...head,
  ].join('\n    ');
  const page = template
    .replace(/<title>[^<]*<\/title>/, `<title>${escapeHtml(route.title)}</title>`)
    .replace(
      /<meta\s+name="description"\s+content="[^"]*"\s*\/?>/,
      `<meta name="description" content="${escapeHtml(route.description)}" />`,
    )
    .replace(
      /<meta\s+property="og:title"\s+content="[^"]*"\s*\/?>/,
      `<meta property="og:title" content="${escapeHtml(route.title)}" />`,
    )
    .replace('</head>', links ? `  ${links}\n  </head>` : '</head>')
    .replace('<div id="root"></div>', `<div id="root" data-path="${route.path}">${html}</div>`);
  if (!page.includes(`data-path="${route.path}"`)) throw new Error(`No root element to fill for ${route.path}`);
  // Flat files (report/krka.html) resolve without a trailing slash on static hosts and in `vite preview`.
  const file = route.path === '/' ? 'index.html' : route.path === '/404' ? '404.html' : `${route.path.slice(1)}.html`;
  await mkdir(dirname(join(dist, file)), { recursive: true });
  await writeFile(join(dist, file), page);
  console.log(`prerendered ${route.path.padEnd(14)} → dist/${file} (${(page.length / 1024).toFixed(1)} kB)`);
}
