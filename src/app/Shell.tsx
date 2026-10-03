import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useLocation, useNavigationType, useRoutes, type Location } from 'react-router';
import { markFirstPaint } from '@/data/api';
import { useAnnouncer } from '@/lib/announcer';
import { useIsDesktop } from '@/lib/hooks';
import { useDisplay } from './display';
import { DefaultDetail } from './DefaultDetail';
import { ConnectivityBanner } from './ConnectivityBanner';
import { NavRail } from './NavRail';
import { rememberLocation, returnFocusFor, saveScroll, savedScroll } from './navigation';
import { PaneContext, type PaneInfo } from './pane';
import { ROUTE_OBJECTS } from './routes';
import {
  matchRoute,
  parentPath,
  resolveTab,
  TAB_ROOTS,
  type NavState,
  type RouteMeta,
} from './routeTable';
import styles from './Shell.module.css';
import { TabBar } from './TabBar';
import { UpdatePrompt } from './UpdatePrompt';

const SURFACE_COLORS = { paper: '#f8f5ed', charcoal: '#101512' } as const;

type PaneLocation = Pick<Location, 'pathname' | 'search' | 'hash' | 'state' | 'key'>;

function Pane({ location, info }: { location: PaneLocation; info: PaneInfo }) {
  const element = useRoutes(ROUTE_OBJECTS, location);
  return <PaneContext.Provider value={info}>{element}</PaneContext.Provider>;
}

/** Nearest collection to show beside a detail: the in-app origin first, then structural parents. */
function collectionFor(location: Location, route: RouteMeta, tab: string): PaneLocation {
  const state = location.state as NavState | null;
  let cursor = state?.from;
  for (let depth = 0; cursor && depth < 8; depth += 1) {
    const match = matchRoute(cursor.pathname);
    if (match.route.kind === 'collection') {
      return {
        pathname: cursor.pathname,
        search: cursor.search,
        hash: '',
        state: cursor.state,
        key: `collection:${cursor.pathname}${cursor.search}`,
      };
    }
    cursor = cursor.state?.from;
  }
  let path = parentPath(matchRoute(location.pathname), location.search);
  for (let depth = 0; depth < 6; depth += 1) {
    const [pathname = '/', search = ''] = path.split('?');
    const match = matchRoute(pathname);
    if (match.route.kind === 'collection') {
      return {
        pathname,
        search: search ? `?${search}` : '',
        hash: '',
        state: { tab: tab as NavState['tab'] },
        key: `collection:${path}`,
      };
    }
    path = parentPath(match, search ? `?${search}` : '');
  }
  const root = route.defaultTab ? TAB_ROOTS[route.defaultTab] : '/';
  return { pathname: root, search: '', hash: '', state: null, key: `collection:${root}` };
}

function restoreWindowScroll(target: number): () => void {
  let cancelled = false;
  const started = performance.now();
  const cancel = () => {
    cancelled = true;
  };
  window.addEventListener('wheel', cancel, { passive: true, once: true });
  window.addEventListener('touchstart', cancel, { passive: true, once: true });
  const attempt = () => {
    if (cancelled) return;
    const max = document.documentElement.scrollHeight - window.innerHeight;
    window.scrollTo(0, Math.min(target, Math.max(max, 0)));
    if (max >= target || performance.now() - started > 1500) return;
    requestAnimationFrame(attempt);
  };
  attempt();
  return () => {
    cancelled = true;
    window.removeEventListener('wheel', cancel);
    window.removeEventListener('touchstart', cancel);
  };
}

let focusRun = 0;

/**
 * Moves focus after a navigation: back to the control that opened the next screen when history
 * returns to it, otherwise to the new screen's heading. A newer navigation, or focus the person
 * moved themselves while the screen was loading, always wins.
 */
function focusDestination(returnTo: string | undefined): void {
  const run = ++focusRun;
  const started = performance.now();
  const initial = document.activeElement;
  const attempt = () => {
    if (run !== focusRun) return;
    const active = document.activeElement;
    if (active && active !== initial && active !== document.body) return;
    const elapsed = performance.now() - started;
    if (returnTo) {
      const control = document.querySelector<HTMLElement>(`[data-pane] ${returnTo}`);
      if (control) {
        control.focus({ preventScroll: true });
        return;
      }
      // The returning screen may still be rendering its rows; after a second, use the heading.
      if (elapsed < 1000) {
        requestAnimationFrame(attempt);
        return;
      }
    }
    const heading =
      document.querySelector<HTMLElement>('[data-pane="detail"] [data-screen-heading]') ??
      document.querySelector<HTMLElement>('[data-pane="single"] [data-screen-heading]');
    if (heading) {
      heading.focus({ preventScroll: true });
      return;
    }
    if (elapsed < 1500) requestAnimationFrame(attempt);
  };
  requestAnimationFrame(attempt);
}

export function Shell() {
  const location = useLocation();
  const navigationType = useNavigationType();
  const isDesktop = useIsDesktop();
  const announcer = useAnnouncer();
  const { resolved } = useDisplay();
  const match = useMemo(() => matchRoute(location.pathname), [location.pathname]);
  const state = location.state as (NavState & { restoreScroll?: number }) | null;
  const tab = resolveTab(match.route, state);
  const standalone = match.route.kind === 'standalone';
  const split = isDesktop && !standalone;
  const initial = useRef(true);

  // Passive effects run after the browser has painted the first frame.
  useEffect(() => {
    markFirstPaint();
  }, []);

  // Track the scroll of the visible location so Back can restore it exactly.
  useEffect(() => {
    let frame = 0;
    const onScroll = () => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        saveScroll(location.key, window.scrollY);
      });
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      cancelAnimationFrame(frame);
      rememberLocation(location, window.scrollY);
    };
  }, [location]);

  // Restore position on Back and tab return; new pushes start at the top.
  useLayoutEffect(() => {
    if (initial.current) return undefined;
    if (navigationType === 'POP') {
      const saved = savedScroll(location.key);
      return restoreWindowScroll(saved ?? 0);
    }
    if (typeof state?.restoreScroll === 'number') return restoreWindowScroll(state.restoreScroll);
    window.scrollTo(0, 0);
    return undefined;
  }, [location.key, navigationType, state?.restoreScroll]);

  // Default title in a layout effect; screens refine it in a passive effect that runs afterwards.
  useLayoutEffect(() => {
    document.title = `${match.route.title} · Stock Picks`;
  }, [location.key, match.route.title]);

  // Canonical URL for public routes (query parameters only change views of the same page).
  useEffect(() => {
    const origin = (import.meta.env.VITE_APP_URL as string | undefined)?.replace(/\/$/, '');
    if (!origin) return;
    let link = document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!link) {
      link = document.createElement('link');
      link.rel = 'canonical';
      document.head.append(link);
    }
    link.href = `${origin}${location.pathname}`;
  }, [location.pathname]);

  // Theme colour, focus and the route announcement.
  useEffect(() => {
    const surface = resolved.night ? 'charcoal' : match.route.surface;
    document.documentElement.style.setProperty('--shell-bg', SURFACE_COLORS[surface]);
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute('content', SURFACE_COLORS[surface]);
    if (initial.current) {
      initial.current = false;
      return;
    }
    const timer = setTimeout(
      () => announcer.polite(document.title.replace(' · Stock Picks', '')),
      60,
    );
    focusDestination(navigationType === 'POP' ? returnFocusFor(location.key) : undefined);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.key, resolved.night]);

  const showTabBar = !split && !standalone && match.route.kind === 'collection';
  const singleInfo: PaneInfo = useMemo(
    () => ({
      role: 'single',
      showBack: match.route.kind === 'detail',
      isDefaultDetail: false,
      detailPath: null,
    }),
    [match.route.kind],
  );

  let body: ReactNode;
  if (!split) {
    body = (
      <div
        className={styles.single}
        data-standalone={standalone}
        style={{ viewTransitionName: 'screen' }}
      >
        <Pane location={location} info={singleInfo} />
      </div>
    );
  } else if (match.route.kind === 'collection') {
    body = (
      <>
        <section
          className={styles.collectionPane}
          aria-label={match.route.title}
          style={{ viewTransitionName: 'collection' }}
        >
          <CollectionScroller pathKey={`${location.pathname}${location.search}`}>
            <Pane
              location={location}
              info={{
                role: 'collection',
                showBack: false,
                isDefaultDetail: false,
                detailPath: null,
              }}
            />
          </CollectionScroller>
        </section>
        <div className={styles.detailPane} style={{ viewTransitionName: 'screen' }}>
          <DefaultDetail
            route={match.route}
            location={location}
            render={(detail) => (
              <Pane
                location={detail}
                info={{
                  role: 'detail',
                  showBack: false,
                  isDefaultDetail: true,
                  detailPath: detail.pathname,
                }}
              />
            )}
          />
        </div>
      </>
    );
  } else {
    const collection = collectionFor(location, match.route, tab ?? 'picks');
    body = (
      <>
        <section
          className={styles.collectionPane}
          aria-label={matchRoute(collection.pathname).route.title}
          style={{ viewTransitionName: 'collection' }}
        >
          <CollectionScroller pathKey={`${collection.pathname}${collection.search}`}>
            <Pane
              location={collection}
              info={{
                role: 'collection',
                showBack: false,
                isDefaultDetail: false,
                detailPath: location.pathname,
              }}
            />
          </CollectionScroller>
        </section>
        <div className={styles.detailPane} style={{ viewTransitionName: 'screen' }}>
          <Pane
            location={location}
            info={{
              role: 'detail',
              showBack: true,
              isDefaultDetail: false,
              detailPath: location.pathname,
            }}
          />
        </div>
      </>
    );
  }

  return (
    <div
      className={styles.shell}
      data-layout={split ? 'split' : standalone ? 'standalone' : 'single'}
    >
      <a className={styles.skip} href="#main-content">
        Skip to content
      </a>
      {split && <NavRail current={tab ?? 'picks'} />}
      <div className={styles.workspace}>
        <ConnectivityBanner />
        {/* One main landmark for every layout, so the skip link always has a target. */}
        <main id="main-content" className={styles.panes} tabIndex={-1}>
          {body}
        </main>
      </div>
      {showTabBar && <TabBar current={tab ?? 'picks'} />}
      <UpdatePrompt />
    </div>
  );
}

/** The collection pane scrolls independently and remembers its position per collection. */
function CollectionScroller({ pathKey, children }: { pathKey: string; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [restored, setRestored] = useState(pathKey);
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return undefined;
    const key = `pane:${pathKey}`;
    const target = savedScroll(key) ?? 0;
    const started = performance.now();
    const attempt = () => {
      element.scrollTop = target;
      if (element.scrollTop >= target - 1 || performance.now() - started > 1200) return;
      requestAnimationFrame(attempt);
    };
    attempt();
    setRestored(pathKey);
    const onScroll = () => saveScroll(key, element.scrollTop);
    element.addEventListener('scroll', onScroll, { passive: true });
    return () => element.removeEventListener('scroll', onScroll);
  }, [pathKey]);
  return (
    <div ref={ref} className={styles.collectionScroll} data-restored={restored === pathKey}>
      {children}
    </div>
  );
}
