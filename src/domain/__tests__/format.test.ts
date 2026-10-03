import { describe, expect, it } from 'vitest';
import {
  formatClockWithZone,
  formatCompactMoney,
  formatMoney,
  formatPercent,
  formatPoints,
  formatQuantity,
  formatSignedMoney,
  keepFilingCodesWhole,
  relativeDayLabel,
  UNAVAILABLE,
  zoneLabel,
} from '../format';

describe('formatting', () => {
  it('formats native-currency money with a typographic minus', () => {
    expect(formatMoney('142.8', 'USD')).toBe('$142.80');
    expect(formatMoney('648.2', 'EUR')).toBe('€648.20');
    expect(formatMoney('-12.4', 'USD')).toBe('−$12.40');
    expect(formatMoney('26240', 'USD')).toBe('$26,240.00');
  });

  it('never renders missing data as zero', () => {
    expect(formatMoney(null, 'USD')).toBe(UNAVAILABLE);
    expect(formatMoney('', 'USD')).toBe(UNAVAILABLE);
    expect(formatPercent(null)).toBe(UNAVAILABLE);
  });

  it('signs changes', () => {
    expect(formatPercent('2.3436')).toBe('+2.34%');
    expect(formatPercent('-0.478')).toBe('−0.48%');
    expect(formatPercent('0')).toBe('0.00%');
    expect(formatSignedMoney('296', 'USD')).toBe('+$296.00');
    expect(formatPoints('1.6')).toBe('+1.6 pp');
  });

  it('compacts large figures and trims quantities', () => {
    expect(formatCompactMoney('1200000000', 'USD')).toBe('$1.2B');
    expect(formatQuantity('20')).toBe('20');
    expect(formatQuantity('0.125')).toBe('0.125');
  });

  it('labels zones', () => {
    const t = Date.UTC(2026, 9, 21, 18, 25);
    expect(formatClockWithZone(t, 'America/New_York')).toBe('14:25 ET');
    expect(zoneLabel(t, 'Europe/Ljubljana')).toBe('CEST');
    expect(zoneLabel(Date.UTC(2026, 10, 2), 'Europe/Ljubljana')).toBe('CET');
  });

  it('labels relative days in the user zone', () => {
    const now = Date.UTC(2026, 9, 21, 18, 25);
    expect(relativeDayLabel(Date.UTC(2026, 9, 21, 7), now, 'Europe/Ljubljana')).toBe('Today');
    expect(relativeDayLabel(Date.UTC(2026, 9, 20, 7), now, 'Europe/Ljubljana')).toBe('Yesterday');
    expect(relativeDayLabel(Date.UTC(2026, 9, 18, 7), now, 'Europe/Ljubljana')).toBe('Sun 18 Oct');
  });

  it('keeps filing codes on one line without changing what is read', () => {
    expect(keepFilingCodesWhole('Quarterly report (Form 10-Q), Q2 FY2027')).toBe(
      'Quarterly report (Form\u00a010-\u2060Q), Q2 FY2027',
    );
    expect(keepFilingCodesWhole('Registration statement (Form S-1/A), amendment 3')).toBe(
      'Registration statement (Form\u00a0S-\u20601/A), amendment 3',
    );
    expect(keepFilingCodesWhole('A year-on-year COVID-19 comparison')).toBe(
      'A year-on-year COVID-19 comparison',
    );
  });
});
