import { matchPath } from 'react-router';

/**
 * Route metadata (spec pages 2, 19, 31–34, 44). Components are attached in routes.tsx; this
 * module stays import-free so navigation helpers can use it without loading screens.
 */

export type TabId = 'picks' | 'watchlist' | 'research' | 'profile';
export type RouteKind = 'collection' | 'detail' | 'standalone';
export type Surface = 'paper' | 'charcoal';

export interface RouteMeta {
  id: string;
  path: string;
  /** Owning tab; 'inherit' takes the tab from navigation state, falling back to `defaultTab`. */
  tab: TabId | 'inherit' | null;
  defaultTab?: TabId;
  kind: RouteKind;
  surface: Surface;
  title: string;
  /** Structural parent used for Back when there is no in-app history (deep links). */
  parent?: (params: Record<string, string | undefined>, search: URLSearchParams) => string;
  /** On desktop, which detail opens beside this collection by default. */
  defaultDetail?:
    | 'first-pick'
    | 'first-member'
    | 'first-report'
    | 'performance'
    | 'settings'
    | 'first-event'
    | 'first-ipo'
    | 'first-position';
  private?: boolean;
}

export const TAB_ROOTS: Record<TabId, string> = {
  picks: '/',
  watchlist: '/watchlist',
  research: '/research',
  profile: '/profile',
};

export const TAB_LABELS: Record<TabId, string> = {
  picks: 'Picks',
  watchlist: 'Watchlist',
  research: 'Research',
  profile: 'Profile',
};

export const ROUTES: RouteMeta[] = [
  // Picks
  {
    id: 'S01',
    path: '/',
    tab: 'picks',
    kind: 'collection',
    surface: 'paper',
    title: 'Today’s picks',
    defaultDetail: 'first-pick',
  },
  {
    id: 'S05',
    path: '/market',
    tab: 'picks',
    kind: 'collection',
    surface: 'paper',
    title: 'Market overview',
    parent: () => '/',
  },
  {
    id: 'S06',
    path: '/search',
    tab: 'picks',
    kind: 'collection',
    surface: 'paper',
    title: 'Find a pick',
    parent: () => '/',
  },
  {
    id: 'S07',
    path: '/earnings',
    tab: 'picks',
    kind: 'collection',
    surface: 'paper',
    title: 'Earnings calendar',
    parent: () => '/',
    defaultDetail: 'first-event',
  },
  {
    id: 'S08',
    path: '/earnings/:eventId',
    tab: 'inherit',
    defaultTab: 'picks',
    kind: 'detail',
    surface: 'charcoal',
    title: 'Earnings review',
    parent: () => '/earnings',
  },
  {
    id: 'S09',
    path: '/ipos',
    tab: 'picks',
    kind: 'collection',
    surface: 'paper',
    title: 'IPO radar',
    parent: () => '/',
    defaultDetail: 'first-ipo',
  },
  {
    id: 'S10',
    path: '/ipos/:ipoId',
    tab: 'inherit',
    defaultTab: 'picks',
    kind: 'detail',
    surface: 'charcoal',
    title: 'IPO analysis',
    parent: () => '/ipos',
  },
  {
    id: 'S02',
    path: '/stocks/:symbol',
    tab: 'inherit',
    defaultTab: 'picks',
    kind: 'detail',
    surface: 'charcoal',
    title: 'Pick analysis',
    parent: () => '/',
  },
  {
    id: 'S11',
    path: '/stocks/:symbol/thesis',
    tab: 'inherit',
    defaultTab: 'picks',
    kind: 'detail',
    surface: 'paper',
    title: 'Research note',
    parent: (p) => `/stocks/${p.symbol}`,
  },
  {
    id: 'S12',
    path: '/stocks/:symbol/valuation',
    tab: 'inherit',
    defaultTab: 'picks',
    kind: 'detail',
    surface: 'charcoal',
    title: 'Valuation',
    parent: (p) => `/stocks/${p.symbol}`,
  },

  // Watchlist
  {
    id: 'S13',
    path: '/watchlist',
    tab: 'watchlist',
    kind: 'collection',
    surface: 'paper',
    title: 'Watchlist',
    defaultDetail: 'first-member',
  },
  {
    id: 'S19',
    path: '/watchlist/alerts',
    tab: 'watchlist',
    kind: 'collection',
    surface: 'paper',
    title: 'Your alerts',
    parent: () => '/watchlist',
    private: true,
  },
  {
    id: 'alert-rules',
    path: '/alerts',
    tab: 'watchlist',
    kind: 'collection',
    surface: 'paper',
    title: 'Alert rules',
    parent: () => '/watchlist',
    private: true,
  },
  {
    id: 'S14',
    path: '/alerts/new',
    tab: 'inherit',
    defaultTab: 'watchlist',
    kind: 'detail',
    surface: 'paper',
    title: 'New alert',
    parent: (_p, s) => (s.get('instrument') ? `/stocks/${s.get('instrument')}` : '/alerts'),
    private: true,
  },
  {
    id: 'alert-edit',
    path: '/alerts/:ruleId/edit',
    tab: 'inherit',
    defaultTab: 'watchlist',
    kind: 'detail',
    surface: 'paper',
    title: 'Edit alert',
    parent: () => '/alerts',
    private: true,
  },
  {
    id: 'S15',
    path: '/portfolio',
    tab: 'watchlist',
    kind: 'collection',
    surface: 'paper',
    title: 'Paper portfolio',
    parent: () => '/watchlist',
    private: true,
    defaultDetail: 'first-position',
  },
  {
    id: 'S16',
    path: '/portfolio/:symbol',
    tab: 'watchlist',
    kind: 'detail',
    surface: 'charcoal',
    title: 'Model position',
    parent: () => '/portfolio',
    private: true,
  },
  {
    id: 'paper-transaction',
    path: '/paper/transactions/new',
    tab: 'watchlist',
    kind: 'detail',
    surface: 'paper',
    title: 'Update paper position',
    parent: (_p, s) => (s.get('instrument') ? `/portfolio/${s.get('instrument')}` : '/portfolio'),
    private: true,
  },
  {
    id: 'watchlist-new',
    path: '/watchlists/new',
    tab: 'watchlist',
    kind: 'detail',
    surface: 'paper',
    title: 'New watchlist',
    parent: () => '/watchlist',
    private: true,
  },
  {
    id: 'watchlist-edit',
    path: '/watchlists/:listId/edit',
    tab: 'watchlist',
    kind: 'detail',
    surface: 'paper',
    title: 'Edit watchlist',
    parent: (p) => `/watchlist?list=${p.listId}`,
    private: true,
  },

  // Research
  {
    id: 'S17',
    path: '/research',
    tab: 'research',
    kind: 'collection',
    surface: 'paper',
    title: 'The reading room',
    defaultDetail: 'first-report',
  },
  {
    id: 'S18',
    path: '/research/:reportId',
    tab: 'inherit',
    defaultTab: 'research',
    kind: 'detail',
    surface: 'paper',
    title: 'Report',
    parent: () => '/research',
  },
  {
    id: 'S23',
    path: '/archive',
    tab: 'research',
    kind: 'collection',
    surface: 'paper',
    title: 'The full record',
    parent: () => '/research',
    defaultDetail: 'performance',
  },
  {
    id: 'S24',
    path: '/archive/performance',
    tab: 'research',
    kind: 'detail',
    surface: 'charcoal',
    title: 'Performance review',
    parent: () => '/archive',
  },
  {
    id: 'archive-item',
    path: '/archive/:archiveId',
    tab: 'research',
    kind: 'detail',
    surface: 'paper',
    title: 'Archived pick',
    parent: () => '/archive',
  },

  // Profile
  {
    id: 'S21',
    path: '/profile',
    tab: 'profile',
    kind: 'collection',
    surface: 'paper',
    title: 'Your space',
    defaultDetail: 'settings',
  },
  {
    id: 'S22',
    path: '/settings',
    tab: 'profile',
    kind: 'detail',
    surface: 'paper',
    title: 'App settings',
    parent: () => '/profile',
  },
  {
    id: 'S20',
    path: '/settings/notifications',
    tab: 'profile',
    kind: 'detail',
    surface: 'paper',
    title: 'Alert settings',
    parent: () => '/profile',
    private: true,
  },
  {
    id: 'S04-profile',
    path: '/settings/research',
    tab: 'profile',
    kind: 'detail',
    surface: 'paper',
    title: 'Research preferences',
    parent: () => '/profile',
    private: true,
  },
  {
    id: 'account-edit',
    path: '/account/edit',
    tab: 'profile',
    kind: 'detail',
    surface: 'paper',
    title: 'Account details',
    parent: () => '/profile',
    private: true,
  },
  {
    id: 'account-security',
    path: '/account/security',
    tab: 'profile',
    kind: 'detail',
    surface: 'paper',
    title: 'Account security',
    parent: () => '/profile',
    private: true,
  },
  {
    id: 'account-data',
    path: '/account/data',
    tab: 'profile',
    kind: 'detail',
    surface: 'paper',
    title: 'Privacy & data',
    parent: () => '/profile',
    private: true,
  },
  {
    id: 'account-delete',
    path: '/account/delete',
    tab: 'profile',
    kind: 'detail',
    surface: 'paper',
    title: 'Delete account',
    parent: () => '/account/data',
    private: true,
  },
  {
    id: 'help',
    path: '/help',
    tab: 'profile',
    kind: 'collection',
    surface: 'paper',
    title: 'Help & support',
    parent: () => '/profile',
  },
  {
    id: 'help-article',
    path: '/help/:article',
    tab: 'profile',
    kind: 'detail',
    surface: 'paper',
    title: 'Help',
    parent: () => '/help',
  },
  {
    id: 'support',
    path: '/support',
    tab: 'profile',
    kind: 'detail',
    surface: 'paper',
    title: 'Report an issue',
    parent: () => '/help',
  },
  {
    id: 'legal',
    path: '/legal/:document',
    tab: 'profile',
    kind: 'detail',
    surface: 'paper',
    title: 'Legal',
    parent: () => '/profile',
  },
  {
    id: 'demo-tools',
    path: '/demo',
    tab: 'profile',
    kind: 'detail',
    surface: 'paper',
    title: 'Demo tools',
    parent: () => '/profile',
  },
  {
    id: 'catalogue',
    path: '/demo/components',
    tab: 'profile',
    kind: 'detail',
    surface: 'paper',
    title: 'Component catalogue',
    parent: () => '/demo',
  },

  // Standalone account flows
  {
    id: 'S03',
    path: '/auth/sign-in',
    tab: null,
    kind: 'standalone',
    surface: 'paper',
    title: 'Sign in',
  },
  {
    id: 'register',
    path: '/auth/register',
    tab: null,
    kind: 'standalone',
    surface: 'paper',
    title: 'Create account',
  },
  {
    id: 'verify',
    path: '/auth/verify',
    tab: null,
    kind: 'standalone',
    surface: 'paper',
    title: 'Verify your email',
  },
  {
    id: 'forgot',
    path: '/auth/forgot',
    tab: null,
    kind: 'standalone',
    surface: 'paper',
    title: 'Reset your password',
  },
  {
    id: 'reset',
    path: '/auth/reset',
    tab: null,
    kind: 'standalone',
    surface: 'paper',
    title: 'Choose a new password',
  },
  {
    id: 'callback',
    path: '/auth/callback',
    tab: null,
    kind: 'standalone',
    surface: 'paper',
    title: 'Signing in',
  },
  {
    id: 'S04',
    path: '/onboarding',
    tab: null,
    kind: 'standalone',
    surface: 'paper',
    title: 'Your preferences',
  },
  {
    id: 'access-denied',
    path: '/access-denied',
    tab: null,
    kind: 'standalone',
    surface: 'paper',
    title: 'Sign in required',
  },
  {
    id: 'maintenance',
    path: '/maintenance',
    tab: null,
    kind: 'standalone',
    surface: 'paper',
    title: 'Temporarily read-only',
  },
  {
    id: 'not-found',
    path: '*',
    tab: null,
    kind: 'standalone',
    surface: 'paper',
    title: 'Page not found',
  },
];

export interface RouteMatch {
  route: RouteMeta;
  params: Record<string, string | undefined>;
}

const SPECIFIC = ROUTES.filter((route) => route.path !== '*');
const NOT_FOUND = ROUTES.find((route) => route.path === '*')!;

export function matchRoute(pathname: string): RouteMatch {
  for (const route of SPECIFIC) {
    const match = matchPath({ path: route.path, end: true }, pathname);
    if (match) return { route, params: match.params };
  }
  return { route: NOT_FOUND, params: {} };
}

export interface NavState {
  tab?: TabId;
  /** The in-app location this one was opened from (Back target). */
  from?: { pathname: string; search: string; state: NavState | null };
}

export function resolveTab(route: RouteMeta, state: NavState | null | undefined): TabId | null {
  if (route.tab === 'inherit') return state?.tab ?? route.defaultTab ?? 'picks';
  return route.tab;
}

export function parentPath(match: RouteMatch, search: string): string {
  return match.route.parent?.(match.params, new URLSearchParams(search)) ?? '/';
}

/** Allowlisted in-app return targets for sign-in and callbacks (spec pages 44, 57). */
export function safeReturnTo(value: string | null | undefined): string {
  if (!value || !value.startsWith('/') || value.startsWith('//') || value.startsWith('/auth/'))
    return '/';
  const { route } = matchRoute(value.split('?')[0] ?? '/');
  return route.path === '*' ? '/' : value;
}
