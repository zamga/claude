import type { ReactNode } from 'react';
import { usePane } from '@/app/pane';
import { Row } from '@/components/List';
import { Change, Price, RankBadge, Ticker } from '@/components/Market';
import { Sparkline } from '@/components/Sparkline';
import { computeChange } from '@/domain/change';
import { formatMoney, formatPercent } from '@/domain/format';
import type { Quote, Sample } from '@/data/types';
import styles from './InstrumentRow.module.css';

/**
 * Company row: the whole row opens the company; trailing actions (bell, bookmark) are separate,
 * labelled hit targets. Quote, change and sparkline come from the same observation set.
 */
export function InstrumentRow({
  symbol,
  name,
  to,
  quote,
  sparkline,
  sparkWindow,
  rank,
  meta,
  action,
  showSpark = true,
}: {
  symbol: string;
  name: string;
  to: string;
  quote: Quote | null | undefined;
  sparkline?: Sample[];
  sparkWindow?: { start: number; end: number } | null;
  rank?: number;
  meta?: ReactNode;
  action?: ReactNode;
  showSpark?: boolean;
}) {
  const pane = usePane();
  const change = quote ? computeChange(quote.price, quote.previousClose) : null;
  const selected = pane.detailPath != null && pane.detailPath.toLowerCase() === to.toLowerCase();
  const spoken = quote?.price
    ? `${symbol}, ${name}, ${formatMoney(quote.price, quote.currency)}, ${change?.percent ? formatPercent(change.percent) : 'change unavailable'}`
    : `${symbol}, ${name}${quote?.unavailableReason ? `, ${quote.unavailableReason}` : ''}`;
  return (
    <Row
      to={to}
      linkLabel={spoken}
      selected={selected}
      anchorFor="ticker"
      chevron={false}
      leading={<div className={styles.lead}>{rank != null && <RankBadge rank={rank} />}</div>}
      aside={
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {showSpark && sparkline && sparkline.length > 1 && (
            <span className={styles.spark}>
              <Sparkline
                samples={sparkline}
                reference={quote?.previousClose ? Number(quote.previousClose) : null}
                window={sparkWindow}
                width={64}
                height={26}
              />
            </span>
          )}
          <span className={styles.quote}>
            <Price value={quote?.price ?? null} currency={quote?.currency ?? 'USD'} size="md" />
            {quote?.price ? (
              <Change value={change?.percent ?? null} />
            ) : (
              <span className={styles.meta}>{quote ? 'Not quoted' : ''}</span>
            )}
          </span>
        </div>
      }
      action={action}
    >
      <Ticker symbol={symbol} anchor="ticker" className={styles.ticker} />
      <span className={styles.name}>{name}</span>
      {meta && <div className={styles.meta}>{meta}</div>}
    </Row>
  );
}
