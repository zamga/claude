import { describe, expect, it } from 'vitest';
import { clampToStep, EXIT_MULTIPLE_RANGE, evaluateScenario, type ModelBase } from '../valuation';

const base: ModelBase = {
  baseRevenueB: '267.0',
  dilutedSharesB: '24.40',
  taxRatePct: '15',
  currency: 'USD',
  referencePrice: '142.80',
  referenceAt: 0,
};

describe('P/E scenario model', () => {
  it('derives EPS before applying the multiple', () => {
    const result = evaluateScenario(base, {
      revenueGrowthPct: '24',
      operatingMarginPct: '48',
      exitPe: '28',
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.eps.toFixed(4)).toBe('5.5361');
    expect(result.valuePerShare.round(0).toFixed()).toBe('155');
    expect(result.vsReferencePct.round(0).toFixed()).toBe('9');
  });

  it('bear and bull cases respond to their own assumptions', () => {
    const bear = evaluateScenario(base, {
      revenueGrowthPct: '12',
      operatingMarginPct: '45',
      exitPe: '22',
    });
    const bull = evaluateScenario(base, {
      revenueGrowthPct: '30',
      operatingMarginPct: '50',
      exitPe: '32',
    });
    expect(bear.ok && bear.valuePerShare.round(0).toFixed()).toBe('103');
    expect(bull.ok && bull.valuePerShare.round(0).toFixed()).toBe('193');
  });

  it('explains missing or contradictory inputs instead of producing a value', () => {
    expect(
      evaluateScenario(base, { revenueGrowthPct: null, operatingMarginPct: '48', exitPe: '28' }),
    ).toEqual({
      ok: false,
      reason: 'Add a revenue growth assumption to calculate a value.',
    });
    expect(
      evaluateScenario(base, { revenueGrowthPct: '10', operatingMarginPct: '120', exitPe: '28' })
        .ok,
    ).toBe(false);
    expect(
      evaluateScenario(base, { revenueGrowthPct: '10', operatingMarginPct: '40', exitPe: '0' }).ok,
    ).toBe(false);
  });

  it('snaps sensitivity input to its declared step', () => {
    expect(clampToStep(27.6, EXIT_MULTIPLE_RANGE)).toBe(28);
    expect(clampToStep(99, EXIT_MULTIPLE_RANGE)).toBe(EXIT_MULTIPLE_RANGE.max);
  });
});
