import { clamp } from '../engine/stats';
import type { ValuationInputs } from '../engine/types';
import type { Survey } from './survey';

/**
 * Stories, turned into numbers. Each one sets the two axes of the chart
 * (growth and margin), how fast margins move, and whether the business
 * keeps earning more than its cost of capital in perpetuity (the moat).
 */
export interface Narrative {
  id: string;
  title: string;
  /** The story in one sentence, written for someone who has never built a model. */
  line: string;
  apply: (survey: Survey, inputs: ValuationInputs) => Partial<ValuationInputs>;
}

const moat = (inputs: ValuationInputs, spread: number) => ({
  terminalRoic: inputs.terminalCostOfCapital + spread,
});

export const NARRATIVES: Narrative[] = [
  {
    id: 'status-quo',
    title: 'As it is',
    line: 'Recent growth carries on for five years and margins stay where they are today.',
    apply: (s, inputs) => ({
      growth: clamp(s.historicalCagr ?? s.lastGrowth ?? 0.04, -0.05, 0.3),
      targetMargin: s.operatingMargin,
      convergenceYears: 5,
      ...moat(inputs, 0),
    }),
  },
  {
    id: 'compounder',
    title: 'Compounder',
    line: 'Steady growth, margins at their best recent level, and a moat that lasts.',
    apply: (s, inputs) => ({
      growth: clamp(s.historicalCagr ?? 0.08, 0.04, 0.15),
      targetMargin: Math.max(s.operatingMargin, s.averageMargin),
      convergenceYears: 5,
      ...moat(inputs, 0.04),
    }),
  },
  {
    id: 'breakout',
    title: 'Breakout',
    line: 'The next five years outrun the last, margins expand, and the lead holds.',
    apply: (s, inputs) => ({
      growth: clamp(Math.max((s.historicalCagr ?? 0.1) * 1.25, 0.18), 0.18, 0.45),
      targetMargin: clamp(Math.max(s.operatingMargin, s.peakMargin) + 0.08, -0.2, 0.85),
      convergenceYears: 6,
      ...moat(inputs, 0.06),
    }),
  },
  {
    id: 'fade',
    title: 'Mean reversion',
    line: 'Growth slows to the pace of the economy and competition trims margins by a quarter.',
    apply: (s, inputs) => ({
      growth: 0.04,
      targetMargin: s.operatingMargin > 0 ? s.operatingMargin * 0.75 : s.operatingMargin,
      convergenceYears: 7,
      ...moat(inputs, 0),
    }),
  },
  {
    id: 'turnaround',
    title: 'Turnaround',
    line: 'Modest growth, but margins recover to their best level of the last five years.',
    apply: (s, inputs) => ({
      growth: 0.03,
      targetMargin: clamp(Math.max(s.peakMargin, 0.1), -0.2, 0.85),
      convergenceYears: 7,
      ...moat(inputs, 0.01),
    }),
  },
  {
    id: 'decline',
    title: 'Melting ice cube',
    line: 'Revenue shrinks a little every year and margins slip five points.',
    apply: (s, inputs) => ({
      growth: -0.03,
      targetMargin: s.operatingMargin - 0.05,
      convergenceYears: 5,
      ...moat(inputs, 0),
    }),
  },
];

export const findNarrative = (id: string | null) => NARRATIVES.find((n) => n.id === id) ?? null;
