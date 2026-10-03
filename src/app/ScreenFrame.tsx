import {
  Component,
  Suspense,
  useLayoutEffect,
  type ComponentType,
  type ErrorInfo,
  type ReactNode,
} from 'react';
import { useLocation } from 'react-router';
import { Button } from '@/components/Button';
import { EmptyState, Skeleton } from '@/components/Status';
import { Lock, TriangleAlert } from '@/components/icons';
import { signalRouteCommitted } from '@/lib/viewTransition';
import { usePane } from './pane';
import type { RouteMeta } from './routeTable';
import { useSession } from './session';
import { AppLink } from '@/components/AppLink';
import styles from './Shell.module.css';

/** Mounted with the screen (not its fallback): tells a pending view transition the new view is ready. */
function CommitSignal() {
  const location = useLocation();
  useLayoutEffect(() => {
    signalRouteCommitted();
  }, [location.key]);
  return null;
}

function ScreenFallback() {
  return (
    <div className={styles.fallback} aria-busy="true" aria-label="Loading">
      <div className={styles.fallbackBar} />
      <div className={styles.fallbackBody}>
        <Skeleton width="45%" height={12} />
        <Skeleton width="80%" height={44} />
        <Skeleton width="60%" height={44} />
        <Skeleton height={180} />
      </div>
    </div>
  );
}

interface BoundaryState {
  error: Error | null;
}

/** A render failure stays local to the screen with a retry; navigation remains available. */
class ScreenBoundary extends Component<{ children: ReactNode; resetKey: string }, BoundaryState> {
  override state: BoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): BoundaryState {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Screen render failed', error, info.componentStack);
  }

  override componentDidUpdate(previous: { resetKey: string }) {
    if (previous.resetKey !== this.props.resetKey && this.state.error)
      this.setState({ error: null });
  }

  override render() {
    if (this.state.error) {
      return (
        <EmptyState
          icon={TriangleAlert}
          title="This view could not be shown."
          actions={
            <>
              <Button full onClick={() => this.setState({ error: null })}>
                Try again
              </Button>
              <AppLink to="/" className="link">
                Go to today’s picks
              </AppLink>
            </>
          }
        >
          Your saved information is unaffected. If this keeps happening, report it from Help.
        </EmptyState>
      );
    }
    return this.props.children;
  }
}

function SignInRequired({ route }: { route: RouteMeta }) {
  const location = useLocation();
  const returnTo = `${location.pathname}${location.search}`;
  return (
    <div className={styles.gate}>
      <EmptyState
        icon={Lock}
        title="Sign in to continue."
        actions={
          <>
            <AppLink
              to={`/auth/sign-in?returnTo=${encodeURIComponent(returnTo)}`}
              className={styles.gateButton}
            >
              Sign in
            </AppLink>
            <AppLink
              to={`/auth/register?returnTo=${encodeURIComponent(returnTo)}`}
              className={styles.gateSecondary}
            >
              Create an account
            </AppLink>
          </>
        }
      >
        {route.title} belongs to your account. Published research stays readable without signing in.
      </EmptyState>
    </div>
  );
}

export function ScreenFrame({
  route,
  screen: Screen,
}: {
  route: RouteMeta;
  screen: ComponentType;
}) {
  const pane = usePane();
  const location = useLocation();
  const { signedIn, loading } = useSession();
  const gated = route.private && !loading && !signedIn;
  return (
    <div
      className={styles.frame}
      data-surface={route.surface}
      data-route={route.id}
      data-pane={pane.role}
    >
      <ScreenBoundary resetKey={location.key}>
        <Suspense fallback={<ScreenFallback />}>
          {gated ? (
            <SignInRequired route={route} />
          ) : route.private && loading ? (
            <ScreenFallback />
          ) : (
            <Screen />
          )}
          <CommitSignal />
        </Suspense>
      </ScreenBoundary>
    </div>
  );
}
