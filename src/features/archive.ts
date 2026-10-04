import type { ArchivedPick } from '@/data/types';

/** Gains and losses are coloured only once a window completes; pending is neither. */
export function outcomeTone(pick: ArchivedPick): 'positive' | 'negative' | undefined {
  if (pick.outcome.status !== 'complete' || pick.outcome.returnPct == null) return undefined;
  const value = Number(pick.outcome.returnPct);
  return value > 0 ? 'positive' : value < 0 ? 'negative' : undefined;
}
