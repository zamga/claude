import { lazy, type ComponentType, type LazyExoticComponent } from 'react';
import type { RouteObject } from 'react-router';
import { ROUTES } from './routeTable';
import { ScreenFrame } from './ScreenFrame';

type Screen = LazyExoticComponent<ComponentType>;

function named<T extends Record<string, ComponentType>>(
  loader: () => Promise<T>,
  name: keyof T,
): Screen {
  return lazy(() => loader().then((module) => ({ default: module[name] as ComponentType })));
}

import DailyPicksScreen from '@/screens/picks/DailyPicks';

// Today's picks is the landing view and ships in the entry chunk (no second round trip before the
// first meaningful paint). Pick analysis, the usual next step, is warmed during idle time.
const analysis = () => import('@/screens/stock/PickAnalysis');

export const SCREENS: Record<string, Screen | ComponentType> = {
  S01: DailyPicksScreen,
  S02: lazy(analysis),
  S05: lazy(() => import('@/screens/picks/MarketOverview')),
  S06: lazy(() => import('@/screens/picks/Search')),
  S07: lazy(() => import('@/screens/picks/EarningsCalendar')),
  S08: lazy(() => import('@/screens/picks/EarningsReview')),
  S09: lazy(() => import('@/screens/picks/IpoPipeline')),
  S10: lazy(() => import('@/screens/picks/IpoDossier')),
  S11: lazy(() => import('@/screens/stock/InvestmentThesis')),
  S12: lazy(() => import('@/screens/stock/Valuation')),
  S13: lazy(() => import('@/screens/watchlist/Watchlists')),
  S19: lazy(() => import('@/screens/watchlist/AlertInbox')),
  'alert-rules': lazy(() => import('@/screens/watchlist/AlertRules')),
  S14: named(() => import('@/screens/watchlist/AlertEditor'), 'CreateAlertScreen'),
  'alert-edit': named(() => import('@/screens/watchlist/AlertEditor'), 'EditAlertScreen'),
  'watchlist-new': named(() => import('@/screens/watchlist/WatchlistEditor'), 'NewWatchlistScreen'),
  'watchlist-edit': named(
    () => import('@/screens/watchlist/WatchlistEditor'),
    'EditWatchlistScreen',
  ),
  S15: lazy(() => import('@/screens/portfolio/PaperPortfolio')),
  S16: lazy(() => import('@/screens/portfolio/PaperPosition')),
  'paper-transaction': lazy(() => import('@/screens/portfolio/PaperTransaction')),
  S17: lazy(() => import('@/screens/research/ResearchLibrary')),
  S18: lazy(() => import('@/screens/research/ReportReader')),
  S23: lazy(() => import('@/screens/research/PickArchive')),
  S24: lazy(() => import('@/screens/research/PerformanceReview')),
  'archive-item': lazy(() => import('@/screens/research/ArchivedPickDetail')),
  S21: lazy(() => import('@/screens/profile/Profile')),
  S22: lazy(() => import('@/screens/profile/AppSettings')),
  S20: lazy(() => import('@/screens/profile/AlertSettings')),
  'S04-profile': named(
    () => import('@/screens/account/Personalization'),
    'ProfilePreferencesScreen',
  ),
  S04: named(() => import('@/screens/account/Personalization'), 'OnboardingScreen'),
  'account-edit': lazy(() => import('@/screens/account/AccountEdit')),
  'account-security': lazy(() => import('@/screens/account/AccountSecurity')),
  'account-data': lazy(() => import('@/screens/account/AccountData')),
  'account-delete': lazy(() => import('@/screens/account/AccountDelete')),
  help: named(() => import('@/screens/profile/Help'), 'HelpScreen'),
  'help-article': named(() => import('@/screens/profile/Help'), 'HelpArticleScreen'),
  support: named(() => import('@/screens/profile/Help'), 'SupportScreen'),
  legal: named(() => import('@/screens/profile/Help'), 'LegalScreen'),
  'demo-tools': lazy(() => import('@/screens/profile/DemoTools')),
  catalogue: lazy(() => import('@/screens/profile/Catalogue')),
  S03: lazy(() => import('@/screens/auth/SignIn')),
  register: lazy(() => import('@/screens/auth/Register')),
  verify: lazy(() => import('@/screens/auth/Verify')),
  forgot: named(() => import('@/screens/auth/PasswordReset'), 'ForgotPasswordScreen'),
  reset: named(() => import('@/screens/auth/PasswordReset'), 'ResetPasswordScreen'),
  callback: lazy(() => import('@/screens/auth/Callback')),
  'access-denied': named(() => import('@/screens/system/SystemPages'), 'AccessDeniedScreen'),
  maintenance: named(() => import('@/screens/system/SystemPages'), 'MaintenanceScreen'),
  'not-found': named(() => import('@/screens/system/SystemPages'), 'NotFoundScreen'),
};

/** Warm the entry chunks during idle time so the first navigation is instant. */
export function preloadCoreScreens(): void {
  void analysis();
}

export const ROUTE_OBJECTS: RouteObject[] = ROUTES.map((route) => ({
  path: route.path,
  element: <ScreenFrame key={route.id} route={route} screen={SCREENS[route.id]!} />,
}));
