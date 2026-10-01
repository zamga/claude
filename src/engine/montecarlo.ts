import { valuePerShare } from './dcf';
import { createRng, sampleTriangular } from './random';
import { percentile, shareAbove } from './stats';
import type { MonteCarloResult, Sounding, UncertaintyRanges, ValuationInputs } from './types';

export interface MonteCarloOptions {
  draws?: number;
  seed?: number;
  /** Required margin of safety for the load line, e.g. 0.2. */
  marginOfSafety?: number;
  /** How many draws to keep for plotting. */
  soundings?: number;
}

/**
 * Re-value the company thousands of times with growth, margin, cost of
 * capital and capital efficiency drawn from the user's ranges. A shift in
 * the cost of capital moves the mature rate and the terminal return with it,
 * so the moat (ROIC − WACC) the user chose is preserved.
 */
export function runMonteCarlo(
  inputs: ValuationInputs,
  ranges: UncertaintyRanges,
  price: number,
  options: MonteCarloOptions = {},
): MonteCarloResult {
  const draws = options.draws ?? 4000;
  const keep = Math.min(draws, options.soundings ?? 360);
  const mos = options.marginOfSafety ?? 0.2;
  const rng = createRng(options.seed ?? 1876);
  const values = new Float64Array(draws);
  const soundings: Sounding[] = [];
  const stride = draws / keep;
  let nextKeep = 0;
  const scratch = { ...inputs };
  let sum = 0;

  for (let k = 0; k < draws; k++) {
    const growth = sampleTriangular(rng(), ranges.growth.low, ranges.growth.mode, ranges.growth.high);
    const margin = sampleTriangular(
      rng(),
      ranges.targetMargin.low,
      ranges.targetMargin.mode,
      ranges.targetMargin.high,
    );
    const wacc = sampleTriangular(
      rng(),
      ranges.costOfCapital.low,
      ranges.costOfCapital.mode,
      ranges.costOfCapital.high,
    );
    const s2c = sampleTriangular(
      rng(),
      ranges.salesToCapital.low,
      ranges.salesToCapital.mode,
      ranges.salesToCapital.high,
    );
    const shift = wacc - inputs.costOfCapital;
    scratch.growth = growth;
    scratch.targetMargin = margin;
    scratch.costOfCapital = wacc;
    scratch.terminalCostOfCapital = inputs.terminalCostOfCapital + shift;
    scratch.terminalRoic = inputs.terminalRoic + shift;
    scratch.salesToCapital = Math.max(0.1, s2c);
    const v = valuePerShare(scratch);
    values[k] = v;
    sum += v;
    if (k >= nextKeep) {
      soundings.push({ growth, targetMargin: margin, value: v });
      nextKeep += stride;
    }
  }

  values.sort();
  return {
    draws,
    values,
    p10: percentile(values, 0.1),
    p50: percentile(values, 0.5),
    p90: percentile(values, 0.9),
    mean: sum / draws,
    probAbovePrice: shareAbove(values, price),
    probAboveLoadLine: shareAbove(values, price / (1 - mos)),
    soundings,
  };
}

/** Default ranges around a bearing: wide on growth, tighter on cost of capital. */
export function defaultRanges(inputs: ValuationInputs): UncertaintyRanges {
  const g = inputs.growth;
  const m = inputs.targetMargin;
  const gSpread = Math.max(0.03, Math.abs(g) * 0.45);
  const mSpread = Math.max(0.03, Math.abs(m) * 0.25);
  return {
    growth: { low: g - gSpread, mode: g, high: g + gSpread },
    targetMargin: { low: m - mSpread, mode: m, high: Math.min(0.95, m + mSpread) },
    costOfCapital: {
      low: Math.max(0.04, inputs.costOfCapital - 0.01),
      mode: inputs.costOfCapital,
      high: inputs.costOfCapital + 0.01,
    },
    salesToCapital: {
      low: inputs.salesToCapital * 0.7,
      mode: inputs.salesToCapital,
      high: inputs.salesToCapital * 1.3,
    },
  };
}
