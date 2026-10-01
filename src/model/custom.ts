import type { CompanySnapshot } from '../data/types';
import { readStored, writeStored } from '../lib/storage';

/**
 * A company the visitor surveys themselves: private firms, startups, an
 * employer. It needs only the figures a founder or employee is likely to
 * know; everything else defaults sensibly.
 */
export interface CustomEntry {
  name: string;
  revenue: number;
  /** Revenue a year earlier, for the growth trend. Optional. */
  priorRevenue: number | null;
  operatingIncome: number;
  cash: number;
  debt: number;
  /** Millions of shares (or units) outstanding. */
  shares: number;
  /** Reference price per share: last funding round, an offer, or a guess. */
  price: number;
  taxRate: number | null;
}

export const EXAMPLE_ENTRY: CustomEntry = {
  name: 'Harbour Coffee Roasters (example)',
  revenue: 42,
  priorRevenue: 35,
  operatingIncome: 4.2,
  cash: 6,
  debt: 3,
  shares: 10,
  price: 9.5,
  taxRate: 0.21,
};

export function customSnapshot(entry: CustomEntry, today = new Date().toISOString().slice(0, 10)): CompanySnapshot {
  const year = Number(today.slice(0, 4));
  const history = [
    ...(entry.priorRevenue !== null && entry.priorRevenue > 0
      ? [
          {
            fy: `FY${year - 1}`,
            revenue: entry.priorRevenue,
            operatingIncome: entry.operatingIncome * (entry.priorRevenue / entry.revenue),
          },
        ]
      : []),
    { fy: `FY${year}`, revenue: entry.revenue, operatingIncome: entry.operatingIncome },
  ];
  const tax = entry.taxRate ?? 0.21;
  const pretax = entry.operatingIncome;
  return {
    ticker: 'CUSTOM',
    name: entry.name,
    shortName: entry.name.replace(/\s*\(example\)\s*$/i, ''),
    industry: 'private',
    industryLabel: 'Surveyed by you',
    blurb: 'Figures entered by you. Nothing leaves this browser unless you share the link.',
    fiscalYearLabel: `FY${year}`,
    fiscalYearEnd: today,
    history,
    latest: {
      netIncome: pretax > 0 ? pretax * (1 - tax) : pretax,
      pretaxIncome: pretax,
      incomeTax: pretax > 0 ? pretax * tax : 0,
      dAndA: null,
      capex: null,
      cash: entry.cash,
      shortTermInvestments: 0,
      longTermInvestments: 0,
      totalDebt: entry.debt,
      nonOperatingAssets: 0,
      equity: null,
      minorityInterest: 0,
      dilutedShares: entry.shares,
    },
    sharesOutstanding: { value: entry.shares, asOf: today },
    price: { value: entry.price, asOf: today, source: 'Your reference price' },
    sources: [],
    custom: true,
  };
}

const KEY = 'custom-company';

export const loadCustom = () => readStored<CustomEntry>(KEY);
export const saveCustom = (entry: CustomEntry) => writeStored(KEY, entry);

/* Custom companies travel in share links as compact base64url JSON. */
export function encodeCustom(entry: CustomEntry): string {
  const json = JSON.stringify([
    entry.name.slice(0, 80),
    entry.revenue,
    entry.priorRevenue,
    entry.operatingIncome,
    entry.cash,
    entry.debt,
    entry.shares,
    entry.price,
    entry.taxRate,
  ]);
  const bytes = new TextEncoder().encode(json);
  let s = '';
  bytes.forEach((b) => (s += String.fromCharCode(b)));
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function decodeCustom(token: string): CustomEntry | null {
  try {
    const b64 = token.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((token.length + 3) % 4);
    const raw = atob(b64);
    const json = new TextDecoder().decode(Uint8Array.from(raw, (c) => c.charCodeAt(0)));
    const a = JSON.parse(json) as unknown[];
    if (!Array.isArray(a) || a.length !== 9) return null;
    const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
    const entry: CustomEntry = {
      name: typeof a[0] === 'string' && a[0].trim() ? a[0].slice(0, 80) : 'Your company',
      revenue: num(a[1]) ?? 0,
      priorRevenue: num(a[2]),
      operatingIncome: num(a[3]) ?? 0,
      cash: num(a[4]) ?? 0,
      debt: num(a[5]) ?? 0,
      shares: num(a[6]) ?? 0,
      price: num(a[7]) ?? 0,
      taxRate: num(a[8]),
    };
    return entry.revenue > 0 && entry.shares > 0 && entry.price > 0 ? entry : null;
  } catch {
    return null;
  }
}
