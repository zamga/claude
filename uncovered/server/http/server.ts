import type { IncomingMessage, ServerResponse } from 'node:http';
import { join } from 'node:path';
import { REPORT_ID } from '../../src/report/library';
import { createRun, health, reportJson, runEvents, runState, sendJson, type ApiDeps } from './api';
import type { ReportRenderer } from './render';
import { encode, sendEncoded, type Encoded, type StaticSite } from './static';

/*
 * One process serves everything: the built site, the API, and engine reports
 * rendered on request. Addresses are matched in order, most specific first.
 */

export interface AppDeps extends ApiDeps {
  site: StaticSite;
  renderer?: ReportRenderer;
}

const SECURITY = {
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'strict-origin-when-cross-origin',
  'x-frame-options': 'SAMEORIGIN',
  'cross-origin-opener-policy': 'same-origin',
};

async function notFound(req: IncomingMessage, res: ServerResponse, deps: AppDeps) {
  const page = await deps.site.resolve('/404.html');
  if (page) return deps.site.send(req, res, page, 404);
  res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' }).end('Not found');
}

/** Rendered engine reports, compressed. A report never changes once written, so its page is made once. */
class ReportPages {
  private readonly pages = new Map<string, Promise<Encoded>>();

  constructor(private readonly limit = 64) {}

  get(id: string, render: () => Promise<string>): Promise<Encoded> {
    let page = this.pages.get(id);
    if (!page) {
      page = render().then((html) => encode(Buffer.from(html)));
      page.catch(() => this.pages.delete(id));
      this.pages.set(id, page);
      if (this.pages.size > this.limit) this.pages.delete(this.pages.keys().next().value!);
    }
    return page;
  }
}

export function createApp(deps: AppDeps) {
  const pages = new ReportPages();
  return async (req: IncomingMessage, res: ServerResponse) => {
    for (const [k, v] of Object.entries(SECURITY)) res.setHeader(k, v);
    const url = new URL(req.url ?? '/', 'http://local');
    const path = url.pathname.replace(/\/+$/, '') || '/';
    const method = req.method ?? 'GET';
    try {
      if (path.startsWith('/api/')) {
        if (path === '/api/health' && method === 'GET') return health(res, deps);
        if (path === '/api/initiations') {
          if (method === 'POST') return await createRun(req, res, deps);
          return sendJson(res, 405, { error: 'Use POST.' }, { allow: 'POST' });
        }
        const run = /^\/api\/initiations\/([^/]+)(\/events)?$/.exec(path);
        if (run && method === 'GET') {
          const id = run[1]!;
          if (!REPORT_ID.test(id)) return sendJson(res, 404, { error: 'No such run.' });
          return run[2] ? runEvents(req, res, deps, id) : runState(res, deps, id);
        }
        const report = /^\/api\/reports\/([^/]+)$/.exec(path);
        if (report && method === 'GET') return await reportJson(req, res, deps, report[1]!);
        return sendJson(res, 404, { error: 'No such endpoint.' });
      }

      if (method !== 'GET' && method !== 'HEAD') {
        res.writeHead(405, { allow: 'GET, HEAD' }).end();
        return;
      }

      // An engine report, rendered to a full page. The sample is a static file like any other.
      const report = /^\/report\/([^/]+)$/.exec(path);
      if (report && deps.renderer && !(await deps.site.resolve(path))) {
        const id = report[1]!;
        const data = REPORT_ID.test(id) ? await deps.store.report(id) : undefined;
        if (!data) return await notFound(req, res, deps);
        const { renderer } = deps;
        const page = await pages.get(id, () => renderer.page(data));
        return sendEncoded(req, res, page, 200, {
          'content-type': 'text/html; charset=utf-8',
          'cache-control': 'no-cache',
        });
      }

      // A run's address: the request page rendered as the run stands, so it reads before any script runs.
      const followed = path === '/initiate' ? url.searchParams.get('run') : null;
      if (followed && deps.renderer) {
        const record = REPORT_ID.test(followed) ? (deps.store.get(followed) ?? null) : null;
        const html = await deps.renderer.runPage(followed, record);
        return sendEncoded(req, res, await encode(Buffer.from(html)), record ? 200 : 404, {
          'content-type': 'text/html; charset=utf-8',
          'cache-control': 'no-store',
        });
      }

      const file = await deps.site.resolve(path === '/' ? '/' : url.pathname);
      if (file && !file.endsWith(join('', '404.html'))) return await deps.site.send(req, res, file);
      return await notFound(req, res, deps);
    } catch (e) {
      console.error('[uncovered] request failed:', e);
      if (!res.headersSent) sendJson(res, 500, { error: 'Something went wrong on the server.' });
      else res.end();
    }
  };
}
