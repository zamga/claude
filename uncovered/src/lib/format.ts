const nf = (min: number, max = min) =>
  new Intl.NumberFormat('en-GB', { minimumFractionDigits: min, maximumFractionDigits: max });

const NF0 = nf(0);
const NF1 = nf(1);
const NF2 = nf(2);

/** Typographic minus for negative numbers. */
const sign = (v: number, s: string) => (v < 0 ? `−${s.replace('-', '')}` : s);

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
