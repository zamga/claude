import { readdir, readFile, stat } from 'node:fs/promises';
import type { IncomingMessage, OutgoingHttpHeaders, ServerResponse } from 'node:http';
import { extname, join, normalize, sep } from 'node:path';
import { promisify } from 'node:util';
import { brotliCompress, constants, gzip } from 'node:zlib';

/*
 * The built site, served as a static host would serve it: clean addresses
 * (/initiate is initiate.html), hashed assets cached for a year, pages
 * revalidated, text compressed once and kept, and the 404 page for anything
 * that is not there. A page the server rendered for itself replaces the
 * built file of the same name.
 */

const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
};

const COMPRESSIBLE = new Set(['.html', '.js', '.mjs', '.css', '.json', '.svg', '.txt', '.xml', '.map']);

/** A response body with its compressed forms, made once and sent many times. */
export interface Encoded {
  body: Buffer;
  br?: Buffer;
  gzip?: Buffer;
}

const brotliAsync = promisify(brotliCompress);
const gzipAsync = promisify(gzip);

/** Compress text off the main thread, so a large file never holds up other requests. */
export async function encode(body: Buffer, compressible = true): Promise<Encoded> {
  if (!compressible || body.length <= 1024) return { body };
  const [br, gz] = await Promise.all([
    brotliAsync(body, { params: { [constants.BROTLI_PARAM_QUALITY]: 10 } }),
    gzipAsync(body, { level: 9 }),
  ]);
  return { body, br, gzip: gz };
}

/** Send a body in the best encoding the client accepts. */
export function sendEncoded(
  req: IncomingMessage,
  res: ServerResponse,
  c: Encoded,
  status: number,
  headers: OutgoingHttpHeaders,
) {
  const accept = String(req.headers['accept-encoding'] ?? '');
  const [body, encoding] =
    c.br && /\bbr\b/.test(accept)
      ? [c.br, 'br']
      : c.gzip && /\bgzip\b/.test(accept)
        ? [c.gzip, 'gzip']
        : [c.body, undefined];
  res.writeHead(status, {
    ...headers,
    'content-length': body.length,
    ...(encoding ? { 'content-encoding': encoding } : {}),
    ...(c.br || c.gzip ? { vary: 'accept-encoding' } : {}),
  });
  res.end(req.method === 'HEAD' ? undefined : body);
}

export class StaticSite {
  private readonly cache = new Map<string, Promise<Encoded>>();

  /**
   * `head` is added to the head of every page read from the build, such as the tag saying the engine
   * is running. `pages` are pages rendered for this server, by file name (`initiate.html`), served
   * as they are in place of the built ones.
   */
  constructor(
    readonly dir: string,
    private readonly head = '',
    pages: Record<string, string> = {},
  ) {
    for (const [name, html] of Object.entries(pages)) this.cache.set(join(dir, name), encode(Buffer.from(html)));
  }

  /** Read and compress every page, script and stylesheet now, so the first visitor waits for none of it. */
  async warm(): Promise<number> {
    const entries = await readdir(this.dir, { recursive: true, withFileTypes: true });
    const files = entries
      .filter((e) => e.isFile() && COMPRESSIBLE.has(extname(e.name)) && extname(e.name) !== '.map')
      .map((e) => join(e.parentPath, e.name));
    await Promise.all(files.map((f) => this.load(f)));
    return files.length;
  }

  /** The file an address maps to inside the site, never outside it. */
  async resolve(pathname: string): Promise<string | undefined> {
    let path: string;
    try {
      path = decodeURIComponent(pathname);
    } catch {
      return undefined;
    }
    if (path.includes('\0')) return undefined;
    const clean = normalize(path).replace(/^(\.\.[/\\])+/, '');
    const candidates =
      clean === '/' ? ['index.html'] : [clean, `${clean.replace(/\/+$/, '')}.html`, join(clean, 'index.html')];
    for (const c of candidates) {
      const file = join(this.dir, c);
      if (file !== this.dir && !file.startsWith(this.dir + sep)) continue;
      try {
        if ((await stat(file)).isFile()) return file;
      } catch {
        // Try the next form of the address.
      }
    }
    return undefined;
  }

  private load(file: string): Promise<Encoded> {
    let c = this.cache.get(file);
    if (!c) {
      c = (async () => {
        let body = await readFile(file);
        if (this.head && extname(file) === '.html')
          body = Buffer.from(body.toString('utf8').replace('</head>', `${this.head}</head>`));
        return encode(body, COMPRESSIBLE.has(extname(file)));
      })();
      // A file that could not be read is tried again next time.
      c.catch(() => this.cache.delete(file));
      this.cache.set(file, c);
    }
    return c;
  }

  /** Send a file, compressed when the client accepts it. */
  async send(req: IncomingMessage, res: ServerResponse, file: string, status = 200) {
    const ext = extname(file);
    const hashed = file.includes(`${sep}assets${sep}`);
    sendEncoded(req, res, await this.load(file), status, {
      'content-type': TYPES[ext] ?? 'application/octet-stream',
      'cache-control': hashed
        ? 'public, max-age=31536000, immutable'
        : ext === '.html'
          ? 'no-cache'
          : 'public, max-age=3600',
    });
  }
}
