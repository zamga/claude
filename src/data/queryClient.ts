import { dehydrate, hydrate, onlineManager, QueryClient, type Query } from '@tanstack/react-query';
import { isApiError } from './errors';
import { getConditions, subscribeConditions } from './transport';

/**
 * Server-state cache. Queries pause while offline (keeping the last values visible and labelled
 * as cached); mutations never queue — they fail immediately so a write is only ever reported as
 * saved after the service confirms it (spec pages 27, 57).
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 20_000,
      gcTime: 24 * 60 * 60_000,
      networkMode: 'online',
      refetchOnWindowFocus: true,
      retry: (count, error) =>
        isApiError(error) && error.retryable && error.code !== 'offline' && count < 2,
      retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 4000),
    },
    mutations: {
      networkMode: 'always',
      retry: false,
    },
  },
});

/** Mirror the simulated connection (demo tools) and the browser's own status into the cache. */
export function syncOnlineManager(): () => void {
  const update = () => {
    const browserOnline = typeof navigator === 'undefined' ? true : navigator.onLine;
    onlineManager.setOnline(browserOnline && !getConditions().offline);
  };
  update();
  const unsubscribe = subscribeConditions(update);
  window.addEventListener('online', update);
  window.addEventListener('offline', update);
  return () => {
    unsubscribe();
    window.removeEventListener('online', update);
    window.removeEventListener('offline', update);
  };
}

// ---------- Read cache persistence ----------

const PUBLIC_CACHE_KEY = 'stockpicks.cache.public.v1';
const PRIVATE_CACHE_PREFIX = 'stockpicks.cache.private.v1.';
const PUBLIC_ROOTS = new Set([
  'picks',
  'quote',
  'series',
  'instrument',
  'market',
  'report',
  'reports',
  'earnings',
  'ipos',
  'ipo',
  'archive',
  'valuation',
  'events',
]);

let privateAccountId: string | null = null;
let keepPrivate = false;

export function configurePrivatePersistence(accountId: string | null, enabled: boolean): void {
  privateAccountId = accountId;
  keepPrivate = enabled && accountId != null;
  if (!keepPrivate && accountId) {
    try {
      localStorage.removeItem(PRIVATE_CACHE_PREFIX + accountId);
    } catch {
      // Nothing stored.
    }
  }
}

function isPublic(query: Query): boolean {
  const root = query.queryKey[0];
  return typeof root === 'string' && PUBLIC_ROOTS.has(root);
}

function isPrivate(query: Query): boolean {
  return query.queryKey[0] === 'private';
}

function persist(): void {
  try {
    const publicState = dehydrate(queryClient, {
      shouldDehydrateQuery: (query) => query.state.status === 'success' && isPublic(query),
    });
    localStorage.setItem(PUBLIC_CACHE_KEY, JSON.stringify(publicState));
    if (keepPrivate && privateAccountId) {
      const privateState = dehydrate(queryClient, {
        shouldDehydrateQuery: (query) => query.state.status === 'success' && isPrivate(query),
      });
      localStorage.setItem(PRIVATE_CACHE_PREFIX + privateAccountId, JSON.stringify(privateState));
    }
  } catch {
    // Storage full or blocked: the app still works without an offline copy.
  }
}

export function restorePublicCache(): void {
  try {
    const raw = localStorage.getItem(PUBLIC_CACHE_KEY);
    if (raw) hydrate(queryClient, JSON.parse(raw));
  } catch {
    // Corrupt or blocked cache is ignored.
  }
}

export function restorePrivateCache(accountId: string): void {
  try {
    const raw = localStorage.getItem(PRIVATE_CACHE_PREFIX + accountId);
    if (raw) hydrate(queryClient, JSON.parse(raw));
  } catch {
    // Ignore.
  }
}

export function startCachePersistence(): () => void {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const unsubscribe = queryClient.getQueryCache().subscribe(() => {
    clearTimeout(timer);
    timer = setTimeout(persist, 800);
  });
  return () => {
    clearTimeout(timer);
    unsubscribe();
  };
}

/**
 * Drop every private query without pulling it out from under a mounted screen: a query that is
 * still observed (the tab bar's unread dot, the screen that signed out) is reset in place, so its
 * observers lose the data at once; unobserved ones are removed. Removing an observed query would
 * leave its observers showing the old account's data until they remount.
 */
export function dropPrivateQueries(): void {
  const cache = queryClient.getQueryCache();
  for (const query of cache.findAll({ queryKey: ['private'] })) {
    if (query.getObserversCount() > 0) query.reset();
    else cache.remove(query);
  }
}

/** Sign-out: clear private queries, drafts and this account's offline copy (spec page 55). */
export function clearPrivateClientState(accountId: string | null): void {
  // Signed out first, in place, so every mounted screen re-renders as a guest in the same pass.
  queryClient.setQueryData(['me'], null);
  dropPrivateQueries();
  try {
    if (accountId) localStorage.removeItem(PRIVATE_CACHE_PREFIX + accountId);
    // Drafts (session and device) and reading positions belong to the signed-in person.
    for (const store of [sessionStorage, localStorage]) {
      const keys: string[] = [];
      for (let i = 0; i < store.length; i += 1) {
        const key = store.key(i);
        if (key?.startsWith('stockpicks.draft.') || key === 'stockpicks.reading.v1') keys.push(key);
      }
      keys.forEach((key) => store.removeItem(key));
    }
  } catch {
    // Storage unavailable.
  }
  privateAccountId = null;
  keepPrivate = false;
}
