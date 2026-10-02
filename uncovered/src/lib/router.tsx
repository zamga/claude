import { useSyncExternalStore, type AnchorHTMLAttributes, type MouseEvent, type ReactNode } from 'react';
import { flushSync } from 'react-dom';
import { gpuDraws } from './gpu';

/*
 * A small router. Production uses real paths (/report/krka); the single-file
 * preview uses hash anchors (#report.krka), because embedded previews only
 * pass a plain #anchor through. Navigation runs in a View Transition where
 * supported and moves focus to the new page's heading.
 */
const HASH = import.meta.env.MODE === 'artifact';

export interface Location {
  path: string;
  query: URLSearchParams;
}

function read(): Location {
  if (typeof window === 'undefined') return { path: '/', query: new URLSearchParams() };
  if (HASH) {
    const raw = window.location.hash.replace(/^#/, '');
    const [route = '', q = ''] = raw.split('~');
    return { path: '/' + route.split('.').filter(Boolean).join('/'), query: new URLSearchParams(q.replace(/_/g, '&')) };
  }
  return {
    path: window.location.pathname.replace(/\/+$/, '') || '/',
    query: new URLSearchParams(window.location.search),
  };
}

let current = read();

/** Server rendering has no window to read the address from, so the renderer sets it ("/initiate?run=…"). */
export function setServerLocation(address: string) {
  const [path = '/', search = ''] = address.split('?');
  current = { path, query: new URLSearchParams(search) };
}
const listeners = new Set<() => void>();
// Set while navigate() itself changes the hash, so the hashchange it causes is not handled twice.
let internal = false;

function emit() {
  current = read();
  listeners.forEach((l) => l());
}

if (typeof window !== 'undefined') {
  window.addEventListener(HASH ? 'hashchange' : 'popstate', () => {
    if (internal) {
      internal = false;
      return;
    }
    emit();
    afterNavigate(false, currentAnchor());
  });
}

/** The in-page anchor of the current address, if any: "#report.krka~valuation" or "/report/krka#valuation". */
export function currentAnchor(): string | undefined {
  if (typeof window === 'undefined') return undefined;
  const raw = HASH ? (window.location.hash.split('~')[1] ?? '') : window.location.hash.replace(/^#/, '');
  return /^[\w-]+$/.test(raw) ? raw : undefined;
}

/** Scroll an anchor into view and move focus to it, as following a link to it would. */
export function focusAnchor(anchor: string): boolean {
  const target = document.getElementById(anchor);
  if (!target) return false;
  target.scrollIntoView({ block: 'start' });
  if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1');
  target.focus({ preventScroll: true });
  return true;
}

export function useLocation(): Location {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => current,
    () => current,
  );
}

export function href(path: string): string {
  if (!HASH) return path;
  const [p = '/', hash = ''] = path.split('#');
  return `#${p.split('/').filter(Boolean).join('.')}${hash ? `~${hash}` : ''}`;
}

/**
 * Move focus to the new page's heading. Pages load lazily, and while one loads
 * React keeps the outgoing page mounted but hidden, so wait for a heading that
 * is actually rendered (up to three seconds, however slowly frames come on a
 * slow device) before settling for the main landmark.
 */
function focusPage(until = performance.now() + 3000) {
  const target = Array.from(document.querySelectorAll<HTMLElement>('[data-page-focus]')).find(
    (el) => el.getClientRects().length > 0,
  );
  if (target) target.focus({ preventScroll: true });
  else if (performance.now() < until) requestAnimationFrame(() => focusPage(until));
  else document.getElementById('main')?.focus({ preventScroll: true });
}

function afterNavigate(scrollTop: boolean, anchor?: string) {
  requestAnimationFrame(() => {
    // A page that is still loading scrolls to its anchor itself once it renders (see currentAnchor).
    if (anchor && focusAnchor(anchor)) return;
    if (scrollTop) window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
    focusPage();
  });
}

/*
 * Page transitions only where a GPU composites the page. Compositing in
 * software, Chrome can spend its whole four-second limit capturing these pages
 * (masks under a named masthead and cover) and then draw no further frames, so
 * there the page simply changes. A device that is slow to capture anyway (the
 * old page is normally captured within a frame) gets no more transitions this
 * visit: a page held behind a stalled transition is worse than a cut.
 */
const MOST_TO_CAPTURE = 400;
let transitions = true;

export function navigate(to: string) {
  const [path = '/', anchor] = to.split('#');
  const same = path === current.path;
  const commit = () => {
    if (HASH) {
      const next = href(to).slice(1);
      if (window.location.hash.slice(1) !== next) {
        internal = true;
        window.location.hash = next;
      }
    } else window.history.pushState(null, '', to);
    emit();
  };
  const after = () => {
    if (anchor) afterNavigate(false, anchor);
    else if (!same) afterNavigate(true);
  };
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!same && transitions && !reduce && typeof document.startViewTransition === 'function' && gpuDraws()) {
    // Focus and scroll wait for the new page's DOM, not the outgoing snapshot.
    const transition = document.startViewTransition(() => flushSync(commit));
    transition.updateCallbackDone.then(after, after);
    const slow = window.setTimeout(() => (transitions = false), MOST_TO_CAPTURE);
    const captured = () => window.clearTimeout(slow);
    transition.updateCallbackDone.then(captured, captured);
  } else {
    commit();
    after();
  }
}

interface LinkProps extends Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> {
  to: string;
  children: ReactNode;
}

export function Link({ to, onClick, children, ...rest }: LinkProps) {
  const handle = (e: MouseEvent<HTMLAnchorElement>) => {
    onClick?.(e);
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    navigate(to);
  };
  return (
    <a href={href(to)} onClick={handle} {...rest}>
      {children}
    </a>
  );
}
