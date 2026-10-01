import { StrictMode } from 'react';
import { prerenderToNodeStream } from 'react-dom/static';
import { App } from './app/App';
import { setServerLocation } from './lib/router';
import { provideRun, type GivenRun } from './lib/run';
import { findReport, registerReport, reportIdOf } from './report/library';
import type { Report } from './report/types';

export { NOT_FOUND, ROUTES, reportMeta } from './app/routes';
export { renderForEngine } from './lib/run';
export { reportIdOf } from './report/library';
export { fillShell } from './shell';

/** What a page is rendered with when it is rendered on request: a report the engine wrote, or a run. */
export interface Given {
  report?: Report;
  run?: GivenRun;
}

let rendering: Promise<unknown> = Promise.resolve();

/**
 * Render one page to HTML: at build time for the fixed pages, and on request
 * for a report the engine has written or a run, which are passed in. The
 * render waits for every lazily loaded page to resolve, so the markup is
 * complete; the client then hydrates it. The address and what is given are
 * shared by the whole render, so renders take turns.
 */
export function render(address: string, given: Given = {}): Promise<string> {
  const page = rendering.then(() => renderNow(address, given));
  rendering = page.catch(() => undefined);
  return page;
}

async function renderNow(address: string, given: Given): Promise<string> {
  if (given.report) registerReport(given.report);
  if (given.run) provideRun(given.run);
  setServerLocation(address);
  const { prelude } = await prerenderToNodeStream(
    <StrictMode>
      <App />
    </StrictMode>,
    // A page is a document: send it whole. React otherwise moves any content larger than
    // about 12.8 kB out of line, hidden until a script reveals it, so it would not read
    // without JavaScript and its main content would paint late.
    { progressiveChunkSize: Number.POSITIVE_INFINITY },
  );
  const chunks: Buffer[] = [];
  for await (const chunk of prelude) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  return Buffer.concat(chunks).toString('utf8');
}

/** schema.org data for a page, written into its HTML for search engines. */
export function structuredData(path: string, given?: Report): Record<string, unknown> | undefined {
  if (path === '/')
    return {
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      name: 'Uncovered',
      description:
        'Initiation-of-coverage research on any company, listed or private, with every figure traced to its source.',
    };
  const id = reportIdOf(path);
  const report = given ?? (id ? findReport(id) : undefined);
  if (!report) return undefined;
  const c = report.company;
  return {
    '@context': 'https://schema.org',
    '@type': 'Report',
    name: `${c.legalName}: initiation of coverage`,
    headline: report.headline,
    datePublished: report.date,
    inLanguage: 'en',
    author: { '@type': 'Organization', name: report.analyst },
    about: {
      '@type': 'Corporation',
      name: c.legalName,
      ...(c.website ? { url: c.website } : {}),
      ...(c.ticker ? { tickerSymbol: c.ticker } : {}),
      ...(c.founded ? { foundingDate: String(c.founded) } : {}),
    },
    citation: [...new Map(report.sources.map((s) => [s.url, s])).values()].map((s) => ({
      '@type': 'CreativeWork',
      name: s.title,
      url: s.url,
      publisher: s.publisher,
    })),
  };
}
