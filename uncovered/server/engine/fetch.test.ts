import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { gzipSync } from 'node:zlib';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { checkUrl, decodeText, fetchDocument, FetchError, isPrivateAddress, RobotsCache } from './fetch';
import { parseRobots } from './robots';

let server: Server;
let base = '';

beforeAll(async () => {
  server = createServer((req, res) => {
    const path = req.url ?? '/';
    if (path === '/robots.txt') {
      res.writeHead(200, { 'content-type': 'text/plain' });
      res.end('User-agent: *\nDisallow: /private/\nAllow: /private/open\n');
    } else if (path === '/page') {
      res.writeHead(200, { 'content-type': 'text/html; charset=windows-1250', 'content-encoding': 'gzip' });
      // "Poročilo" in windows-1250: č is 0xE8.
      res.end(gzipSync(Buffer.from([0x50, 0x6f, 0x72, 0x6f, 0xe8, 0x69, 0x6c, 0x6f])));
    } else if (path === '/moved') {
      res.writeHead(302, { location: '/page' });
      res.end();
    } else if (path === '/loop') {
      res.writeHead(302, { location: '/loop' });
      res.end();
    } else if (path === '/big') {
      res.writeHead(200, { 'content-type': 'application/pdf' });
      res.end(Buffer.alloc(2048));
    } else if (path === '/image') {
      res.writeHead(200, { 'content-type': 'image/png' });
      res.end('png');
    } else {
      res.writeHead(404);
      res.end();
    }
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())));

const opts = {
  userAgent: 'Uncovered-test',
  maxBytes: 1024,
  timeoutMs: 5000,
  accept: ['text/html', 'application/pdf', 'text/plain'],
  allowPrivate: true,
};

describe('addresses the engine refuses', () => {
  it('refuses private networks, odd ports, credentials and other schemes', () => {
    for (const bad of [
      'http://127.0.0.1/',
      'http://10.1.2.3/x',
      'http://[::1]/',
      'http://169.254.169.254/latest/meta-data/',
      'http://localhost/',
      'https://example.com:8443/',
      'https://user:pass@example.com/',
      'file:///etc/passwd',
      'ftp://example.com/',
    ])
      expect(() => checkUrl(bad), bad).toThrow(FetchError);
    expect(checkUrl('https://www.krka.biz/en/').hostname).toBe('www.krka.biz');
  });

  it('knows private address ranges, including IPv4 written as IPv6', () => {
    expect(isPrivateAddress('192.168.1.1')).toBe(true);
    expect(isPrivateAddress('::ffff:10.0.0.1')).toBe(true);
    expect(isPrivateAddress('fd00::1')).toBe(true);
    expect(isPrivateAddress('93.184.216.34')).toBe(false);
    expect(isPrivateAddress('2606:2800:220:1::1')).toBe(false);
  });
});

describe('fetching', () => {
  it('follows a redirect, decompresses and keeps the declared charset', async () => {
    const r = await fetchDocument(`${base}/moved`, opts);
    expect(r.url).toBe(`${base}/page`);
    expect(r.contentType).toBe('text/html');
    expect(decodeText(r.bytes, r.charset)).toBe('Poročilo');
  });

  it('stops at too many redirects, too large a file and the wrong type', async () => {
    await expect(fetchDocument(`${base}/loop`, opts)).rejects.toMatchObject({ code: 'too-many-redirects' });
    await expect(fetchDocument(`${base}/big`, opts)).rejects.toMatchObject({ code: 'too-large' });
    await expect(fetchDocument(`${base}/image`, opts)).rejects.toMatchObject({ code: 'unsupported' });
    await expect(fetchDocument(`${base}/missing`, opts)).rejects.toMatchObject({ code: 'http-error' });
  });

  it('honours robots.txt', async () => {
    const robots = new RobotsCache({ userAgent: 'Uncovered-test', timeoutMs: 5000, allowPrivate: true });
    expect(await robots.allows(`${base}/page`)).toBe(true);
    expect(await robots.allows(`${base}/private/report.pdf`)).toBe(false);
    expect(await robots.allows(`${base}/private/open/report.pdf`)).toBe(true);
  });
});

describe('robots.txt rules', () => {
  it('prefers the agent’s own group, then the longest rule', () => {
    const r = parseRobots(
      'User-agent: *\nDisallow: /\n\nUser-agent: Uncovered\nDisallow: /tmp/\nAllow: /tmp/public$\n',
      'Uncovered/1.0',
    );
    expect(r.allows('/annual-report.pdf')).toBe(true);
    expect(r.allows('/tmp/x')).toBe(false);
    expect(r.allows('/tmp/public')).toBe(true);
    expect(r.allows('/tmp/public/x')).toBe(false);
    expect(parseRobots('User-agent: *\nDisallow: /*.pdf$\n', 'Uncovered').allows('/a/b.pdf')).toBe(false);
  });
});
