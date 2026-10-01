/** Typographic minus (U+2212), the correct glyph for negative figures. */
export const MINUS = '−';

const withMinus = (s: string) => s.replace(/^-/, MINUS);

const usd2 = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const usd0 = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

/** A per-share price: $254.63, or $1,204 above a thousand. */
export function formatPrice(v: number): string {
  if (!Number.isFinite(v)) return '—';
  return withMinus(Math.abs(v) >= 1000 ? usd0.format(v) : usd2.format(v));
}

/** USD millions to a compact figure: $1.24T, $391.0B, $845M. */
export function formatMoney(millions: number): string {
  if (!Number.isFinite(millions)) return '—';
  const abs = Math.abs(millions);
  const sign = millions < 0 ? MINUS : '';
  if (abs >= 1e6) return `${sign}$${(abs / 1e6).toFixed(abs >= 1e7 ? 1 : 2)}T`;
  if (abs >= 1e3) return `${sign}$${(abs / 1e3).toFixed(abs >= 1e5 ? 0 : 1)}B`;
  return `${sign}$${abs.toFixed(abs >= 100 ? 0 : 1)}M`;
}

/** 0.1234 → "12.3%". */
export function formatPct(v: number, digits = 1): string {
  if (!Number.isFinite(v)) return '—';
  return withMinus(`${(v * 100).toFixed(digits)}%`);
}

/** 0.1234 → "+12.3%", −0.04 → "−4.0%". */
export function formatSignedPct(v: number, digits = 1): string {
  if (!Number.isFinite(v)) return '—';
  const s = (Math.abs(v) * 100).toFixed(digits);
  if (Number(s) === 0) return `${(0).toFixed(digits)}%`;
  return `${v > 0 ? '+' : MINUS}${s}%`;
}

/** Percentage points: 0.031 → "3.1 pts". */
export function formatPts(v: number, digits = 1): string {
  return withMinus(`${(v * 100).toFixed(digits)} pts`);
}

export function formatMultiple(v: number): string {
  if (!Number.isFinite(v) || v <= 0) return 'n/m';
  return `${v >= 100 ? v.toFixed(0) : v.toFixed(1)}×`;
}

/** Shares in millions → "14.84B". */
export function formatShares(millions: number): string {
  return millions >= 1000 ? `${(millions / 1000).toFixed(2)}B` : `${millions.toFixed(0)}M`;
}

const dateFmt = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC',
});

/** ISO date → "30 Sep 2026". */
export function formatDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  return Number.isNaN(d.getTime()) ? iso : dateFmt.format(d);
}

/** A probability as a whole percentage with words for the extremes. */
export function formatOdds(p: number): string {
  if (!Number.isFinite(p)) return '—';
  if (p > 0.995) return '>99%';
  if (p < 0.005) return '<1%';
  return `${Math.round(p * 100)}%`;
}
