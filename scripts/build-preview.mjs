#!/usr/bin/env node
/**
 * Static preview build: the demo app as one page plus its script and style files, runnable from
 * any folder or inside an embedding frame (for example a hosted preview page).
 *
 *   npm run build:preview        # writes dist-preview/
 *
 * Differences from `npm run build`: routes live in the URL hash (no server rewrites needed),
 * asset URLs are relative, the two font families are embedded in the stylesheet as data URIs (so
 * a host that only serves scripts and styles still shows the real faces), and the page is written
 * as content only (title, styles, scripts, root) for hosts that supply the document skeleton.
 * There is no service worker or web manifest: this is a demo to look at, not the installable app.
 * dist-preview/files.json lists the published path of every file the page loads.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const out = join(root, 'dist-preview');

execFileSync('npx', ['vite', 'build', '--base', './', '--outDir', out, '--emptyOutDir'], {
  cwd: root,
  stdio: 'inherit',
  env: { ...process.env, VITE_ROUTER: 'hash', VITE_PWA: 'off', VITE_DATA_MODE: 'demo' },
});

// Fonts as data URIs: every url() that points at public/fonts/*.woff2, whatever its prefix.
const fontData = new Map();
const embedFonts = (css) =>
  css.replace(/url\((['"]?)[^)'"]*?fonts\/([\w.-]+\.woff2)\1\)/g, (_, _quote, name) => {
    if (!fontData.has(name))
      fontData.set(name, readFileSync(join(root, 'public', 'fonts', name)).toString('base64'));
    return `url(data:font/woff2;base64,${fontData.get(name)})`;
  });

const assets = readdirSync(join(out, 'assets')).filter((name) => /\.(js|css)$/.test(name));
for (const name of assets.filter((file) => file.endsWith('.css'))) {
  const path = join(out, 'assets', name);
  writeFileSync(path, embedFonts(readFileSync(path, 'utf8')));
}

const html = readFileSync(join(out, 'index.html'), 'utf8');
const pick = (pattern) => [...html.matchAll(pattern)].map((match) => match[0]);
const styles = pick(/<style[^>]*>[\s\S]*?<\/style>/g).map(embedFonts);
// Entry stylesheets are inlined, so the first frame never waits on a second request. A typed link
// (neither fetched nor applied) tells Vite's chunk loader each file is already present, so the
// first lazy route does not download it again. The app moves both into <head> at start.
const linkedStyles = [
  ...html.matchAll(/<link rel="stylesheet"[^>]*href="\.\/(assets\/[^"]+\.css)"[^>]*>/g),
].map(
  ([, file]) =>
    `<style data-href="./${file}">${readFileSync(join(out, file), 'utf8')}</style><link rel="stylesheet" type="text/x-inlined" href="./${file}">`,
);
const scripts = pick(/<script type="module"[^>]*><\/script>/g);
const preloads = pick(/<link rel="modulepreload"[^>]*>/g);
const body = html.match(/<body>([\s\S]*?)<\/body>/)?.[1]?.trim() ?? '<div id="root"></div>';

const page = [
  '<title>Stock Picks</title>',
  '<meta name="description" content="Stock Picks demo: daily editorial stock research with illustrative data." />',
  "<script>document.documentElement.lang = 'en';</script>",
  ...styles,
  ...linkedStyles,
  ...preloads,
  ...scripts,
  body,
  '',
].join('\n');
writeFileSync(join(out, 'index.html'), page);

const files = Object.fromEntries(
  assets.map((name) => [`assets/${name}`, `dist-preview/assets/${name}`]),
);
writeFileSync(join(out, 'files.json'), `${JSON.stringify(files, null, 1)}\n`);
const kb = (bytes) => `${(bytes / 1024).toFixed(0)} KiB`;
console.log(
  `\nPreview page: dist-preview/index.html (${kb(page.length)}), ${assets.length} script and style files, fonts embedded: ${[...fontData.keys()].join(', ')}`,
);
