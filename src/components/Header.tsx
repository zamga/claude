import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { useDisplay } from '@/app/display';
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
          <span className={[styles.barTitle, compactTitle ? styles.hideWhenCompact : ''].join(' ')}>
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
  /** Most lines the headline may take before it is set smaller (see ScreenHeading). */
  lines?: number;
  subtitle?: ReactNode;
  /** 'lede' (18 px) introduces a screen; 'note' (15 px) carries metadata, as on Valuation. */
  subtitleSize?: 'lede' | 'note';
  sentinelRef?: React.RefObject<HTMLDivElement | null>;
  children?: ReactNode;
}

export function LargeTitle({
  eyebrow,
  eyebrowTone = 'accent',
  meta,
  title,
  size = 'display',
  lines,
  subtitle,
  subtitleSize = 'lede',
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
      <ScreenHeading size={size} lines={lines}>
        {title}
      </ScreenHeading>
      {subtitle && (
        <p className={styles.subtitle} data-size={subtitleSize}>
          {subtitle}
        </p>
      )}
      {children}
      <div ref={sentinelRef} className={styles.sentinel} aria-hidden />
    </div>
  );
}

let measureContext: CanvasRenderingContext2D | null = null;

/**
 * Headlines are set at the photographed 64 px and only set smaller when a word would not fit the
 * column, or (to no less than 80%) when that brings the title within `lines` lines. This
 * reproduces the photographed breaks: "Today's / picks." stays at full size, "The investment
 * case." comes down to two lines, and "Inside the / semiconductor / cycle." keeps three lines at
 * the size where "semiconductor" fits.
 */
function useHeadlineFit(
  ref: React.RefObject<HTMLHeadingElement | null>,
  lines: number,
  enabled: boolean,
  textScale: number,
) {
  // The last fit: re-measure only when the text, the line budget or the column width changes.
  const last = useRef({ text: '', lines: 0, width: -1 });
  const fitRef = useRef<() => void>(() => undefined);
  // After each render, refit only if the title or its line budget changed (cheap check).
  useLayoutEffect(() => {
    fitRef.current = () => {
      const element = ref.current;
      if (!enabled || !element) return;
      element.style.fontSize = '';
      const style = getComputedStyle(element);
      const base = parseFloat(style.fontSize);
      const width = element.clientWidth;
      last.current = { text: element.textContent ?? '', lines, width };
      if (!base || !width) return;
      measureContext ??= document.createElement('canvas').getContext('2d');
      const context = measureContext;
      if (!context) return;
      context.font = `${style.fontWeight} ${base}px ${style.fontFamily}`;
      const spacing = parseFloat(style.letterSpacing) || 0;
      const measure = (text: string) =>
        context.measureText(text).width + spacing * [...text].length;
      const segments = element.innerText
        .split('\n')
        .map((segment) => segment.trim())
        .filter(Boolean)
        .map((segment) => segment.split(/\s+/).map(measure));
      if (segments.length === 0) return;
      const space = measure(' ');
      const longest = Math.max(...segments.flat());
      const lineCount = (scale: number) =>
        segments.reduce((total, words) => {
          let count = 1;
          let used = 0;
          for (const word of words) {
            const next = used === 0 ? word * scale : used + space * scale + word * scale;
            if (used > 0 && next > width) {
              count += 1;
              used = word * scale;
            } else used = next;
          }
          return total + count;
        }, 0);
      // First the largest size at which the longest word fits the column, then smaller (to 80%)
      // only while that reaches the photographed line count; otherwise keep the word fit.
      let scale = Math.max(0.6, Math.min(1, width / longest));
      let fitted = scale;
      while (fitted > 0.8 && lineCount(fitted) > lines) fitted -= 0.02;
      if (lineCount(fitted) <= lines) scale = fitted;
      if (scale < 1) element.style.fontSize = `${(base * scale).toFixed(2)}px`;
    };
    const element = ref.current;
    if (!enabled || !element) return;
    if (element.textContent !== last.current.text || lines !== last.current.lines) fitRef.current();
  });

  // A text-size change moves the base size: refit once DisplayProvider has applied it.
  useEffect(() => {
    if (!enabled) return undefined;
    const frame = requestAnimationFrame(() => fitRef.current());
    return () => cancelAnimationFrame(frame);
  }, [enabled, textScale]);

  // Refit when the column width changes, when the pane does (a pane container query can step the
  // base size while a capped column keeps its width) and once the web fonts have loaded.
  useLayoutEffect(() => {
    const element = ref.current;
    if (!enabled || !element || typeof ResizeObserver === 'undefined') return undefined;
    let frame = 0;
    const schedule = () => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        fitRef.current();
      });
    };
    let pane: Element | null = null;
    for (let node = element.parentElement; node && !pane; node = node.parentElement)
      if (getComputedStyle(node).containerName.split(/\s+/).includes('pane')) pane = node;
    let paneWidth = pane?.clientWidth ?? -1;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const width = entry.contentRect.width;
        if (entry.target === element && Math.abs(width - last.current.width) >= 0.5) schedule();
        if (entry.target === pane && Math.abs(width - paneWidth) >= 0.5) {
          paneWidth = width;
          schedule();
        }
      }
    });
    observer.observe(element);
    if (pane) observer.observe(pane);
    void document.fonts?.ready.then(schedule);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
      element.style.fontSize = '';
      last.current = { text: '', lines: 0, width: -1 };
    };
  }, [enabled, ref]);
}

/** The destination heading that receives focus after navigation (spec page 45). */
export function ScreenHeading({
  children,
  size = 'display',
  lines = 2,
  className,
}: {
  children: ReactNode;
  size?: 'display' | 'title' | 'none';
  lines?: number;
  className?: string;
}) {
  const pane = usePane();
  const { effective } = useDisplay();
  const ref = useRef<HTMLHeadingElement>(null);
  useHeadlineFit(ref, lines, size !== 'none', effective.textScale);
  return (
    <h1
      ref={ref}
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
  size?: 'large' | 'default' | 'small';
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
