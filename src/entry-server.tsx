import { StrictMode } from 'react';
import { prerender } from 'react-dom/static';
import { App } from './app/App';
import { setServerLocation } from './lib/router';
import { COMPANIES } from './data/companies';
import { formatPrice } from './engine/format';
import { marketGrowthLine } from './model/copy';
import { quickChart } from './model/quickChart';

/**
 * Build-time rendering. Every public route is rendered to static HTML so the
 * headline paints before any script runs and search engines read the
 * valuation, then the client hydrates it.
 */
export async function render(path: string): Promise<string> {
  setServerLocation(path);
  const { prelude } = await prerender(
    <StrictMode>
      <App />
    </StrictMode>,
    {
      // Never outline a Suspense boundary. By default React writes any boundary
      // over 12.8 KB as a fallback plus a script that swaps the real content in,
      // and it throttles that reveal: the page would paint empty, then jump.
      progressiveChunkSize: Number.MAX_SAFE_INTEGER,
    },
  );
  return new Response(prelude).text();
}

export interface RouteMeta {
  path: string;
  title: string;
  description: string;
}

const DEFAULT_DESCRIPTION =
  'Plimsoll charts what a company is worth under every story you could tell about it, and draws the coastline the market is already betting on.';

export function routes(): RouteMeta[] {
  return [
    { path: '/', title: 'Plimsoll · The price is sea level', description: DEFAULT_DESCRIPTION },
    {
      path: '/atlas',
      title: 'Atlas of company valuations · Plimsoll',
      description: `${COMPANIES.length} companies on one chart window: what each share price assumes about growth and margins.`,
    },
    {
      path: '/method',
      title: 'Method: how the chart is drawn · Plimsoll',
      description:
        'The discounted-cash-flow model, reverse DCF, Monte Carlo soundings and default assumptions behind every Plimsoll chart.',
    },
    {
      path: '/survey',
      title: 'Survey your own company · Plimsoll',
      description: 'Value a private company, a startup or your employer from seven figures, and see what a price implies.',
    },
    ...COMPANIES.map((c) => {
      const q = quickChart(c, 80);
      return {
        path: `/chart/${c.ticker.toLowerCase()}`,
        title: `${c.shortName} valuation: what ${formatPrice(c.price.value)} assumes · Plimsoll`,
        description: `${marketGrowthLine(c.shortName, c.price.value, q.bearing.margin, q.marketGrowth)} Chart every story about ${c.shortName}.`,
      };
    }),
  ];
}
