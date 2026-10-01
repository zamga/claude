/**
 * Turn the single-file preview build into a page body for hosts that supply
 * their own document skeleton (doctype, <html>, <head>, <body>, charset,
 * viewport). The title comes first, as a short name, so hosts that scan the
 * opening bytes find it; links to files a single-file build does not have
 * are dropped; every inline style and script is left as it is.
 */
import { readFileSync, statSync, writeFileSync } from 'node:fs';

const src = 'dist-artifact/index.html';
const out = 'dist-artifact/uncovered.html';
let html = readFileSync(src, 'utf8');

const title = '<title>Uncovered Research</title>';
html = html.replace(/<title>[\s\S]*?<\/title>/i, '');

const strip = [
  /<!doctype html>/i,
  /<html[^>]*>/i,
  /<\/html>/i,
  /<head>/i,
  /<\/head>/i,
  /<body[^>]*>/i,
  /<\/body>/i,
  /<meta\s+charset=[^>]*>/i,
  /<meta\s+name="viewport"[^>]*>/i,
  /<link\s+rel="(?:icon|apple-touch-icon|manifest|preload|modulepreload)"[^>]*>/gi,
];
for (const re of strip) html = html.replace(re, '');

if (/(?:src|href)="\/(?!\/)/.test(html))
  throw new Error('The preview still points at a server path; it must be self-contained.');

writeFileSync(out, `${title}\n${html.trim()}\n`);
console.log(`Wrote ${out} (${(statSync(out).size / 1024).toFixed(0)} KB)`);
