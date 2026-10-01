import { StrictMode } from 'react';
import { prerenderToNodeStream } from 'react-dom/static';
import { App } from './app/App';
import { setServerLocation } from './lib/router';
import { KRKA } from './report/krka';

export { NOT_FOUND, ROUTES } from './app/routes';

/**
 * Render one page to HTML at build time. The prerender waits for every lazily
 * loaded page to resolve, so the markup is complete; the client then hydrates it.
 */
export async function render(path: string): Promise<string> {
  setServerLocation(path);
  const { prelude } = await prerenderToNodeStream(
    <StrictMode>
      <App />
    </StrictMode>,
  );
  const chunks: Buffer[] = [];
  for await (const chunk of prelude) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  return Buffer.concat(chunks).toString('utf8');
}

/** schema.org data for a page, written into its HTML for search engines. */
export function structuredData(path: string): Record<string, unknown> | undefined {
  if (path === '/')
    return {
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      name: 'Uncovered',
      description:
        'Initiation-of-coverage research on any company, listed or private, with every figure traced to its source.',
    };
  if (path === `/report/${KRKA.id}`) {
    const c = KRKA.company;
    return {
      '@context': 'https://schema.org',
      '@type': 'Report',
      name: `${c.legalName}: initiation of coverage`,
      headline: KRKA.headline,
      datePublished: KRKA.date,
      inLanguage: 'en',
      author: { '@type': 'Organization', name: KRKA.analyst },
      about: {
        '@type': 'Corporation',
        name: c.legalName,
        url: c.website,
        ...(c.ticker ? { tickerSymbol: c.ticker } : {}),
        foundingDate: String(c.founded),
      },
      citation: KRKA.sources.map((s) => ({
        '@type': 'CreativeWork',
        name: s.title,
        url: s.url,
        publisher: s.publisher,
      })),
    };
  }
  return undefined;
}
