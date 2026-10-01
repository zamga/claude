import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GET } from './company';

const facts = {
  cik: 7654321,
  entityName: 'Sample Instruments Corp',
  facts: {
    dei: {
      EntityCommonStockSharesOutstanding: {
        units: { shares: [{ end: '2026-02-10', val: 500_000_000, form: '10-K', filed: '2026-02-20' }] },
      },
    },
    'us-gaap': {
      Revenues: {
        units: {
          USD: [2022, 2023, 2024, 2025].map((y, i) => ({
            start: `${y}-01-01`,
            end: `${y}-12-31`,
            val: (1000 + i * 100) * 1e6,
            fp: 'FY',
            form: '10-K',
            filed: `${y + 1}-02-20`,
          })),
        },
      },
      OperatingIncomeLoss: {
        units: {
          USD: [2022, 2023, 2024, 2025].map((y, i) => ({
            start: `${y}-01-01`,
            end: `${y}-12-31`,
            val: (150 + i * 20) * 1e6,
            fp: 'FY',
            form: '10-K',
            filed: `${y + 1}-02-20`,
          })),
        },
      },
      CashAndCashEquivalentsAtCarryingValue: {
        units: { USD: [{ end: '2025-12-31', val: 300e6, form: '10-K', filed: '2026-02-20' }] },
      },
    },
  },
};

function respond(body: unknown, status = 200) {
  return Promise.resolve(new Response(JSON.stringify(body), { status }));
}

describe('GET /api/company', () => {
  beforeEach(() => {
    vi.stubEnv('SEC_USER_AGENT', 'Plimsoll tests@example.com');
    vi.stubEnv('ALPHAVANTAGE_API_KEY', '');
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('rejects a malformed ticker', async () => {
    const res = await GET(new Request('https://x.test/api/company?ticker=%3Cscript%3E'));
    expect(res.status).toBe(400);
  });

  it('refuses to call SEC without a user agent', async () => {
    vi.stubEnv('SEC_USER_AGENT', '');
    const res = await GET(new Request('https://x.test/api/company?ticker=SMPL'));
    expect(res.status).toBe(500);
  });

  it('surveys a company from its filings', async () => {
    const fetchMock = vi.fn((url: string) => {
      if (url.endsWith('company_tickers.json')) return respond({ 0: { cik_str: 7654321, ticker: 'SMPL', title: 'Sample Instruments Corp' } });
      if (url.includes('/companyfacts/')) return respond(facts);
      if (url.includes('/submissions/')) return respond({ sic: '3674', sicDescription: 'Semiconductors & Related Devices' });
      return respond({}, 404);
    });
    vi.stubGlobal('fetch', fetchMock);
    const res = await GET(new Request('https://x.test/api/company?ticker=smpl'));
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toContain('s-maxage');
    const { company } = (await res.json()) as { company: Record<string, unknown> & { history: unknown[] } };
    expect(company.ticker).toBe('SMPL');
    expect(company.shortName).toBe('Sample Instruments');
    expect(company.industry).toBe('semiconductors');
    expect(company.history).toHaveLength(4);
    expect(company.price).toBeNull();
    // Every SEC request carries the fair-access user agent.
    for (const [, init] of fetchMock.mock.calls as unknown as Array<[string, RequestInit]>) {
      expect((init.headers as Record<string, string>)['User-Agent']).toBe('Plimsoll tests@example.com');
    }
  });

  it('reports unknown tickers', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string) =>
        url.endsWith('company_tickers.json') ? respond({ 0: { cik_str: 1, ticker: 'ONE', title: 'One' } }) : respond({}, 404),
      ),
    );
    const res = await GET(new Request('https://x.test/api/company?ticker=ZZZZ'));
    expect(res.status).toBe(404);
  });
});
