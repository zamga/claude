/*
 * Write each page as static HTML after the client and server builds:
 * dist/index.html, dist/report/krka.html and so on, plus dist/404.html.
 * Each page gets its own title and description, and the styles and code of its
 * lazily loaded page, so it paints complete before any script runs. The bare
 * template is kept in dist-ssr for the server, which renders engine reports
 * the same way on request.
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');
const { render, structuredData, fillShell, ROUTES, NOT_FOUND } = await import(
  pathToFileURL(join(root, 'dist-ssr', 'entry-server.js')).href
);
const template = await readFile(join(dist, 'index.html'), 'utf8');
const manifest = JSON.parse(await readFile(join(dist, '.vite', 'manifest.json'), 'utf8'));
await writeFile(join(root, 'dist-ssr', 'template.html'), template);

for (const route of [...ROUTES, NOT_FOUND]) {
  const page = fillShell(template, {
    path: route.path,
    html: await render(route.path),
    title: route.title,
    description: route.description,
    manifest,
    siteUrl: process.env.SITE_URL,
    structuredData: structuredData(route.path),
  });
  // Flat files (report/krka.html) resolve without a trailing slash on static hosts and in `vite preview`.
  const file = route.path === '/' ? 'index.html' : route.path === '/404' ? '404.html' : `${route.path.slice(1)}.html`;
  await mkdir(dirname(join(dist, file)), { recursive: true });
  await writeFile(join(dist, file), page);
  console.log(`prerendered ${route.path.padEnd(14)} → dist/${file} (${(page.length / 1024).toFixed(1)} kB)`);
}
