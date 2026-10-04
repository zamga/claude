import { dec, type Big } from './decimal';

/**
 * Declared P/E scenario model (spec page 36).
 *
 *   next-year revenue  = base revenue x (1 + revenue growth)
 *   operating income   = next-year revenue x operating margin
 *   net income         = operating income x (1 - tax rate)
 *   EPS                = net income / diluted shares
 *   value per share    = EPS x exit P/E
 *
 * The operating margin is never multiplied directly by a P/E: earnings are derived first.
 * Missing or contradictory inputs return an explanation instead of a value.
 */

export const MODEL_VERSION = 'pe-v1';

export interface ModelBase {
  /** Trailing-twelve-month revenue, in billions of the native currency. */
  baseRevenueB: string;
  /** Diluted shares outstanding, in billions. */
  dilutedSharesB: string;
  /** Effective tax rate in percent. */
  taxRatePct: string;
  currency: 'USD' | 'EUR';
  /** Reference price used for comparison and its observation time. */
  referencePrice: string;
  referenceAt: number;
}

export interface ScenarioAssumptions {
  revenueGrowthPct: string | null;
  operatingMarginPct: string | null;
  exitPe: string | null;
}

export type ScenarioName = 'bear' | 'base' | 'bull';

export interface ScenarioResult {
  ok: true;
  revenueB: Big;
  operatingIncomeB: Big;
  netIncomeB: Big;
  eps: Big;
  valuePerShare: Big;
  vsReferencePct: Big;
}

export interface ScenarioFailure {
  ok: false;
  reason: string;
}

function missing(value: string | null): boolean {
  return value == null || value.trim() === '';
}

export function evaluateScenario(
  base: ModelBase,
  assumptions: ScenarioAssumptions,
): ScenarioResult | ScenarioFailure {
  if (missing(assumptions.revenueGrowthPct))
    return { ok: false, reason: 'Add a revenue growth assumption to calculate a value.' };
  if (missing(assumptions.operatingMarginPct))
    return { ok: false, reason: 'Add an operating margin assumption to calculate a value.' };
  if (missing(assumptions.exitPe))
    return { ok: false, reason: 'Add an exit P/E multiple to calculate a value.' };

  const growth = dec(assumptions.revenueGrowthPct!).div(100);
  const margin = dec(assumptions.operatingMarginPct!).div(100);
  const multiple = dec(assumptions.exitPe!);
  const tax = dec(base.taxRatePct).div(100);
  const shares = dec(base.dilutedSharesB);

  if (growth.lte(-1)) return { ok: false, reason: 'Revenue growth must be above −100%.' };
  if (margin.lte(0) || margin.gte(1)) {
    return {
      ok: false,
      reason: 'Operating margin must be between 0% and 100% for a P/E valuation.',
    };
  }
  if (multiple.lte(0))
    return { ok: false, reason: 'A P/E valuation needs a positive exit multiple.' };
  if (shares.lte(0)) return { ok: false, reason: 'Diluted shares must be positive.' };
  if (tax.lt(0) || tax.gte(1))
    return { ok: false, reason: 'Tax rate must be between 0% and 100%.' };

  const revenueB = dec(base.baseRevenueB).times(growth.plus(1));
  const operatingIncomeB = revenueB.times(margin);
  const netIncomeB = operatingIncomeB.times(dec(1).minus(tax));
  const eps = netIncomeB.div(shares);
  const valuePerShare = eps.times(multiple);
  const vsReferencePct = valuePerShare.div(dec(base.referencePrice)).minus(1).times(100);
  return { ok: true, revenueB, operatingIncomeB, netIncomeB, eps, valuePerShare, vsReferencePct };
}

export interface SensitivityControl {
  min: number;
  max: number;
  step: number;
  unit: string;
}

export const EXIT_MULTIPLE_RANGE: SensitivityControl = { min: 18, max: 40, step: 1, unit: '×' };

export function clampToStep(value: number, control: SensitivityControl): number {
  const clamped = Math.min(Math.max(value, control.min), control.max);
  const steps = Math.round((clamped - control.min) / control.step);
  return Number((control.min + steps * control.step).toFixed(6));
}
