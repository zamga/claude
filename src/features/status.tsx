import type { UseQueryResult } from '@tanstack/react-query';
import { useEffect, useState, useSyncExternalStore, type ReactNode } from 'react';
import { Button } from '@/components/Button';
import { EmptyState, InlineError, SkeletonRows, SlowRequestNotice } from '@/components/Status';
import { WifiOff } from '@/components/icons';
import { errorMessage, isApiError, isOfflineError } from '@/data/errors';
import { getConditions, subscribeConditions } from '@/data/transport';
import { useDelayedFlag } from '@/lib/hooks';

export function useOffline(): boolean {
  const [browserOffline, setBrowserOffline] = useState(
    () => typeof navigator !== 'undefined' && navigator.onLine === false,
  );
  useEffect(() => {
    const update = () => setBrowserOffline(navigator.onLine === false);
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  }, []);
  const simulated = useSyncExternalStore(
    subscribeConditions,
    () => getConditions().offline,
    () => false,
  );
  return browserOffline || simulated;
}

/**
 * When the visible data is a cached copy (offline, paused or a failed refresh), the instant it was
 * saved; otherwise null. Cached values are always labelled as such (spec pages 23, 27).
 */
export function useCachedAt(
  query: Pick<UseQueryResult, 'data' | 'fetchStatus' | 'isError' | 'error' | 'dataUpdatedAt'>,
): number | null {
  const offline = useOffline();
  if (query.data === undefined) return null;
  if (offline || query.fetchStatus === 'paused' || (query.isError && isOfflineError(query.error)))
    return query.dataUpdatedAt;
  return null;
}

interface QueryStateProps<T> {
  query: UseQueryResult<T, Error>;
  children: (data: T) => ReactNode;
  skeleton?: ReactNode;
  errorTitle?: string;
  /** Rendered when offline and nothing has been downloaded yet. */
  offlineTitle?: string;
  notFound?: ReactNode;
}

/**
 * The loading contract (spec page 27): keep the stable interface for fast responses, show
 * geometry-matched placeholders after 150 ms, explain after 10 s, distinguish offline-empty from
 * errors, and keep showing valid data when a refresh fails.
 */
export function QueryState<T>({
  query,
  children,
  skeleton,
  errorTitle,
  offlineTitle,
  notFound,
}: QueryStateProps<T>) {
  const pending = query.isPending && query.fetchStatus === 'fetching';
  const showSkeleton = useDelayedFlag(pending, 150);
  if (query.data !== undefined) {
    const refreshFailed = query.isError && !isOfflineError(query.error);
    return (
      <>
        {refreshFailed && (
          <InlineError
            message={`${errorMessage(query.error)} Showing the last loaded information.`}
            onRetry={() => void query.refetch()}
            retrying={query.isFetching}
          />
        )}
        {children(query.data)}
      </>
    );
  }
  if (query.isPending && query.fetchStatus === 'paused') {
    return (
      <EmptyState
        icon={WifiOff}
        size="section"
        title={offlineTitle ?? 'You’re offline and this has not been saved on this device yet.'}
        actions={
          <Button variant="quiet" onClick={() => void query.refetch()}>
            Try again
          </Button>
        }
      >
        Reconnect to load it. Anything you opened before stays readable.
      </EmptyState>
    );
  }
  if (query.isError) {
    if (isApiError(query.error) && query.error.code === 'not_found' && notFound)
      return <>{notFound}</>;
    return (
      <InlineError
        message={
          errorTitle ? `${errorTitle} ${errorMessage(query.error)}` : errorMessage(query.error)
        }
        onRetry={() => void query.refetch()}
        retrying={query.isFetching}
        requestId={isApiError(query.error) ? query.error.requestId : undefined}
      />
    );
  }
  // The placeholder occupies its space from the first frame (no layout shift when data lands) but
  // only becomes visible after 150 ms, so fast responses never flash a skeleton.
  return (
    <>
      <div
        style={{ visibility: showSkeleton ? 'visible' : 'hidden' }}
        aria-hidden={!showSkeleton || undefined}
      >
        {skeleton ?? <SkeletonRows rows={3} />}
      </div>
      <SlowRequestNotice active={pending} onRetry={() => void query.refetch()} />
    </>
  );
}
