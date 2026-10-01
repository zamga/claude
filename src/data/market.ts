import type { IndustryKey } from './types';

/**
 * Market-wide assumptions. The risk-free rate is the 10-year US Treasury
 * yield on the chart datum; the equity risk premium and industry betas are
 * Plimsoll defaults, shown next to every result and editable through the
 * cost of capital.
 */
export const MARKET = {
  riskFreeRate: 0.0529,
  riskFreeAsOf: '2026-09-30',
  riskFreeSource: 'U.S. Treasury, 10-year constant-maturity yield',
  equityRiskPremium: 0.043,
  /** US federal 21% plus a typical state burden. */
  marginalTaxRate: 0.25,
  /** Ceiling for growth in perpetuity: no company outgrows the economy forever. */
  terminalGrowthCap: 0.03,
} as const;

export interface IndustryProfile {
  label: string;
  /** Relative risk versus the market, used for the starting cost of capital. */
  beta: number;
}

export const INDUSTRIES: Record<IndustryKey, IndustryProfile> = {
  semiconductors: { label: 'Semiconductors', beta: 1.4 },
  software: { label: 'Software', beta: 1.15 },
  hardware: { label: 'Hardware & devices', beta: 1.1 },
  internet: { label: 'Internet platforms', beta: 1.1 },
  ecommerce: { label: 'E-commerce & cloud', beta: 1.15 },
  autos: { label: 'Autos & energy', beta: 1.5 },
  media: { label: 'Media & streaming', beta: 1.1 },
  retail: { label: 'Retail', beta: 0.85 },
  beverages: { label: 'Beverages', beta: 0.65 },
  apparel: { label: 'Apparel & footwear', beta: 1.05 },
  private: { label: 'Private company', beta: 1.3 },
};

/** Cost of capital from a beta: risk-free + beta × equity risk premium. */
export function costOfCapitalFor(beta: number): number {
  return MARKET.riskFreeRate + beta * MARKET.equityRiskPremium;
}

/** A mature business trends toward the market as a whole (beta of one). */
export const MATURE_COST_OF_CAPITAL = MARKET.riskFreeRate + MARKET.equityRiskPremium;
