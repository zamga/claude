/*
 * Text as the evidence checks compare it. A quotation counts as found in a
 * document when its normalised text occurs in the document's normalised text:
 * the same words in the same order, forgiving only what extraction changes
 * (case, spacing, line breaks, typographic quotes and dashes, ligatures, soft
 * hyphens and words broken across lines). Nothing else is forgiven.
 */

const DASHES = /[\u2010-\u2015\u2212\uFE58\uFE63\uFF0D]/g;
const SINGLE_QUOTES = /[\u2018\u2019\u201A\u201B\u2032\u00B4`]/g;
const DOUBLE_QUOTES = /[\u201C\u201D\u201E\u201F\u2033\u00AB\u00BB]/g;

/** Lower case, one kind of quote and dash, single spaces; column separators read as spaces. */
export function norm(text: string): string {
  return text
    .normalize('NFKC')
    .replace(/\u00AD/g, '')
    .replace(DASHES, '-')
    .replace(SINGLE_QUOTES, "'")
    .replace(DOUBLE_QUOTES, '"')
    .replace(/\u2026/g, '...')
    .replace(/\|/g, ' ')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/** Normalised text with no spaces or hyphens, for text whose spacing extraction may have changed. */
export function compact(text: string): string {
  return norm(text).replace(/[\s-]/g, '');
}

/** A text prepared once for repeated searching. */
export interface Searchable {
  norm: string;
  compact: string;
}

export function searchable(text: string): Searchable {
  return { norm: norm(text), compact: compact(text) };
}

/** Whether a passage occurs in a text: word for word, or with only spacing and hyphenation changed. */
export function contains(haystack: Searchable, needle: string): boolean {
  const n = norm(needle);
  if (!n) return false;
  if (haystack.norm.includes(n)) return true;
  const c = compact(needle);
  return c.length >= 8 && haystack.compact.includes(c);
}

/** Why a quotation cannot be checked as written, if it cannot. */
export function quotationProblem(quote: string): string | undefined {
  const q = quote.trim();
  if (q.length < 12)
    return 'The quotation is too short to identify the passage. Quote the whole sentence or table row.';
  if (q.length > 600)
    return 'The quotation is too long. Quote one sentence or one table row, at most about 400 characters.';
  if (/\.\.\.|…|\[\s*\.\.\.\s*\]/.test(q))
    return 'The quotation leaves words out. Quote one continuous passage exactly as it appears, with nothing skipped.';
  return undefined;
}

/* ---------- Numbers as printed ---------- */

export type DecimalMark = '.' | ',';

/**
 * Read a number as the document printed it, given the document's decimal
 * mark: "48.312.904" with ',' decimals is 48312904; "2,041.0" with '.' is
 * 2041. Parentheses and a leading minus make it negative. Returns undefined
 * when the text is not a well-formed number under that convention.
 */
export function parsePrinted(printed: string, decimal: DecimalMark): number | undefined {
  let s = printed.normalize('NFKC').trim();
  let negative = false;
  if (/^\(.*\)$/.test(s)) {
    negative = true;
    s = s.slice(1, -1).trim();
  }
  s = s.replace(DASHES, '-');
  if (s.startsWith('-')) {
    negative = !negative;
    s = s.slice(1).trim();
  }
  // Currency signs, percent signs and unit words around the number are not part of it.
  s = s.replace(/^[^\d]+/, '').replace(/[^\d]+$/, '');
  if (!s) return undefined;
  const group = decimal === '.' ? ',' : '.';
  const [whole = '', fraction, extra] = s.split(decimal);
  if (extra !== undefined) return undefined;
  // Thousands may be grouped by the other mark or by spaces, always in threes.
  const groups = whole.split(new RegExp(`[${group === '.' ? '.' : ','}\\s\\u00A0\\u202F\\u2009']`));
  if (groups.length > 1) {
    if (!/^\d{1,3}$/.test(groups[0]!)) return undefined;
    if (groups.slice(1).some((g) => !/^\d{3}$/.test(g))) return undefined;
  } else if (!/^\d+$/.test(whole)) return undefined;
  if (fraction !== undefined && !/^\d+$/.test(fraction)) return undefined;
  const value = Number(`${groups.join('')}${fraction !== undefined ? `.${fraction}` : ''}`);
  if (!Number.isFinite(value)) return undefined;
  return negative ? -value : value;
}

/** How many decimal places a printed number shows, under its decimal mark. */
export function printedDecimals(printed: string, decimal: DecimalMark): number {
  const s = printed.replace(/[^\d.,]/g, '');
  const i = s.lastIndexOf(decimal);
  return i < 0 ? 0 : s.length - i - 1;
}

/** Every value a passage's numbers could stand for, read with either decimal mark. */
export function sourceNumbers(text: string): number[] {
  const values = new Set<number>();
  const tokens = text.normalize('NFKC').match(/\d{1,3}(?:[.,\u00A0\u202F\u2009 ']\d{3})+(?:[.,]\d+)?|\d+(?:[.,]\d+)?/g);
  for (const token of tokens ?? []) {
    for (const mark of ['.', ','] as const) {
      const v = parsePrinted(token, mark);
      if (v !== undefined) values.add(v);
    }
    // A row of figures separated by spaces can read as one grouped number; keep each part too.
    if (/\s/.test(token))
      for (const part of token.split(/\s+/))
        for (const mark of ['.', ','] as const) {
          const v = parsePrinted(part, mark);
          if (v !== undefined) values.add(v);
        }
  }
  return [...values];
}

/* ---------- Numbers in prose ---------- */

const MONTHS =
  'january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|sept|oct|nov|dec';

/**
 * A number written in English prose, such as "€2,041.0m", "27.4%" or
 * "1.2bn". Years, dates, periods (H1 2026, Q3, FY2025, 2026E), ordinals and
 * compounds such as "10-year" are not figures and are skipped.
 */
export interface ProseNumber {
  text: string;
  value: number;
  /** Decimal places shown. */
  decimals: number;
  percent: boolean;
  index: number;
}

const NUMBER =
  /(?<![\w.,^])(\d{1,3}(?:,\d{3})+|\d+)(?:\.(\d+))?(?!\d)(\s?(?:%|per cent|percent|pp\b|bn\b|billion|m\b|million|k\b|thousand|×|x\b))?/gi;

/** Footnote markers and model tokens are not prose numbers; blank them out, keeping positions. */
export function withoutMarks(text: string): string {
  return text.replace(/\[\^[\w-]+\]|\{\{[\w.-]+\}\}/g, (m) => ' '.repeat(m.length));
}

export function proseNumbers(text: string): ProseNumber[] {
  const plain = withoutMarks(text);
  const out: ProseNumber[] = [];
  for (const m of plain.matchAll(NUMBER)) {
    const index = m.index ?? 0;
    const whole = m[1]!;
    const fraction = m[2];
    const suffix = (m[3] ?? '').trim().toLowerCase();
    const before = plain.slice(Math.max(0, index - 12), index);
    const after = plain.slice(index + whole.length + (fraction ? fraction.length + 1 : 0));
    const value = Number(whole.replace(/,/g, '') + (fraction ? `.${fraction}` : ''));
    const bare = !fraction && !suffix;
    // Years: 1900 to 2100 without separators or a suffix, including "1990s".
    if (bare && /^\d{4}$/.test(whole) && value >= 1900 && value <= 2100) continue;
    // Periods: "2026E", "2025A", "FY2025", "H1", "Q3", "9M 2026".
    if (/^[EAF]\b/.test(after) || /(?:FY|H|Q)$/i.test(before) || /^M\b/.test(after)) continue;
    // Dates: "14 May", "May 14".
    if (bare && new RegExp(`^\\s*(?:${MONTHS})\\b`, 'i').test(after)) continue;
    if (bare && new RegExp(`(?:${MONTHS})\\s*$`, 'i').test(before)) continue;
    // Ordinals and compounds: "27th", "10-year", "3-month".
    if (/^(?:st|nd|rd|th)\b/i.test(after)) continue;
    if (bare && /^-(?:year|month|week|day|hour|page|point)/i.test(after)) continue;
    out.push({ text: m[0], value, decimals: fraction?.length ?? 0, percent: /%|per ?cent|pp/.test(suffix), index });
  }
  return out;
}

/**
 * Whether a number written in prose agrees with one of the numbers a source
 * prints, allowing for a different scale (millions against units, thousands)
 * and for rounding to the places the prose shows.
 */
export function agrees(prose: ProseNumber, sourceValues: number[]): boolean {
  const tolerance = 0.5 * 10 ** -prose.decimals + 1e-9;
  for (const q of sourceValues)
    for (const k of [-9, -6, -3, 0, 3, 6, 9]) {
      if (Math.abs(Math.abs(q) * 10 ** k - prose.value) <= tolerance * (1 + 1e-12)) return true;
    }
  return false;
}
