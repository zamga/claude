/**
 * GET /api/company?ticker=AAPL
 *
 * Surveys any SEC-registered company live: annual figures from EDGAR XBRL
 * "companyfacts", industry from the filer's SIC code, and (when an Alpha
 * Vantage key is configured) the latest closing price. Responses are cached
 * at the edge for six hours.
 *
 * Environment:
 *   SEC_USER_AGENT        required by SEC fair-access rules, e.g. "Plimsoll ops@example.com"
 *   ALPHAVANTAGE_API_KEY  optional; without it the price is null and the visitor sets it
 */
import { industryForSic, normaliseCompanyFacts, SEC_ENDPOINTS, type CompanyFacts } from '../src/data/sec.ts';
import { INDUSTRIES } from '../src/data/market.ts';
import type { CompanySnapshot } from '../src/data/types.ts';

export type LiveSnapshot = Omit<CompanySnapshot, 'price'> & { price: CompanySnapshot['price'] | null };

const TICKER = /^[A-Z][A-Z0-9.-]{0,9}$/;
let tickerIndex: Map<string, { cik: number; title: string }> | null = null;

function json(body: unknown, status = 200, cache = 'no-store') {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': cache },
  });
}

async function getJson<T>(url: string, headers: Record<string, string>): Promise<T> {
  const res = await fetch(url, { headers, signal: AbortSignal.timeout(9000) });
  if (!res.ok) throw new Error(`${res.status} from ${new URL(url).host}`);
  return (await res.json()) as T;
}

async function lookupCik(ticker: string, headers: Record<string, string>) {
  if (!tickerIndex) {
    const raw = await getJson<Record<string, { cik_str: number; ticker: string; title: string }>>(
      SEC_ENDPOINTS.tickers,
      headers,
    );
    tickerIndex = new Map(Object.values(raw).map((r) => [r.ticker.toUpperCase(), { cik: r.cik_str, title: r.title }]));
  }
  return tickerIndex.get(ticker) ?? tickerIndex.get(ticker.replace('.', '-')) ?? null;
}

async function latestClose(ticker: string, key: string) {
  const url = `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${encodeURIComponent(ticker)}&apikey=${key}`;
  const data = await getJson<{ 'Global Quote'?: Record<string, string> }>(url, {});
  const q = data['Global Quote'];
  const value = Number(q?.['05. price']);
  const asOf = q?.['07. latest trading day'];
  return value > 0 && asOf ? { value, asOf, source: 'Latest close (Alpha Vantage)' } : null;
}

export async function GET(request: Request): Promise<Response> {
  const ticker = (new URL(request.url).searchParams.get('ticker') ?? '').trim().toUpperCase();
  if (!TICKER.test(ticker)) return json({ error: 'Ask for a ticker, for example ?ticker=AAPL.' }, 400);

  const agent = process.env.SEC_USER_AGENT;
  if (!agent) return json({ error: 'The server is missing SEC_USER_AGENT.' }, 500);
  const headers = { 'User-Agent': agent, Accept: 'application/json' };

  try {
    const entry = await lookupCik(ticker, headers);
    if (!entry) return json({ error: `${ticker} is not in the SEC’s list of filers.` }, 404, 'public, s-maxage=86400');

    const [facts, submissions] = await Promise.all([
      getJson<CompanyFacts>(SEC_ENDPOINTS.facts(entry.cik), headers),
      getJson<{ sic?: string; sicDescription?: string; name?: string }>(SEC_ENDPOINTS.submissions(entry.cik), headers),
    ]);
    const survey = normaliseCompanyFacts(facts);
    const industry = industryForSic(submissions.sic ? Number(submissions.sic) : null);
    const key = process.env.ALPHAVANTAGE_API_KEY;
    const price = key ? await latestClose(ticker, key).catch(() => null) : null;
    const shares = survey.sharesOutstanding ?? {
      value: survey.latest.dilutedShares ?? 0,
      asOf: survey.fiscalYearEnd,
    };
    if (!(shares.value > 0)) return json({ error: `No share count found in ${ticker}’s filings.` }, 422);

    const snapshot: LiveSnapshot = {
      ticker,
      name: survey.name,
      shortName: entry.title.replace(/,?\s+(Inc\.?|Corp(oration)?\.?|Co\.?|Ltd\.?|plc|N\.V\.|S\.A\.)$/i, ''),
      industry,
      industryLabel: submissions.sicDescription ?? INDUSTRIES[industry].label,
      blurb: 'Surveyed live from its SEC filings.',
      fiscalYearLabel: survey.fiscalYearLabel,
      fiscalYearEnd: survey.fiscalYearEnd,
      history: survey.history,
      latest: survey.latest,
      sharesOutstanding: shares,
      price,
      sources: [
        {
          label: 'SEC EDGAR filings',
          url: `https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=${entry.cik}&type=10-K`,
        },
      ],
      notes:
        'Surveyed automatically from XBRL data. Lines a company tags unusually may be missing; check the filing before relying on a figure.',
    };
    return json({ company: snapshot }, 200, 'public, s-maxage=21600, stale-while-revalidate=86400');
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return json({ error: `Could not survey ${ticker}: ${message}` }, 502);
  }
}
