import { priceReturnPct } from '@/domain/performance';
import type { ArchivedPick, MeasurementMethod, PickOutcome } from '../types';
import { ARCHIVE_SPECS, WINDOW_SESSIONS, type ArchiveSpec } from './archiveSpec';
import { sessionTimes } from './calendar';
import { INDEX_BY_ID, INSTRUMENT_BY_ID } from './instruments';
import { anyPath, closeOn, openOn, outcomeWindow } from './prices';

export const MEASUREMENT_METHOD: MeasurementMethod = {
  version: 'outcomes-v1',
  entry: 'Next regular-session open after publication',
  window: `${WINDOW_SESSIONS} trading sessions, entry session included`,
  coverage: 'All eligible published picks, including losses, closed theses and delistings',
  returnBasis: 'Price return in the instrument’s native currency, before costs',
  benchmark:
    'S&P 500 for US listings, STOXX Europe 600 for European listings, same entry and exit sessions',
  costs: 'Not deducted. Commissions, spreads, taxes and FX conversion are excluded',
  corporateActions:
    'Prices are split-adjusted. A cash acquisition ends the window at the final regular session before delisting',
  universe: 'Picks published from 1 September 2026; windows still open are reported as pending',
};

function iso(ms: number | null): string | null {
  return ms == null ? null : new Date(ms).toISOString();
}

export function computeOutcome(spec: ArchiveSpec, now: number): PickOutcome {
  const instrument = INSTRUMENT_BY_ID.get(spec.instrumentId)!;
  const path = anyPath(spec.instrumentId);
  const benchmarkPath = anyPath(spec.benchmarkId);
  const calendar = instrument.price?.calendar ?? 'US';
  const window = outcomeWindow(
    calendar,
    Date.parse(spec.publishedAt),
    instrument.price?.lastSession ?? null,
  );
  const truncated = instrument.status === 'delisted';
  const entryPrice = path ? openOn(path, window.entryDate, now) : null;
  const exitClosesAt = sessionTimes(calendar, window.exitDate).closesAt;
  const fullWindow = window.sessions.length === WINDOW_SESSIONS || truncated;
  const complete = fullWindow && now >= exitClosesAt;
  const exitPrice = complete && path ? closeOn(path, window.exitDate, now) : null;
  const sessionsElapsed = window.sessions.filter(
    (day) => sessionTimes(calendar, day).opensAt <= now,
  ).length;
  const benchmarkEntry = benchmarkPath ? openOn(benchmarkPath, window.entryDate, now) : null;
  const benchmarkExit =
    complete && benchmarkPath ? closeOn(benchmarkPath, window.exitDate, now) : null;
  const benchmarkName = INDEX_BY_ID.get(spec.benchmarkId)?.name ?? spec.benchmarkId;
  return {
    windowSessions: WINDOW_SESSIONS,
    status: complete ? 'complete' : 'pending',
    entryRule: MEASUREMENT_METHOD.entry,
    entryAt: iso(sessionTimes(calendar, window.entryDate).opensAt),
    entryPrice: entryPrice == null ? null : entryPrice.toFixed(2),
    exitAt: complete ? iso(exitClosesAt) : null,
    exitPrice: exitPrice == null ? null : exitPrice.toFixed(2),
    sessionsElapsed,
    returnPct: complete ? (priceReturnPct(entryPrice, exitPrice)?.toFixed(4) ?? null) : null,
    benchmark: {
      name: benchmarkName,
      entryPrice: benchmarkEntry == null ? null : benchmarkEntry.toFixed(2),
      exitPrice: benchmarkExit == null ? null : benchmarkExit.toFixed(2),
      returnPct: complete
        ? (priceReturnPct(benchmarkEntry, benchmarkExit)?.toFixed(4) ?? null)
        : null,
    },
    basis: MEASUREMENT_METHOD.returnBasis,
    currency: instrument.currency,
    note: truncated
      ? `Window ended after ${window.sessions.length} sessions: the company was acquired for cash and delisted.`
      : null,
  };
}

/** Archive entries for picks published before today, plus today's picks (added by the server). */
export function archiveFromSpecs(now: number): ArchivedPick[] {
  return ARCHIVE_SPECS.filter((spec) => Date.parse(spec.publishedAt) <= now).map((spec) => {
    const instrument = INSTRUMENT_BY_ID.get(spec.instrumentId)!;
    const revisions = spec.revision
      ? [{ version: 2, at: spec.revision.at, summary: spec.revision.summary }]
      : [];
    return {
      id: spec.id,
      pickId: spec.id.replace('arc_', 'pick_'),
      instrumentId: spec.instrumentId,
      symbolAtPublication: instrument.symbol,
      nameAtPublication: instrument.name,
      publishedAt: spec.publishedAt,
      category: spec.category,
      originalHeadline: spec.headline,
      originalThesis: spec.thesis,
      reportId: `rep_${spec.id}`,
      reportVersionAtPublication: 1,
      latestVersion: 1 + revisions.length,
      revisions,
      thesisStatus: spec.revision?.closesThesis ? 'closed' : 'active',
      outcome: computeOutcome(spec, now),
      delisted:
        instrument.status === 'delisted' && instrument.delistedOn
          ? {
              on: instrument.delistedOn,
              reason: 'Acquired for cash; final regular session 8 Oct 2026.',
            }
          : null,
    };
  });
}
