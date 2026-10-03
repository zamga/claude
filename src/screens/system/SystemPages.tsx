import { useSearchParams } from 'react-router';
import { useAppNavigation } from '@/app/navigation';
import { missingLiveVariables } from '@/app/config';
import { safeReturnTo } from '@/app/routeTable';
import { Button } from '@/components/Button';
import { ArrowRight, BookOpen, Lock, RefreshCw, Search } from '@/components/icons';
import { Notice } from '@/components/Status';
import { DATA_MODE } from '@/data/transport';
import { AuthLayout } from '@/features/AuthLayout';
import { restartApp } from '@/app/restart';
import { useDocumentTitle } from '@/features/title';
import styles from './SystemPages.module.css';

/** 404, styled as an instrument that does not trade here. */
export function NotFoundScreen() {
  const { push } = useAppNavigation();
  useDocumentTitle('Page not found');
  return (
    <AuthLayout
      title={
        <>
          Not
          <br />
          listed.
        </>
      }
      subtitle="This page doesn’t trade here. It may have moved, or the link may be mistyped."
    >
      <div className={styles.tape} aria-hidden>
        <span className={styles.symbol}>404</span>
        <span className={styles.price}>—</span>
        <span className={styles.flat} />
        <span className={styles.status}>No observations · page not found</span>
      </div>
      <Button full between icon={ArrowRight} onClick={() => push('/', { replace: true })}>
        Today’s picks
      </Button>
      <Button
        full
        variant="secondary"
        icon={Search}
        iconPosition="start"
        onClick={() => push('/search', { replace: true })}
      >
        Search companies
      </Button>
      <Button full variant="quiet" onClick={() => push('/help', { replace: true })}>
        Help & support
      </Button>
    </AuthLayout>
  );
}

/** A private destination without the needed session; resumes the original route after sign-in. */
export function AccessDeniedScreen() {
  const [params] = useSearchParams();
  const { push } = useAppNavigation();
  const returnTo = safeReturnTo(params.get('returnTo'));
  useDocumentTitle('Sign in required');
  return (
    <AuthLayout
      title={
        <>
          This needs
          <br />
          an account.
        </>
      }
      subtitle="Lists, alerts, saved research and the paper portfolio belong to an account. Published research stays open to everyone."
    >
      <div className={styles.icon}>
        <Lock size={32} aria-hidden />
      </div>
      <Button
        full
        onClick={() =>
          push(`/auth/sign-in?returnTo=${encodeURIComponent(returnTo)}`, { replace: true })
        }
      >
        Sign in
      </Button>
      <Button
        full
        variant="secondary"
        onClick={() =>
          push(`/auth/register?returnTo=${encodeURIComponent(returnTo)}`, { replace: true })
        }
      >
        Create an account
      </Button>
      <Button full variant="quiet" onClick={() => push('/', { replace: true })}>
        Continue to today’s picks
      </Button>
    </AuthLayout>
  );
}

/** Read-only or misconfigured service: says what still works and never pretends to save. */
export function MaintenanceScreen() {
  const [params] = useSearchParams();
  const { push } = useAppNavigation();
  const configuration = params.get('reason') === 'configuration';
  const missing = configuration ? missingLiveVariables() : [];
  useDocumentTitle(configuration ? 'Configuration required' : 'Temporarily read-only');
  return (
    <AuthLayout
      title={
        configuration ? (
          <>
            Configuration
            <br />
            required.
          </>
        ) : (
          <>
            Temporarily
            <br />
            read-only.
          </>
        )
      }
      subtitle={
        configuration
          ? 'This live build cannot start without its service settings, so it is not showing data it cannot verify.'
          : 'We are making changes. Saved research on this device is still readable; saving is paused and nothing is lost.'
      }
    >
      {configuration && missing.length > 0 && (
        <Notice tone="warning" title="Missing environment variables">
          <ul className={styles.list}>
            {missing.map((name) => (
              <li key={name}>
                <code>{name}</code>
              </li>
            ))}
          </ul>
          Set them in the deployment’s secret store and redeploy. Values are never shown here.
        </Notice>
      )}
      <Button full icon={RefreshCw} iconPosition="start" onClick={restartApp}>
        Try again
      </Button>
      {!configuration && (
        <Button
          full
          variant="secondary"
          icon={BookOpen}
          iconPosition="start"
          onClick={() => push('/research?view=saved')}
        >
          Open saved research
        </Button>
      )}
      {configuration && DATA_MODE === 'live' && (
        <p className="t-note t-muted">Running the demo build instead needs no configuration.</p>
      )}
    </AuthLayout>
  );
}
