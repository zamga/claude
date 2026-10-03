import type { ReactNode } from 'react';
import { type DecimalInput } from '@/domain/decimal';
import {
  direction,
  directionWord,
  formatMoney,
  formatPercent,
  formatPoints,
  formatSignedMoney,
  UNAVAILABLE,
  type CurrencyCode,
} from '@/domain/format';
import styles from './Market.module.css';

type ChangeFormat = 'percent' | 'money' | 'points';

/** Signed change: colour is always paired with a sign and a spoken direction (spec page 3). */
export function Change({
  value,
  format = 'percent',
  currency = 'USD',
  digits,
  suffix,
  size = 'sm',
  className,
}: {
  value: DecimalInput | null | undefined;
  format?: ChangeFormat;
  currency?: CurrencyCode;
  digits?: number;
  suffix?: ReactNode;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}) {
  const text =
    format === 'percent'
      ? formatPercent(value, digits ?? 2)
      : format === 'points'
        ? formatPoints(value, digits ?? 1)
        : formatSignedMoney(value, currency, digits ?? 2);
  const dir = direction(value ?? null);
  const spoken =
    value == null ? 'change unavailable' : `${directionWord(value)} ${text.replace(/^[+−]/, '')}`;
  return (
    <span
      className={[styles.change, className ?? ''].join(' ')}
      data-direction={dir}
      data-size={size}
    >
      <span aria-hidden>{text}</span>
      <span className="visually-hidden">{spoken}</span>
      {suffix && <span className={styles.suffix}>{suffix}</span>}
    </span>
  );
}

export function Price({
  value,
  currency,
  size = 'md',
  digits = 2,
  className,
  anchor,
}: {
  value: DecimalInput | null | undefined;
  currency: CurrencyCode;
  size?: 'hero' | 'lg' | 'md' | 'sm';
  digits?: number;
  className?: string;
  anchor?: string;
}) {
  const text = value == null ? UNAVAILABLE : formatMoney(value, currency, digits);
  return (
    <span
      className={[styles.price, className ?? ''].join(' ')}
      data-size={size}
      data-anchor={anchor}
    >
      {value == null ? (
        <>
          <span aria-hidden>{text}</span>
          <span className="visually-hidden">Price unavailable</span>
        </>
      ) : (
        text
      )}
    </span>
  );
}

export function RankBadge({ rank }: { rank: number }) {
  return (
    <span className={styles.rank} aria-label={`Pick ${rank}`}>
      {String(rank).padStart(2, '0')}
    </span>
  );
}

export function Tag({
  children,
  tone = 'neutral',
  title,
}: {
  children: ReactNode;
  tone?: 'positive' | 'negative' | 'neutral' | 'accent' | 'warning' | 'outline';
  title?: string;
}) {
  return (
    <span className={styles.tag} data-tone={tone} title={title}>
      {children}
    </span>
  );
}

export function Ticker({
  symbol,
  anchor,
  className,
}: {
  symbol: string;
  anchor?: string;
  className?: string;
}) {
  return (
    <span className={[styles.ticker, className ?? ''].join(' ')} data-anchor={anchor}>
      {symbol}
    </span>
  );
}

export function StatusDot({ className }: { className?: string }) {
  return <span className={[styles.dot, className ?? ''].join(' ')} aria-hidden />;
}

export const marketStyles = styles;
