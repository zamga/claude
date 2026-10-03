import { describe, expect, it } from 'vitest';
import { summarizeOutcomes } from '@/domain/performance';
import { formatPercent, formatPoints } from '@/domain/format';
import { archiveFromSpecs } from '../archive';
import { DEMO_START, DEMO_US_CLOSE } from '../clock';
import { demoQuote, demoSeries, type FeedState } from '../market';
import { dailyClose, instrumentPath } from '../prices';

const normal: FeedState = { mode: 'normal', since: null };

describe('demo price world', () => {
  it('quotes NVDA at 142.80 at 14:25 ET and the 1D endpoint matches the quote', () => {
    const quote = demoQuote('ins_nvda', DEMO_START, normal);
    expect(quote.price).toBe('142.80');
    expect(quote.previousClose).toBe('139.53');
    expect(quote.session).toBe('regular');
    const series = demoSeries('ins_nvda', '1D', DEMO_START, normal);
    const last = series.samples[series.samples.length - 1]!;
    expect(last.v).toBe(142.8);
    expect(new Date(last.t).toISOString()).toBe(quote.asOf);
    expect(series.samples).toHaveLength(60);
    expect(series.samples[0]!.v).toBe(139.8);
    expect(series.samples[1]!.v).toBe(140.25);
  });

  it('European names are closed at demo time and show their session close', () => {
    const quote = demoQuote('ins_asml', DEMO_START, normal);
    expect(quote.price).toBe('648.20');
    expect(quote.currency).toBe('EUR');
    expect(quote.session).toBe('closed');
    expect(quote.nextOpen).not.toBeNull();
  });

  it('paper-ledger anchor prices are real closes in the series', () => {
    expect(dailyClose(instrumentPath('ins_nvda')!, '2026-07-15')!.close).toBe(128);
    expect(dailyClose(instrumentPath('ins_msft')!, '2026-08-03')!.close).toBe(397.92);
    expect(dailyClose(instrumentPath('ins_tsm')!, '2026-10-05')!.close).toBe(168.9);
  });

  it('newly listed and delisted names keep honest histories', () => {
    const kora = demoSeries('ins_kora', '1Y', DEMO_START, normal);
    expect(kora.samples.length).toBe(10);
    const hollis = demoQuote('ins_hlrb', DEMO_START, normal);
    expect(hollis.price).toBe('46.18');
    expect(hollis.unavailableReason).toMatch(/Delisted/);
    const pending = demoQuote('ins_alto', DEMO_START, normal);
    expect(pending.price).toBeNull();
    expect(pending.status).toBe('unavailable');
  });

  it('delayed and interrupted feeds never carry a demo-current status', () => {
    expect(demoQuote('ins_nvda', DEMO_START, { mode: 'delayed', since: null }).status).toBe(
      'delayed',
    );
    const frozen = demoQuote('ins_nvda', DEMO_START + 30 * 60_000, {
      mode: 'interrupted',
      since: DEMO_START,
    });
    expect(frozen.status).toBe('stale');
    expect(frozen.price).toBe('142.80');
  });
});

describe('archive outcomes are re-measured from the price paths', () => {
  it('reproduces the illustrated performance review (12 closed, 7 positive, +3.4%)', () => {
    const archive = archiveFromSpecs(DEMO_START);
    const summary = summarizeOutcomes(
      archive.map((pick) => ({
        status: pick.outcome.status,
        returnPct: pick.outcome.returnPct,
        benchmarkPct: pick.outcome.benchmark.returnPct,
      })),
    );
    expect(summary.complete).toBe(12);
    expect(summary.pending).toBe(3);
    expect(summary.positive).toBe(7);
    expect(formatPercent(summary.meanPct, 1)).toBe('+3.4%');
    expect(summary.benchmarkMeanPct).not.toBeNull();
    expect(formatPoints(summary.differencePp)).toMatch(/pp$/);
  });

  it('each closed pick hits its target within display rounding', () => {
    const nvda = archiveFromSpecs(DEMO_START).find((pick) => pick.id === 'arc_2026_09_02_nvda')!;
    expect(formatPercent(nvda.outcome.returnPct, 1)).toBe('+8.6%');
    const amd = archiveFromSpecs(DEMO_START).find((pick) => pick.id === 'arc_2026_09_07_amd')!;
    expect(formatPercent(amd.outcome.returnPct, 1)).toBe('−5.1%');
    expect(amd.outcome.entryAt).toBe('2026-09-08T13:30:00.000Z');
    expect(amd.thesisStatus).toBe('closed');
  });

  it('a window that ends today stays pending until the close', () => {
    const before = archiveFromSpecs(DEMO_START).find((pick) => pick.id === 'arc_2026_09_23_cat')!;
    const after = archiveFromSpecs(DEMO_US_CLOSE).find((pick) => pick.id === 'arc_2026_09_23_cat')!;
    expect(before.outcome.status).toBe('pending');
    expect(after.outcome.status).toBe('complete');
  });
});
