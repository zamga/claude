import type { ReactNode } from 'react';
import { computeChange } from '@/domain/change';
import type { Quote, Series } from '@/data/types';
import { Change, Price } from '../Market';
import { DataStatusLine } from '../Status';
import { changeAgainstReference, sampleLabel } from './PriceChart';
import { useInspection, type InspectionStore } from './inspectionStore';
import styles from './QuoteHero.module.css';

/**
 * The hero quote. At rest it shows the latest quote with its status; while the chart is inspected
 * it shows the inspected sample, labelled as such (spec page 22). Both read the same sample.
 */
export function QuoteHero({
  quote,
  series,
  store,
  timeZone,
  cachedAt,
  userTimeZone,
  suffix = 'today',
  anchor,
  aside,
}: {
  quote: Quote;
  series: Series | null;
  store: InspectionStore;
  timeZone: string;
  cachedAt?: number | null;
  userTimeZone?: string;
  suffix?: string;
  anchor?: string;
  aside?: ReactNode;
}) {
  const inspection = useInspection(store);
  const inspecting = inspection.sample != null && !inspection.fading && series != null;
  if (inspecting) {
    const change = changeAgainstReference(inspection.sample, series);
    return (
      <div className={styles.hero} data-state="inspecting">
        <div className={styles.priceRow}>
          <Price
            value={String(inspection.sample!.v)}
            currency={series.currency}
            size="hero"
            anchor={anchor}
          />
          <Change value={change?.percent ?? null} size="md" suffix={series.reference.label} />
        </div>
        <span className={styles.meta}>
          {inspection.mode === 'pinned' ? 'Pinned' : 'Inspecting'} ·{' '}
          {sampleLabel(inspection.sample!, series)}
        </span>
      </div>
    );
  }
  const change = computeChange(quote.price, quote.previousClose);
  return (
    <div className={styles.hero} data-state="rest">
      <div className={styles.priceRow}>
        <Price value={quote.price} currency={quote.currency} size="hero" anchor={anchor} />
        <Change value={change.percent} size="md" suffix={quote.price ? suffix : undefined} />
        {aside}
      </div>
      <DataStatusLine
        status={quote.status}
        asOf={quote.asOf}
        timeZone={timeZone}
        session={quote.session}
        delaySeconds={quote.delaySeconds}
        cachedAt={cachedAt}
        nextOpen={quote.nextOpen}
        unavailableReason={quote.unavailableReason}
        userTimeZone={userTimeZone}
        className={styles.meta}
      />
    </div>
  );
}
