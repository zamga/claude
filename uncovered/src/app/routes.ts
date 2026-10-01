import { useEffect } from 'react';

/*
 * Every page's title and description, in one place: the prerender writes them
 * into each page's HTML, and the client keeps them current as you navigate.
 */
export interface RouteMeta {
  path: string;
  title: string;
  description: string;
}

export const ROUTES: RouteMeta[] = [
  {
    path: '/',
    title: 'Uncovered · Initiating coverage on every company',
    description:
      'Uncovered researches any company, listed or private, and writes the initiation-of-coverage report a bank’s research desk would publish: thesis, financials, forecasts, valuation and risks, with every figure traced to its source.',
  },
  {
    path: '/report/krka',
    title: 'Krka, d. d., Novo mesto: initiation of coverage · Uncovered',
    description:
      'A sample initiation of coverage on Krka, the Slovenian generic-pharmaceuticals maker: thesis, financials, a discounted-cash-flow model, dividends and multiples, risks, and 17 graded sources.',
  },
  {
    path: '/initiate',
    title: 'Initiate coverage · Uncovered',
    description:
      'Commission an initiation on any company. Name it and what you need to know, attach filings if you have them, and see the research plan Uncovered would follow.',
  },
  {
    path: '/method',
    title: 'Method · Uncovered',
    description:
      'How Uncovered stays honest: evidence grades on every figure, prose bound to the model, the valuation formulas, primary sources by jurisdiction, and the limits of an initiation.',
  },
];

export const NOT_FOUND: RouteMeta = {
  path: '/404',
  title: 'No coverage found · Uncovered',
  description: 'Nobody has written anything at this address yet.',
};

export function metaFor(path: string): RouteMeta {
  return ROUTES.find((r) => r.path === path) ?? NOT_FOUND;
}

/** Keep the document's title and description in step with the page on screen. */
export function usePageMeta(path: string) {
  useEffect(() => {
    const meta = metaFor(path);
    document.title = meta.title;
    document.querySelector('meta[name="description"]')?.setAttribute('content', meta.description);
  }, [path]);
}
