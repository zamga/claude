import { valuePerShare } from './dcf';
import type { ValuationInputs } from './types';

export interface SensitivityCell {
  terminalGrowth: number;
  value: number;
}

export interface SensitivityRow {
  costOfCapital: number;
  cells: SensitivityCell[];
}

/**
 * Value per share across cost of capital (rows) and terminal growth
 * (columns). Moving the cost of capital moves the mature rate and terminal
 * return by the same amount, keeping the chosen moat constant.
 */
export function sensitivityTable(
  inputs: ValuationInputs,
  waccSteps: readonly number[] = [-0.015, -0.01, -0.005, 0, 0.005, 0.01, 0.015],
  growthSteps: readonly number[] = [-0.01, -0.005, 0, 0.005, 0.01],
): SensitivityRow[] {
  const scratch = { ...inputs };
  return waccSteps.map((dw) => {
    scratch.costOfCapital = inputs.costOfCapital + dw;
    scratch.terminalCostOfCapital = inputs.terminalCostOfCapital + dw;
    scratch.terminalRoic = inputs.terminalRoic + dw;
    return {
      costOfCapital: scratch.costOfCapital,
      cells: growthSteps.map((dg) => {
        scratch.terminalGrowth = inputs.terminalGrowth + dg;
        return { terminalGrowth: scratch.terminalGrowth, value: valuePerShare(scratch) };
      }),
    };
  });
}
