import type { ReactNode } from 'react';
import { usePress } from './usePress';
import { AppLink } from './AppLink';
import { ChevronRight, ICON_STROKE, type LucideIcon } from './icons';
import styles from './List.module.css';

export function List({
  children,
  label,
  flushTop,
}: {
  children: ReactNode;
  label?: string;
  flushTop?: boolean;
}) {
  return (
    <ul className={styles.list} aria-label={label} data-flush-top={flushTop}>
      {children}
    </ul>
  );
}

interface RowProps {
  /** Destination for the whole row. Separate actions stay independent hit targets. */
  to?: string;
  onPress?: () => void;
  /** Accessible name for the row link when the visible content is not enough. */
  linkLabel?: string;
  leading?: ReactNode;
  icon?: LucideIcon;
  title?: ReactNode;
  detail?: ReactNode;
  children?: ReactNode;
  aside?: ReactNode;
  action?: ReactNode;
  chevron?: boolean;
  selected?: boolean;
  dense?: boolean;
  anchorFor?: string;
  as?: 'li' | 'div';
  /** Tall rows align their leading and trailing parts with the first line. */
  align?: 'center' | 'start';
  /** Label/value rows: with enlarged text the value moves under its label instead of colliding. */
  reflow?: boolean;
}

/**
 * Stretched-link row (spec pages 20, 24): the whole row opens its destination except separately
 * labelled actions; a subtle tint on press, cancelled when the gesture becomes a scroll.
 */
export function Row({
  to,
  onPress,
  linkLabel,
  leading,
  icon: Icon,
  title,
  detail,
  children,
  aside,
  action,
  chevron = Boolean(to || onPress),
  selected,
  dense,
  anchorFor,
  as: Tag = 'li',
  align = 'center',
  reflow,
}: RowProps) {
  const { pressed, handlers } = usePress<HTMLElement>(!to && !onPress);
  const content = (
    <>
      {Icon && <Icon className={styles.leadIcon} size={20} strokeWidth={ICON_STROKE} aria-hidden />}
      {leading}
      <div className={styles.main}>
        {title && <div className={styles.title}>{title}</div>}
        {detail && <div className={styles.detail}>{detail}</div>}
        {children}
      </div>
      {aside && <div className={styles.aside}>{aside}</div>}
      {action && <div className={styles.action}>{action}</div>}
      {chevron && (
        <ChevronRight className={styles.chevron} size={18} strokeWidth={ICON_STROKE} aria-hidden />
      )}
    </>
  );
  return (
    <Tag
      className={styles.row}
      data-pressed={pressed}
      data-selected={selected}
      data-dense={dense}
      data-align={align}
      data-reflow={reflow}
    >
      {to && (
        <AppLink
          to={to}
          className={styles.rowLink}
          aria-label={linkLabel}
          aria-current={selected ? 'page' : undefined}
          anchorFor={anchorFor}
          {...handlers}
        >
          {!linkLabel && (
            <span className="visually-hidden">{typeof title === 'string' ? title : 'Open'}</span>
          )}
        </AppLink>
      )}
      {!to && onPress && (
        <button
          type="button"
          className={styles.rowLink}
          aria-label={linkLabel}
          onClick={onPress}
          {...handlers}
        >
          {!linkLabel && (
            <span className="visually-hidden">{typeof title === 'string' ? title : 'Open'}</span>
          )}
        </button>
      )}
      {content}
    </Tag>
  );
}

export function KeyValueList({
  children,
  label,
  topRule = true,
}: {
  children: ReactNode;
  label?: string;
  topRule?: boolean;
}) {
  return (
    <dl className={styles.kvList} aria-label={label} data-top-rule={topRule}>
      {children}
    </dl>
  );
}

export function KeyValue({
  label,
  value,
  muted,
}: {
  label: ReactNode;
  value: ReactNode;
  muted?: boolean;
}) {
  return (
    <div className={[styles.kv, muted ? styles.kvMuted : ''].join(' ')}>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

export const listStyles = styles;
