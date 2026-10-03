import type { ReactNode } from 'react';
import { AppLink } from '@/components/AppLink';
import { BackButton, LargeTitle, TopBar, TopBarLabel } from '@/components/Header';
import { Content, ScreenBody } from '@/components/Layout';
import { DemoTag } from '@/components/Status';
import styles from './AuthLayout.module.css';

/** Standalone account screens: one narrow column, the brand label and the legal links. */
export function AuthLayout({
  title,
  subtitle,
  children,
  back,
  footer,
  step,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  children: ReactNode;
  back?: string;
  footer?: ReactNode;
  step?: { index: number; total: number; label: string };
}) {
  return (
    <ScreenBody>
      <TopBar
        leading={back ? <BackButton fallback={back} /> : <TopBarLabel>Stock picks</TopBarLabel>}
        title={step ? step.label : undefined}
        trailing={
          step ? (
            <span className={styles.step}>
              {step.index} of {step.total}
            </span>
          ) : (
            <DemoTag />
          )
        }
      />
      {step && (
        <div
          className={styles.progress}
          role="progressbar"
          aria-label={`${step.label}: step ${step.index} of ${step.total}`}
          aria-valuemin={1}
          aria-valuemax={step.total}
          aria-valuenow={step.index}
        >
          <span style={{ width: `${(step.index / step.total) * 100}%` }} />
        </div>
      )}
      <Content>
        <div className={styles.column}>
          <LargeTitle title={title} subtitle={subtitle} />
          <div className={styles.body}>{children}</div>
          {footer && <div className={styles.footer}>{footer}</div>}
          <nav className={styles.legal} aria-label="Legal">
            <AppLink to="/legal/terms">Terms</AppLink>
            <span aria-hidden>|</span>
            <AppLink to="/legal/privacy">Privacy</AppLink>
          </nav>
        </div>
      </Content>
    </ScreenBody>
  );
}
