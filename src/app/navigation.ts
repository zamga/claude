import { useCallback } from 'react';
import { useLocation, useNavigate, type Location } from 'react-router';
import { readJson, writeJson } from '@/lib/storage';
import { runNavigation } from '@/lib/viewTransition';
import {
  matchRoute,
  parentPath,
  resolveTab,
  TAB_ROOTS,
  type NavState,
  type TabId,
} from './routeTable';

/**
 * Per-tab navigation stacks on top of one browser history (spec page 19).
 * Each tab remembers its last location and scroll; Back follows in-app history when it exists,
 * otherwise a defined structural parent (deep links).
 */

interface TabMemoryEntry {
  pathname: string;
  search: string;
  state: NavState | null;
  scrollY: number;
}

const TAB_MEMORY_KEY = 'stockpicks.tabs.v1';
const SCROLL_KEY = 'stockpicks.scroll.v1';

const tabMemory: Partial<Record<TabId, TabMemoryEntry>> = readJson('session', TAB_MEMORY_KEY) ?? {};
const scrollMemory: Record<string, number> = readJson('session', SCROLL_KEY) ?? {};

export function rememberLocation(location: Location, scrollY: number): void {
  const match = matchRoute(location.pathname);
  const tab = resolveTab(match.route, location.state as NavState | null);
  if (!tab) return;
  tabMemory[tab] = {
    pathname: location.pathname,
    search: location.search,
    state: (location.state as NavState | null) ?? null,
    scrollY,
  };
  writeJson('session', TAB_MEMORY_KEY, tabMemory);
}

export function tabMemoryFor(tab: TabId): TabMemoryEntry | undefined {
  return tabMemory[tab];
}

export function saveScroll(key: string, y: number): void {
  scrollMemory[key] = y;
  const keys = Object.keys(scrollMemory);
  if (keys.length > 120) delete scrollMemory[keys[0]!];
  writeJson('session', SCROLL_KEY, scrollMemory);
}

export function savedScroll(key: string): number | undefined {
  return scrollMemory[key];
}

function historyIndex(): number {
  const state = window.history.state as { idx?: number } | null;
  return typeof state?.idx === 'number' ? state.idx : 0;
}

export interface PushOptions {
  replace?: boolean;
  /** Override the tab context for an inheriting route. */
  tab?: TabId;
  transition?: boolean;
}

const returnFocus = new Map<string, string>();

/**
 * A selector for the control that opened the next screen, so Back can return focus to it and
 * keyboard and screen-reader users continue from the row they chose (spec page 59, check 10).
 */
function returnSelector(to: string): string {
  const active = document.activeElement;
  if (active instanceof HTMLElement && active !== document.body) {
    const href = active.closest('a[href]')?.getAttribute('href');
    if (href) return `a[href="${CSS.escape(href)}"]`;
    const label = active.getAttribute('aria-label');
    if (label) return `${active.tagName.toLowerCase()}[aria-label="${CSS.escape(label)}"]`;
  }
  return `a[href="${CSS.escape(to)}"]`;
}

/** The control to refocus when history returns to this entry. */
export function returnFocusFor(key: string): string | undefined {
  return returnFocus.get(key);
}

export function useAppNavigation() {
  const navigate = useNavigate();
  const location = useLocation();

  const currentTab = (): TabId => {
    const match = matchRoute(location.pathname);
    return resolveTab(match.route, location.state as NavState | null) ?? 'picks';
  };

  const push = useCallback(
    (to: string, options: PushOptions = {}) => {
      const from = {
        pathname: location.pathname,
        search: location.search,
        state: (location.state as NavState | null) ?? null,
      };
      const target = matchRoute(to.split('?')[0] ?? '/');
      const tab =
        options.tab ??
        (target.route.tab === 'inherit' ? currentTab() : (target.route.tab ?? undefined));
      const state: NavState = { tab, from };
      if (!options.replace) {
        returnFocus.set(location.key, returnSelector(to));
        if (returnFocus.size > 100) returnFocus.delete(returnFocus.keys().next().value!);
      }
      const go = () => navigate(to, { replace: options.replace, state });
      runNavigation(options.transition === false ? 'none' : 'push', go);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [navigate, location],
  );

  const back = useCallback(
    (fallback?: string) => {
      const state = location.state as NavState | null;
      if (state?.from && historyIndex() > 0) {
        runNavigation('pop', () => navigate(-1));
        return;
      }
      const target = fallback ?? parentPath(matchRoute(location.pathname), location.search);
      runNavigation('pop', () => navigate(target, { replace: true, state: { tab: currentTab() } }));
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [navigate, location],
  );

  const switchTab = useCallback(
    (tab: TabId) => {
      const here = currentTab();
      if (tab === here) {
        // Re-selecting the active tab has no hidden reset; it only returns focus to the heading.
        document.querySelector<HTMLElement>('[data-screen-heading]')?.focus();
        return;
      }
      rememberLocation(location, window.scrollY);
      const memory = tabMemory[tab];
      const pathname = memory?.pathname ?? TAB_ROOTS[tab];
      const search = memory?.search ?? '';
      runNavigation('tab', () =>
        navigate(`${pathname}${search}`, { state: { ...(memory?.state ?? {}), tab } }),
      );
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [navigate, location],
  );

  return { push, back, switchTab, currentTab: currentTab() };
}

/** Href for an in-app link; navigation itself goes through `push` for transitions and state. */
export function hrefFor(path: string): string {
  return path;
}
