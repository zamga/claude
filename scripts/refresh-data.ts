/**
 * Re-survey the atlas from SEC EDGAR and report what changed.
 *
 *   SEC_USER_AGENT="Plimsoll you@example.com" npm run data:refresh
 *
 * Writes data/refresh-YYYY-MM-DD.json with the fresh figures and prints a
 * table of differences against src/data/companies.ts. Figures are reviewed
 * and merged by hand: data changes go through code review like any other.
 * Prices are not part of SEC data; update them with the chart datum.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { COMPANIES } from '../src/data/companies.ts';
import { normaliseCompanyFacts, SEC_ENDPOINTS, type CompanyFacts } from '../src/data/sec.ts';

const agent = process.env.SEC_USER_AGENT;
if (!agent) {
  console.error('Set SEC_USER_AGENT to "<app name> <contact email>" as SEC fair-access rules require.');
  process.exit(1);
}
const headers = { 'User-Agent': agent, Accept: 'application/json' };
const pause = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return (await res.json()) as T;
}

const index = await getJson<Record<string, { cik_str: number; ticker: string }>>(SEC_ENDPOINTS.tickers);
const ciks = new Map(Object.values(index).map((r) => [r.ticker.toUpperCase(), r.cik_str]));

const results: Record<string, unknown> = {};
const rows: string[] = [];
for (const company of COMPANIES) {
  const cik = ciks.get(company.ticker);
  if (!cik) {
    rows.push(`${company.ticker.padEnd(6)} not found in SEC ticker list`);
    continue;
  }
  try {
    const survey = normaliseCompanyFacts(await getJson<CompanyFacts>(SEC_ENDPOINTS.facts(cik)));
    results[company.ticker] = survey;
    const now = company.history.at(-1)!;
    const fresh = survey.history.at(-1)!;
    const delta = (a: number, b: number) => (a === 0 ? 'n/a' : `${(((b - a) / Math.abs(a)) * 100).toFixed(1)}%`);
    rows.push(
      `${company.ticker.padEnd(6)} ${company.fiscalYearLabel} → ${survey.fiscalYearLabel}  revenue ${delta(
        now.revenue,
        fresh.revenue,
      ).padStart(7)}  operating income ${delta(now.operatingIncome, fresh.operatingIncome).padStart(7)}`,
    );
  } catch (err) {
    rows.push(`${company.ticker.padEnd(6)} failed: ${(err as Error).message}`);
  }
  await pause(150); // Stay well under SEC's ten requests a second.
}

mkdirSync('data', { recursive: true });
const file = `data/refresh-${new Date().toISOString().slice(0, 10)}.json`;
writeFileSync(file, JSON.stringify(results, null, 2));
console.log(rows.join('\n'));
console.log(`\nWrote ${file}. Review the differences, then update src/data/companies.ts.`);
