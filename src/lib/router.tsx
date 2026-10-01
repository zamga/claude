import { useSyncExternalStore, type AnchorHTMLAttributes, type MouseEvent, type ReactNode } from 'react';
import { flushSync } from 'react-dom';

/**
 * A small router with two address formats:
 *  - history: `/chart/nvda?s=TOKEN` (production, needs an SPA fallback);
 *  - hash:    `#chart.nvda~TOKEN` (static hosts and sandboxed previews, where
 *    only a plain anchor of letters, digits and `._~-` survives).
 * Navigation runs inside a View Transition when the browser supports it and
 * the visitor has not asked for reduced motion, then hands focus to the new
 * page so screen readers announce it.
 */
export type RouterMode = 'history' | 'hash';

export const ROUTER_MODE: RouterMode =
  import.meta.env.MODE === 'artifact' || import.meta.env.VITE_ROUTER === 'hash' ? 'hash' : 'history';

export interface Location {
  path: string;
  /** Opaque scenario token for shared charts. */
  state: string | null;
}

const TOKEN = /^[A-Za-z0-9_-]+$/;

function parseHash(hash: string): Location {
  const raw = hash.replace(/^#/, '');
  const [route = '', state = null] = raw.split('~');
  const path = '/' + route.split('.').filter(Boolean).join('/');
  return { path: path.toLowerCase(), state: state && TOKEN.test(state) ? state : null };
}

function readLocation(): Location {
  if (typeof window === 'undefined') return { path: '/', state: null };
  if (ROUTER_MODE === 'hash') return parseHash(window.location.hash);
  const params = new URLSearchParams(window.location.search);
  const s = params.get('s');
  const path = window.location.pathname.replace(/\/+$/, '') || '/';
  return { path: path.toLowerCase(), state: s && TOKEN.test(s) ? s : null };
}

/** Build the address for a path in the current router mode. */
export function href(path: string, state?: string | null): string {
  if (ROUTER_MODE === 'hash') {
    const route = path.split('/').filter(Boolean).join('.');
    return `#${route}${state ? `~${state}` : ''}`;
  }
  return `${path}${state ? `?s=${state}` : ''}`;
}

/** The absolute, shareable URL for a path. */
export function absoluteUrl(path: string, state?: string | null): string {
  if (ROUTER_MODE === 'hash') {
    return `${window.location.origin}${window.location.pathname}${href(path, state)}`;
  }
  return `${window.location.origin}${href(path, state)}`;
}

let current = readLocation();
const listeners = new Set<() => void>();

/** Prerendering: tell the router which page is being rendered. */
export function setServerLocation(path: string) {
  current = { path: path.toLowerCase(), state: null };
}

function emit() {
  current = readLocation();
  listeners.forEach((l) => l());
}

if (typeof window !== 'undefined') {
  window.addEventListener(ROUTER_MODE === 'hash' ? 'hashchange' : 'popstate', () => {
    emit();
    afterNavigate(false);
  });
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useLocation(): Location {
  return useSyncExternalStore(
    subscribe,
    () => current,
    () => current,
  );
}

function prefersReducedMotion() {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
}

function afterNavigate(scrollTop: boolean) {
  if (scrollTop) window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
  // Let the new page render, then move focus to it for assistive technology.
  requestAnimationFrame(() => {
    const target = document.querySelector<HTMLElement>('[data-page-focus]') ?? document.getElementById('main');
    target?.focus({ preventScroll: true });
  });
}

export interface NavigateOptions {
  replace?: boolean;
  state?: string | null;
  /** Skip the page transition, for in-place updates such as a new share token. */
  quiet?: boolean;
}

export function navigate(path: string, options: NavigateOptions = {}): void {
  const target = href(path, options.state);
  const samePath = readLocation().path === path.toLowerCase();
  const commit = () => {
    if (ROUTER_MODE === 'hash') {
      const url = `${window.location.pathname}${window.location.search}${target}`;
      if (options.replace) window.history.replaceState(null, '', url);
      else window.history.pushState(null, '', url);
    } else if (options.replace) {
      window.history.replaceState(null, '', target);
    } else {
      window.history.pushState(null, '', target);
    }
    emit();
  };

  const animate =
    !options.quiet && !samePath && typeof document.startViewTransition === 'function' && !prefersReducedMotion();

  if (animate) {
    document.startViewTransition(() => flushSync(commit));
  } else {
    commit();
  }
  if (!options.quiet && !samePath) afterNavigate(true);
}

/** Match `/chart/:ticker` style patterns. Returns params or null. */
export function matchPath(pattern: string, path: string): Record<string, string> | null {
  const p = pattern.split('/').filter(Boolean);
  const s = path.split('/').filter(Boolean);
  if (p.length !== s.length) return null;
  const params: Record<string, string> = {};
  for (let i = 0; i < p.length; i++) {
    const part = p[i]!;
    const seg = s[i]!;
    if (part.startsWith(':')) params[part.slice(1)] = decodeURIComponent(seg);
    else if (part !== seg) return null;
  }
  return params;
}

interface LinkProps extends Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> {
  to: string;
  state?: string | null;
  children: ReactNode;
}

export function Link({ to, state, onClick, children, ...rest }: LinkProps) {
  const handle = (event: MouseEvent<HTMLAnchorElement>) => {
    onClick?.(event);
    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey ||
      rest.target === '_blank'
    ) {
      return;
    }
    event.preventDefault();
    navigate(to, { state });
  };
  return (
    <a href={href(to, state)} onClick={handle} {...rest}>
      {children}
    </a>
  );
}
