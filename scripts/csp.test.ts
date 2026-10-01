import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// The policy in vercel.json allows inline scripts by hash only. Editing an
// inline script in index.html changes its hash: this test names the new one.
const html = readFileSync('index.html', 'utf8');
const config = JSON.parse(readFileSync('vercel.json', 'utf8')) as {
  headers: { source: string; headers: { key: string; value: string }[] }[];
};
const csp = config.headers.flatMap((r) => r.headers).find((h) => h.key === 'Content-Security-Policy')?.value ?? '';
const directive = (name: string) =>
  csp
    .split(';')
    .map((d) => d.trim())
    .find((d) => d.startsWith(`${name} `)) ?? '';

describe('Content-Security-Policy', () => {
  it('allows every executable inline script in index.html by its hash', () => {
    const inline = [...html.matchAll(/<script(?![^>]*\bsrc=)([^>]*)>([\s\S]*?)<\/script>/g)]
      .filter((m) => !/type="application\/ld\+json"/.test(m[1] ?? ''))
      .map((m) => m[2] ?? '');
    expect(inline.length).toBeGreaterThan(0);
    for (const body of inline) {
      const hash = `'sha256-${createHash('sha256').update(body).digest('base64')}'`;
      expect(directive('script-src'), `add ${hash} to script-src in vercel.json`).toContain(hash);
    }
  });

  it('never allows inline or evaluated script, plugins or framing', () => {
    expect(directive('script-src')).not.toMatch(/unsafe-(inline|eval)/);
    expect(directive('object-src')).toBe("object-src 'none'");
    expect(directive('frame-ancestors')).toBe("frame-ancestors 'none'");
  });
});
