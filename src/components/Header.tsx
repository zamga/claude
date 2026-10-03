import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useAppNavigation } from '@/app/navigation';
import { usePane } from '@/app/pane';
import styles from './Header.module.css';
import { IconButton } from './IconButton';
import { ChevronLeft } from './icons';

export function Eyebrow({
  children,
  tone = 'default',
  as: Tag = 'span',
  className,
}: {
  children: ReactNode;
  tone?: 'default' | 'muted' | 'accent';
  as?: 'span' | 'p' | 'div';
  className?: string;
}) {
  return (
    <Tag className={[styles.eyebrow, className ?? ''].join(' ')} data-tone={tone}>
      {children}
    </Tag>
  );
}

export function BackButton({ label = 'Back', fallback }: { label?: string; fallback?: string }) {
  const { back } = useAppNavigation();
  return <IconButton icon={ChevronLeft} label={label} onClick={() => back(fallback)} size={24} />;
}

interface TopBarProps {
  /** Left side: a back button for details, or the section eyebrow for collections. */
  leading?: ReactNode;
  /** Centered eyebrow title (detail screens). */
  title?: string;
  /** Title that crossfades in once the large title scrolls away (collections). */
  compactTitle?: string;
  trailing?: ReactNode;
  /** Show the bottom rule permanently. */
  ruled?: boolean;
  /** Observe this sentinel to drive the compact title. */
  sentinel?: React.RefObject<HTMLElement | null>;
  /**
   * Secondary collections (market, calendars, inbox) keep a visible Back on phones, where an
   * installed app has no browser button; the value is the structural parent for deep links.
   */
  back?: string;
}

/** Sticky screen bar; the large title collapses into it over the first scroll (spec page 24). */
export function TopBar({
  leading,
  title,
  compactTitle,
  trailing,
  ruled,
  sentinel,
  back,
}: TopBarProps) {
  const [compact, setCompact] = useState(false);
  const pane = usePane();
  const showBack = leading === undefined && pane.showBack;

  useEffect(() => {
    const target = sentinel?.current;
    if (!target || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(
      ([entry]) =>
        setCompact(Boolean(entry && !entry.isIntersecting && entry.boundingClientRect.top < 80)),
      { rootMargin: '-60px 0px 0px 0px', threshold: 0 },
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, [sentinel]);

  return (
    <header className={styles.topBar} data-compact={compact} data-ruled={ruled}>
      <div className={styles.leading}>
        {showBack ? (
          <BackButton />
        ) : (
          <>
            {back && pane.role === 'single' && <BackButton fallback={back} />}
            {leading}
          </>
        )}
      </div>
      <div className={styles.center}>
        {title && (
          <span className={[styles.eyebrow, compactTitle ? styles.hideWhenCompact : ''].join(' ')}>
            {title}
          </span>
        )}
        {compactTitle && (
          <span className={styles.compactTitle} aria-hidden={!compact}>
            {compactTitle}
          </span>
        )}
      </div>
      <div className={styles.trailing}>{trailing}</div>
    </header>
  );
}

export function TopBarLabel({ children }: { children: ReactNode }) {
  return <span className={[styles.eyebrow, styles.leadingLabel].join(' ')}>{children}</span>;
}

interface LargeTitleProps {
  eyebrow?: ReactNode;
  eyebrowTone?: 'default' | 'muted' | 'accent';
  meta?: ReactNode;
  title: ReactNode;
  size?: 'display' | 'title';
  subtitle?: ReactNode;
  sentinelRef?: React.RefObject<HTMLDivElement | null>;
  children?: ReactNode;
}

export function LargeTitle({
  eyebrow,
  eyebrowTone = 'accent',
  meta,
  title,
  size = 'display',
  subtitle,
  sentinelRef,
  children,
}: LargeTitleProps) {
  return (
    <div className={styles.largeTitle}>
      {(eyebrow || meta) && (
        <div className={styles.metaRow}>
          {eyebrow ? <Eyebrow tone={eyebrowTone}>{eyebrow}</Eyebrow> : <span />}
          {meta}
        </div>
      )}
      <ScreenHeading size={size}>{title}</ScreenHeading>
      {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
      {children}
      <div ref={sentinelRef} className={styles.sentinel} aria-hidden />
    </div>
  );
}

/** The destination heading that receives focus after navigation (spec page 45). */
export function ScreenHeading({
  children,
  size = 'display',
  className,
}: {
  children: ReactNode;
  size?: 'display' | 'title' | 'none';
  className?: string;
}) {
  const pane = usePane();
  return (
    <h1
      className={[size === 'none' ? '' : styles.title, className ?? ''].join(' ')}
      data-size={size}
      data-screen-heading={pane.role === 'collection' ? undefined : ''}
      tabIndex={-1}
    >
      {children}
    </h1>
  );
}

export function SectionHeader({
  title,
  aside,
  size = 'default',
  id,
  as: Tag = 'h2',
}: {
  title: ReactNode;
  aside?: ReactNode;
  size?: 'default' | 'small';
  id?: string;
  as?: 'h2' | 'h3';
}) {
  return (
    <div className={styles.section}>
      <Tag className={styles.sectionTitle} data-size={size} id={id}>
        {title}
      </Tag>
      {aside}
    </div>
  );
}

export function useSentinel() {
  return useRef<HTMLDivElement | null>(null);
}
