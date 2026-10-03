import type { ReactNode } from 'react';
import { formatClockWithZone, formatDuration, formatWeekdayDate, zoneLabel } from '@/domain/format';
import { useDelayedFlag } from '@/lib/hooks';
import type { DataStatus, MarketSession } from '@/data/types';
import { Button } from './Button';
import {
  Clock,
  ICON_STROKE,
  Info,
  RefreshCw,
  TriangleAlert,
  WifiOff,
  type LucideIcon,
} from './icons';
import styles from './Status.module.css';

export function DemoTag({ label = 'Demo' }: { label?: string }) {
  return (
    <span className={styles.demoTag} title="Illustrative demo content, not market data or advice">
      {label}
    </span>
  );
}

export interface StatusLineProps {
  status: DataStatus;
  asOf: string | null;
  timeZone: string;
  session?: MarketSession;
  delaySeconds?: number;
  /** When the client is showing a cached copy (offline or failed refresh). */
  cachedAt?: number | null;
  nextOpen?: string | null;
  unavailableReason?: string | null;
  userTimeZone?: string;
  className?: string;
}

/**
 * Source status and as-of time near every quote (spec pages 23, 50). Delayed, cached and stale
 * values never carry a live label; missing values say why.
 */
export function DataStatusLine({
  status,
  asOf,
  timeZone,
  session,
  delaySeconds = 0,
  cachedAt,
  nextOpen,
  unavailableReason,
  userTimeZone,
  className,
}: StatusLineProps) {
  const at = asOf ? Date.parse(asOf) : null;
  const time = at ? formatClockWithZone(at, timeZone) : null;
  let icon: LucideIcon | null = null;
  let tone: 'default' | 'warning' = 'default';
  const parts: string[] = [];

  if (cachedAt != null) {
    icon = WifiOff;
    tone = 'warning';
    parts.push('Offline');
    parts.push(
      `saved ${formatClockWithZone(cachedAt, userTimeZone ?? Intl.DateTimeFormat().resolvedOptions().timeZone)} device time`,
    );
    if (time) parts.push(`quote ${time}`);
  } else if (status === 'unavailable') {
    icon = Info;
    parts.push(unavailableReason ?? 'Quote unavailable');
  } else if (status === 'stale') {
    icon = TriangleAlert;
    tone = 'warning';
    parts.push('Live updates unavailable');
    if (time) parts.push(`last received ${time}`);
  } else if (status === 'delayed') {
    icon = Clock;
    tone = 'warning';
    parts.push(`Delayed ${formatDuration(delaySeconds)}`);
    if (time) parts.push(time);
  } else {
    if (session === 'closed') {
      parts.push(unavailableReason ? 'Final close' : 'Market closed');
      if (time) parts.push(`last close ${time}`);
      if (nextOpen) {
        const open = Date.parse(nextOpen);
        parts.push(
          `opens ${formatWeekdayDate(open, timeZone)} ${formatClockWithZone(open, timeZone).replace(` ${zoneLabel(open, timeZone)}`, '')}`,
        );
      }
    } else {
      parts.push(status === 'demo' ? 'Demo data' : 'Real time');
      if (time) parts.push(`as of ${time}`);
    }
  }

  const Icon = icon;
  return (
    <span className={[styles.statusLine, className ?? ''].join(' ')} data-tone={tone}>
      {Icon && (
        <Icon className={styles.statusIcon} size={14} strokeWidth={ICON_STROKE} aria-hidden />
      )}
      {parts.map((part, index) => (
        <span key={index}>
          {index > 0 && (
            <span className={styles.sep} aria-hidden>
              ·{' '}
            </span>
          )}
          {part}
        </span>
      ))}
    </span>
  );
}

export function Notice({
  tone = 'neutral',
  icon: Icon,
  title,
  children,
  actions,
  role,
}: {
  tone?: 'neutral' | 'warning' | 'error';
  icon?: LucideIcon;
  title?: ReactNode;
  children?: ReactNode;
  actions?: ReactNode;
  role?: 'status' | 'alert';
}) {
  return (
    <div className={styles.notice} data-tone={tone} data-notice="" role={role}>
      {Icon && (
        <Icon
          size={18}
          strokeWidth={ICON_STROKE}
          aria-hidden
          style={{ flex: 'none', marginTop: 1 }}
        />
      )}
      <div className={styles.noticeBody}>
        {title && <div className={styles.noticeTitle}>{title}</div>}
        {children}
        {actions && <div className={styles.noticeActions}>{actions}</div>}
      </div>
    </div>
  );
}

/** A local, recoverable error that keeps everything else on screen (spec page 27). */
export function InlineError({
  message,
  onRetry,
  retrying,
  requestId,
}: {
  message: string;
  onRetry?: () => void;
  retrying?: boolean;
  requestId?: string;
}) {
  return (
    <Notice
      tone="error"
      icon={TriangleAlert}
      role="alert"
      title={message}
      actions={
        onRetry ? (
          <Button
            variant="quiet"
            size="small"
            icon={RefreshCw}
            iconPosition="start"
            onClick={onRetry}
            pending={retrying}
          >
            Try again
          </Button>
        ) : undefined
      }
    >
      {requestId && <span className="t-note t-muted">Reference {requestId}</span>}
    </Notice>
  );
}

/** After ten seconds, explain the delay instead of spinning silently (spec page 27). */
export function SlowRequestNotice({ active, onRetry }: { active: boolean; onRetry?: () => void }) {
  const slow = useDelayedFlag(active, 10_000);
  if (!slow) return null;
  return (
    <Notice
      tone="neutral"
      icon={Clock}
      role="status"
      title="This is taking longer than usual."
      actions={
        onRetry ? (
          <Button variant="quiet" size="small" onClick={onRetry}>
            Try again
          </Button>
        ) : undefined
      }
    >
      Nothing has been changed while we wait.
    </Notice>
  );
}

export function EmptyState({
  icon: Icon,
  illustration,
  title,
  children,
  actions,
  size = 'title',
  headingLevel = 2,
}: {
  icon?: LucideIcon;
  illustration?: ReactNode;
  title: ReactNode;
  children?: ReactNode;
  actions?: ReactNode;
  size?: 'title' | 'section';
  headingLevel?: 2 | 3;
}) {
  const Heading = headingLevel === 2 ? 'h2' : 'h3';
  return (
    <div className={styles.empty}>
      {illustration ??
        (Icon && <Icon className={styles.emptyIcon} size={40} strokeWidth={1.25} aria-hidden />)}
      <Heading className={styles.emptyTitle} data-size={size}>
        {title}
      </Heading>
      {children && <div className={styles.emptyBody}>{children}</div>}
      {actions && <div className={styles.emptyActions}>{actions}</div>}
    </div>
  );
}

export function Skeleton({
  width = '100%',
  height = 16,
  radius,
}: {
  width?: number | string;
  height?: number | string;
  radius?: number;
}) {
  return (
    <span
      className={styles.skeleton}
      style={{ width, height, borderRadius: radius }}
      data-skeleton=""
      aria-hidden
    />
  );
}

/** Geometry-matched placeholder rows, shown only once loading passes 150 ms (spec page 27). */
export function SkeletonRows({
  rows = 4,
  height = 56,
  label = 'Loading',
}: {
  rows?: number;
  height?: number;
  label?: string;
}) {
  return (
    <div className={styles.skeletonGroup} role="status" aria-label={label}>
      {Array.from({ length: rows }, (_, index) => (
        <Skeleton key={index} height={height - 16} />
      ))}
    </div>
  );
}

export const statusStyles = styles;
