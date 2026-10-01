import { describe, expect, it } from 'vitest';
import { agrees, contains, parsePrinted, proseNumbers, quotationProblem, searchable, sourceNumbers } from './normalize';

describe('quotations are found as written', () => {
  const page = searchable(
    'Čisti prihodki od prodaje so v letu 2025 znašali 48.312.904 EUR in so bili za 6,4 % višji kot v letu 2024.\nDružba je obra-\nčunala “dobiček” — rekordni.',
  );

  it('finds a passage across case, spacing and line breaks', () => {
    expect(contains(page, 'čisti prihodki od prodaje so v letu 2025   znašali 48.312.904 EUR')).toBe(true);
  });

  it('forgives typographic quotes, dashes and words broken across lines', () => {
    expect(contains(page, 'Družba je obračunala "dobiček" - rekordni.')).toBe(true);
  });

  it('does not forgive a changed word or number', () => {
    expect(contains(page, 'Čisti prihodki od prodaje so v letu 2025 znašali 48.312.905 EUR')).toBe(false);
    expect(contains(page, 'Prihodki od prodaje so v letu 2025 znašali 48.312.904 EUR')).toBe(true);
    expect(contains(page, 'Neto prihodki od prodaje so v letu 2025 znašali 48.312.904 EUR')).toBe(false);
  });

  it('refuses quotations that skip words or are too short to place', () => {
    expect(quotationProblem('Revenue rose … to €2bn in 2025.')).toMatch(/leaves words out/);
    expect(quotationProblem('2,041.0')).toMatch(/too short/);
    expect(quotationProblem('The Krka Group generated revenue of €2,041.0 million.')).toBeUndefined();
  });
});

describe('numbers as printed', () => {
  it('reads Slovenian and English conventions by the decimal mark given', () => {
    expect(parsePrinted('48.312.904', ',')).toBe(48312904);
    expect(parsePrinted('2.041,0', ',')).toBe(2041);
    expect(parsePrinted('6,4', ',')).toBe(6.4);
    expect(parsePrinted('2,041.0', '.')).toBe(2041);
    expect(parsePrinted('1 234,5', ',')).toBe(1234.5);
    expect(parsePrinted('€370.6', '.')).toBe(370.6);
  });

  it('reads negatives in parentheses or with a minus sign', () => {
    expect(parsePrinted('(1.234)', ',')).toBe(-1234);
    expect(parsePrinted('−5,2', ',')).toBe(-5.2);
  });

  it('rejects a number that does not fit the convention', () => {
    expect(parsePrinted('48.312.904', '.')).toBeUndefined();
    expect(parsePrinted('1,23,456', '.')).toBeUndefined();
    expect(parsePrinted('n/a', '.')).toBeUndefined();
  });

  it('collects every value a passage could mean', () => {
    const values = sourceNumbers('Revenue €2,041.0 million; EBITDA 27,4 %; 48.312.904 EUR');
    expect(values).toContain(2041);
    expect(values).toContain(27.4);
    expect(values).toContain(48312904);
  });
});

describe('numbers in prose', () => {
  it('finds figures and skips years, periods, dates and markers', () => {
    const found = proseNumbers(
      'In 2025 revenue rose 6.4% to €48.3m[^p12]; H1 2026 and FY2025 and 2026E are periods, as is 31 December. A 10-year yield of {{rf}}.',
    ).map((n) => n.text.trim());
    expect(found).toEqual(['6.4%', '48.3m']);
  });

  it('agrees with a source at another scale, within the rounding shown', () => {
    const [m] = proseNumbers('€48.3m');
    expect(agrees(m!, [48312904])).toBe(true);
    const [bn] = proseNumbers('€2.0bn');
    expect(agrees(bn!, [2041])).toBe(true);
    const [p] = proseNumbers('6.4%');
    expect(agrees(p!, [6.4])).toBe(true);
    expect(agrees(p!, [6.6])).toBe(false);
  });
});
