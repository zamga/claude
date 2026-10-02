const nf = (min: number, max = min) =>
  new Intl.NumberFormat('en-GB', { minimumFractionDigits: min, maximumFractionDigits: max });

const NF0 = nf(0);
const NF1 = nf(1);
const NF2 = nf(2);

/** Typographic minus for negative numbers. */
const sign = (v: number, s: string) => (v < 0 ? `−${s.replace('-', '')}` : s);

/** A coordinate or ratio cut to `n` decimals for markup, where further digits only add bytes. */
export function places(v: number, n = 2): number {
  const k = 10 ** n;
  return Math.round(v * k) / k;
}

export function eur(v: number, digits = 2): string {
  const f = digits === 0 ? NF0 : digits === 1 ? NF1 : NF2;
  return sign(v, `€${f.format(Math.abs(v))}`);
}

export function eurm(v: number, digits = 1): string {
  return sign(v, `€${(digits === 0 ? NF0 : NF1).format(Math.abs(v))}m`);
}

export function eurbn(v: number): string {
  return `€${NF2.format(v / 1000)}bn`;
}

export function num(v: number, digits = 1): string {
  return sign(v, (digits === 0 ? NF0 : digits === 1 ? NF1 : NF2).format(Math.abs(v)));
}

export function pct(v: number, digits = 1): string {
  return sign(v, `${(digits === 0 ? NF0 : digits === 1 ? NF1 : NF2).format(Math.abs(v * 100))}%`);
}

export function signedPct(v: number, digits = 1): string {
  return v > 0 ? `+${pct(v, digits)}` : pct(v, digits);
}

const DATE = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });

export function longDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  return Number.isNaN(d.getTime()) ? iso : DATE.format(d);
}

/* ---------- Money in a report's own currency ---------- */

const MONEY = new Map<string, Intl.NumberFormat>();

function moneyFormat(currency: string, digits: number): Intl.NumberFormat {
  const key = `${currency}:${digits}`;
  let f = MONEY.get(key);
  if (!f) {
    f = new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency,
      currencyDisplay: 'narrowSymbol',
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    });
    MONEY.set(key, f);
  }
  return f;
}

/** An amount, such as a value per share: "€262.50", "zł 41.20". */
export function money(v: number, digits = 2, currency = 'EUR'): string {
  return sign(v, moneyFormat(currency, digits).format(Math.abs(v)));
}

/** Millions: "€2,041.0m". */
export function moneyM(v: number, digits = 1, currency = 'EUR'): string {
  return `${money(v, digits, currency)}m`;
}

/** The symbol a currency is written with, such as "€" or "Kč". */
export function currencySymbol(currency = 'EUR'): string {
  return (
    moneyFormat(currency, 0)
      .formatToParts(0)
      .find((p) => p.type === 'currency')?.value ?? currency
  );
}

/**
 * Formatters for one report: money in its currency, and values in its
 * valuation basis (per share, or the whole of the equity in millions).
 */
export interface Money {
  currency: string;
  symbol: string;
  /** An amount per share or per unit. */
  amount: (v: number, digits?: number) => string;
  /** Millions. */
  millions: (v: number, digits?: number) => string;
  /** A value in the report's basis: per share for 'share', millions for 'equity'. */
  value: (v: number, digits?: number) => string;
  /** How values in the basis are described: "a share" or "for the equity". */
  per: string;
}

export function moneyFor(currency = 'EUR', basis: 'share' | 'equity' = 'share'): Money {
  const amount = (v: number, digits = 2) => money(v, digits, currency);
  const millions = (v: number, digits = 1) => moneyM(v, digits, currency);
  return {
    currency,
    symbol: currencySymbol(currency),
    amount,
    millions,
    value: basis === 'share' ? (v, digits = 2) => amount(v, digits) : (v, digits = 0) => millions(v, digits),
    per: basis === 'share' ? 'a share' : 'for the equity',
  };
}
