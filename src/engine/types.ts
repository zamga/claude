/**
 * Core valuation types. Money is in USD millions unless a name says
 * otherwise (`...PerShare`, `price`). Rates are decimals (0.08 = 8%).
 */

export interface ValuationInputs {
  /** Base-year revenue (latest fiscal year). */
  revenue: number;
  /** Base-year operating (EBIT) margin. */
  operatingMargin: number;
  /** Revenue growth per year, years 1–5. Fades linearly to `terminalGrowth` by year 10. */
  growth: number;
  /** Growth in perpetuity after year 10. Must stay below the terminal cost of capital. */
  terminalGrowth: number;
  /** Operating margin the business converges to. */
  targetMargin: number;
  /** Years to reach the target margin (1–10). */
  convergenceYears: number;
  /** Effective tax rate, years 1–5. */
  taxRate: number;
  /** Marginal tax rate reached by year 10 and used in perpetuity. */
  marginalTaxRate: number;
  /** Revenue added per dollar reinvested. Higher = less capital needed to grow. */
  salesToCapital: number;
  /** Cost of capital, years 1–5. */
  costOfCapital: number;
  /** Cost of capital for a mature business, reached by year 10. */
  terminalCostOfCapital: number;
  /** Return on new capital in perpetuity. Equal to the terminal cost of capital = no moat. */
  terminalRoic: number;
  /** Cash and marketable securities. */
  cash: number;
  /** Interest-bearing debt (excluding operating leases). */
  debt: number;
  /** Non-controlling interests, claims ahead of common equity. */
  minorityInterest: number;
  /** Cross-holdings and other assets whose income is not in operating income. */
  nonOperatingAssets: number;
  /** Diluted shares, millions. */
  shares: number;
}

export interface ProjectionYear {
  year: number;
  growth: number;
  revenue: number;
  margin: number;
  ebit: number;
  taxRate: number;
  nopat: number;
  reinvestment: number;
  fcff: number;
  costOfCapital: number;
  discountFactor: number;
  presentValue: number;
}

export interface ValuationResult {
  years: ProjectionYear[];
  terminal: {
    revenue: number;
    ebit: number;
    nopat: number;
    reinvestmentRate: number;
    fcff: number;
    value: number;
    presentValue: number;
  };
  pvCashFlows: number;
  operatingAssets: number;
  equityValue: number;
  valuePerShare: number;
  /** Share of operating value that comes from beyond year 10. */
  terminalShare: number;
}

export interface ChartExtent {
  growthMin: number;
  growthMax: number;
  marginMin: number;
  marginMax: number;
}

export interface ValueGrid {
  extent: ChartExtent;
  /** Columns along growth (x). */
  nx: number;
  /** Rows along target margin (y). */
  ny: number;
  /** Value per share, row-major: index = j * nx + i (j = margin row, i = growth column). */
  values: Float64Array;
}

export interface Triangular {
  low: number;
  mode: number;
  high: number;
}

export interface UncertaintyRanges {
  growth: Triangular;
  targetMargin: Triangular;
  costOfCapital: Triangular;
  salesToCapital: Triangular;
}

export interface Sounding {
  growth: number;
  targetMargin: number;
  value: number;
}

export interface MonteCarloResult {
  draws: number;
  /** Sorted ascending. */
  values: Float64Array;
  p10: number;
  p50: number;
  p90: number;
  mean: number;
  /** Share of draws worth more than the price. */
  probAbovePrice: number;
  /** Share of draws worth more than price / (1 - margin of safety). */
  probAboveLoadLine: number;
  /** A thinned sample for plotting on the chart. */
  soundings: Sounding[];
}
