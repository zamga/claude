import { lookup as dnsLookup, type LookupAddress } from 'node:dns';
import http from 'node:http';
import https from 'node:https';
import { BlockList, isIP, type LookupFunction } from 'node:net';
import { createBrotliDecompress, createGunzip, createInflate } from 'node:zlib';
import type { Readable } from 'node:stream';
import { ALLOW_ALL, parseRobots, type Robots } from './robots';

/*
 * Fetching documents for the engine, safely. The engine reads pages that a
 * language model chose, so every request is held to the same rules: http or
 * https on the standard ports, public addresses only (checked on the address
 * actually connected to, so a name cannot resolve to an internal host between
 * the check and the connection), a few redirects each held to the same rules,
 * a size and a time limit, and the site's robots.txt.
 */

export interface Fetched {
  /** The address after redirects. */
  url: string;
  status: number;
  contentType: string;
  /** The charset the server declared, if any. */
  charset?: string;
  bytes: Uint8Array;
}

export class FetchError extends Error {
  constructor(
    message: string,
    readonly code:
      | 'not-allowed'
      | 'robots'
      | 'too-large'
      | 'timeout'
      | 'http-error'
      | 'unsupported'
      | 'network'
      | 'too-many-redirects',
  ) {
    super(message);
    this.name = 'FetchError';
  }
}

const PRIVATE = new BlockList();
for (const [net, prefix] of [
  ['0.0.0.0', 8],
  ['10.0.0.0', 8],
  ['100.64.0.0', 10],
  ['127.0.0.0', 8],
  ['169.254.0.0', 16],
  ['172.16.0.0', 12],
  ['192.0.0.0', 24],
  ['192.0.2.0', 24],
  ['192.88.99.0', 24],
  ['192.168.0.0', 16],
  ['198.18.0.0', 15],
  ['198.51.100.0', 24],
  ['203.0.113.0', 24],
  ['224.0.0.0', 4],
  ['240.0.0.0', 4],
] as const)
  PRIVATE.addSubnet(net, prefix, 'ipv4');
for (const [net, prefix] of [
  ['::', 128],
  ['::1', 128],
  // No rule for ::ffff:0:0/96: BlockList already judges IPv4-mapped addresses by their IPv4 rules,
  // and a rule for the whole mapped range would match every IPv4 address.
  ['64:ff9b::', 96],
  ['64:ff9b:1::', 48],
  ['100::', 64],
  ['2001::', 23],
  ['2001:db8::', 32],
  ['2002::', 16],
  ['fc00::', 7],
  ['fe80::', 10],
  ['ff00::', 8],
] as const)
  PRIVATE.addSubnet(net, prefix, 'ipv6');

/** Whether an address is somewhere the engine must not connect to. */
export function isPrivateAddress(address: string): boolean {
  const family = isIP(address);
  if (family === 4) return PRIVATE.check(address, 'ipv4');
  if (family === 6) {
    // An IPv4 address written as IPv6 is judged as the IPv4 address it is.
    const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/i.exec(address);
    if (mapped) return PRIVATE.check(mapped[1]!, 'ipv4');
    return PRIVATE.check(address, 'ipv6');
  }
  return true;
}

export interface FetchOptions {
  userAgent: string;
  maxBytes: number;
  timeoutMs: number;
  maxRedirects?: number;
  /** Content types accepted, as prefixes ("text/html", "application/pdf"). */
  accept: string[];
  /** Tests only: allow loopback and private addresses. */
  allowPrivate?: boolean;
  signal?: AbortSignal;
}

function safeLookup(allowPrivate: boolean): LookupFunction {
  return (hostname, options, callback) => {
    dnsLookup(hostname, { all: true, family: options.family ?? 0 }, (err, addresses: LookupAddress[]) => {
      if (err) return callback(err, '', 4);
      const usable = allowPrivate ? addresses : addresses.filter((a) => !isPrivateAddress(a.address));
      if (usable.length === 0) {
        const e = Object.assign(new Error(`${hostname} resolves only to private addresses`), { code: 'ENOTFOUND' });
        return callback(e, '', 4);
      }
      if (options.all) return (callback as (e: null, a: LookupAddress[]) => void)(null, usable);
      const first = usable[0]!;
      callback(null, first.address, first.family);
    });
  };
}

/** Check an address before any request is made to it. */
export function checkUrl(raw: string, allowPrivate = false): URL {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new FetchError(`Not a web address: ${raw}`, 'not-allowed');
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:')
    throw new FetchError('Only http and https addresses can be read.', 'not-allowed');
  if (url.username || url.password) throw new FetchError('Addresses with credentials are not read.', 'not-allowed');
  const port = url.port ? Number(url.port) : url.protocol === 'https:' ? 443 : 80;
  if (!allowPrivate && port !== 80 && port !== 443)
    throw new FetchError('Only the standard web ports are read.', 'not-allowed');
  const host = url.hostname.replace(/^\[|\]$/g, '');
  if (!allowPrivate && isIP(host) && isPrivateAddress(host))
    throw new FetchError('Private network addresses are not read.', 'not-allowed');
  if (!allowPrivate && (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.internal')))
    throw new FetchError('Private network addresses are not read.', 'not-allowed');
  return url;
}

function decompress(res: http.IncomingMessage): Readable {
  const encoding = String(res.headers['content-encoding'] ?? '').toLowerCase();
  if (encoding === 'gzip' || encoding === 'x-gzip') return res.pipe(createGunzip());
  if (encoding === 'deflate') return res.pipe(createInflate());
  if (encoding === 'br') return res.pipe(createBrotliDecompress());
  return res;
}

function once(url: URL, opts: FetchOptions, deadline: number): Promise<http.IncomingMessage> {
  return new Promise((resolve, reject) => {
    const client = url.protocol === 'https:' ? https : http;
    const req = client.request(
      url,
      {
        method: 'GET',
        lookup: safeLookup(opts.allowPrivate ?? false),
        headers: {
          'user-agent': opts.userAgent,
          accept: `${opts.accept.join(', ')};q=1, */*;q=0.1`,
          'accept-encoding': 'gzip, deflate, br',
          'accept-language': 'en, sl;q=0.9, *;q=0.5',
        },
        timeout: Math.max(1, deadline - Date.now()),
        signal: opts.signal,
      },
      resolve,
    );
    req.on('timeout', () => req.destroy(new FetchError('The site took too long to answer.', 'timeout')));
    req.on('error', (e) => reject(e instanceof FetchError ? e : new FetchError(e.message, 'network')));
    req.end();
  });
}

async function readBody(stream: Readable, maxBytes: number, deadline: number): Promise<Uint8Array> {
  const chunks: Buffer[] = [];
  let total = 0;
  const timer = setTimeout(
    () => stream.destroy(new FetchError('The document took too long to download.', 'timeout')),
    Math.max(1, deadline - Date.now()),
  );
  try {
    for await (const chunk of stream) {
      const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as Uint8Array);
      total += buf.length;
      if (total > maxBytes) {
        stream.destroy();
        throw new FetchError(`The document is larger than ${Math.round(maxBytes / 1e6)} MB.`, 'too-large');
      }
      chunks.push(buf);
    }
  } finally {
    clearTimeout(timer);
  }
  return new Uint8Array(Buffer.concat(chunks));
}

/** GET a document under the engine's rules. */
export async function fetchDocument(raw: string, opts: FetchOptions): Promise<Fetched> {
  const deadline = Date.now() + opts.timeoutMs;
  let url = checkUrl(raw, opts.allowPrivate);
  for (let hop = 0; hop <= (opts.maxRedirects ?? 5); hop++) {
    const res = await once(url, opts, deadline);
    const status = res.statusCode ?? 0;
    if (status >= 300 && status < 400 && res.headers.location) {
      res.resume();
      url = checkUrl(new URL(res.headers.location, url).toString(), opts.allowPrivate);
      continue;
    }
    if (status < 200 || status >= 300) {
      res.resume();
      throw new FetchError(`The site answered ${status}.`, 'http-error');
    }
    const declared = String(res.headers['content-type'] ?? '').toLowerCase();
    const contentType = declared.split(';')[0]!.trim();
    const charset = /charset=([^;]+)/.exec(declared)?.[1]?.trim().replace(/["']/g, '');
    const length = Number(res.headers['content-length'] ?? 0);
    if (length > opts.maxBytes) {
      res.resume();
      throw new FetchError(`The document is larger than ${Math.round(opts.maxBytes / 1e6)} MB.`, 'too-large');
    }
    if (contentType && !opts.accept.some((a) => contentType.startsWith(a))) {
      res.resume();
      throw new FetchError(`Documents of type ${contentType} are not read.`, 'unsupported');
    }
    const bytes = await readBody(decompress(res), opts.maxBytes, deadline);
    return { url: url.toString(), status, contentType, charset, bytes };
  }
  throw new FetchError('Too many redirects.', 'too-many-redirects');
}

/** robots.txt per site, fetched once per run. */
export class RobotsCache {
  private readonly sites = new Map<string, Promise<Robots>>();

  constructor(private readonly opts: Omit<FetchOptions, 'accept' | 'maxBytes'>) {}

  allows(raw: string): Promise<boolean> {
    const url = new URL(raw);
    let robots = this.sites.get(url.origin);
    if (!robots) {
      robots = fetchDocument(`${url.origin}/robots.txt`, {
        ...this.opts,
        accept: ['text/plain', 'text/'],
        maxBytes: 512 * 1024,
        timeoutMs: Math.min(this.opts.timeoutMs, 10_000),
      }).then(
        (r) => parseRobots(new TextDecoder().decode(r.bytes), this.opts.userAgent),
        // No robots.txt, or none we could read: the site sets no rules for us.
        () => ALLOW_ALL,
      );
      this.sites.set(url.origin, robots);
    }
    return robots.then((r) => r.allows(url.pathname + url.search));
  }
}

/** Text from bytes, in the charset the server or the page declares. */
export function decodeText(bytes: Uint8Array, declared?: string): string {
  const sniff = new TextDecoder('latin1').decode(bytes.subarray(0, 4096));
  const meta = /<meta[^>]+charset=["']?([\w-]+)/i.exec(sniff)?.[1];
  const label = (declared ?? meta ?? 'utf-8').toLowerCase();
  try {
    return new TextDecoder(label, { fatal: false }).decode(bytes);
  } catch {
    return new TextDecoder('utf-8').decode(bytes);
  }
}
