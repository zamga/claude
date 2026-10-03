import type { ReactNode } from 'react';
import { usePane } from '@/app/pane';
import styles from './Layout.module.css';

/** Screen container: surface tokens, container queries and the bottom-bar contract. */
export function ScreenBody({
  children,
  tabBar = false,
}: {
  children: ReactNode;
  tabBar?: boolean;
}) {
  const pane = usePane();
  return (
    <div
      className={styles.screen}
      data-role={pane.role}
      data-has-tabbar={tabBar && pane.role === 'single'}
    >
      {children}
    </div>
  );
}

/** Scrolling content of a screen. The shell owns the single main landmark around the panes. */
export function Content({ children, id }: { children: ReactNode; id?: string }) {
  return (
    <div className={styles.content} id={id}>
      {children}
    </div>
  );
}

/** Primary action pinned above the safe area and keyboard; one primary action per screen. */
export function ActionBar({
  children,
  note,
  columns = 1,
}: {
  children: ReactNode;
  note?: ReactNode;
  columns?: 1 | 2;
}) {
  return (
    <div className={styles.actionBar} data-columns={columns}>
      {children}
      {note && <p className={styles.actionNote}>{note}</p>}
    </div>
  );
}

export function Block({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={[styles.block, className ?? ''].join(' ')}>{children}</div>;
}

export function Rule() {
  return <hr className={styles.rule} />;
}

export function Disclaimer({ children }: { children: ReactNode }) {
  return <p className={styles.disclaimer}>{children}</p>;
}

export const layoutStyles = styles;
