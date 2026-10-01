/**
 * Turn the single-file build into a page body for hosts that supply their
 * own document skeleton (doctype, <html>, <head>, <body>, charset, viewport).
 * Keeps the title first so hosts that scan the opening bytes find it, drops
 * links to files that do not exist in a single-file build, and leaves every
 * inline style and script untouched.
 */
import { readFileSync, writeFileSync, statSync } from 'node:fs';

const src = 'dist-artifact/index.html';
const out = 'dist-artifact/plimsoll.html';
let html = readFileSync(src, 'utf8');

// The host shows the title as the page's name, so it carries the name alone.
const title = '<title>Plimsoll</title>';
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
  /<link\s+rel="(?:icon|apple-touch-icon|manifest|preload)"[^>]*>/gi,
];
for (const re of strip) html = html.replace(re, '');

const body = `${title}\n${html.trim()}\n`;
writeFileSync(out, body);
const kb = (statSync(out).size / 1024).toFixed(0);
console.log(`Wrote ${out} (${kb} KB)`);
