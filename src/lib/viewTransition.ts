/**
 * View Transitions wrapper for in-app navigation (spec pages 18–19).
 * push: detail.enter (+24 px, fade in, 240 ms); pop: detail.exit (200 ms); tab: 160 ms crossfade.
 * Browser back/forward is left to the platform gesture — no second animation is layered on it.
 * An optional shared anchor (the ticker) morphs from the tapped row into the detail header.
 */
export type NavKind = 'push' | 'pop' | 'tab' | 'none';

const ANCHOR = 'anchor-ticker';
let pendingCommit: (() => void) | null = null;
let pendingTimer: ReturnType<typeof setTimeout> | null = null;
let anchorSource: HTMLElement | null = null;
let anchorTarget: HTMLElement | null = null;

function supportsViewTransitions(): boolean {
  return typeof document !== 'undefined' && 'startViewTransition' in document;
}

/** Called from a link click: this element morphs into the destination's anchor target. */
export function markAnchorSource(element: HTMLElement | null): void {
  if (anchorSource) anchorSource.style.viewTransitionName = '';
  anchorSource = element;
  if (element && supportsViewTransitions()) element.style.viewTransitionName = ANCHOR;
}

/** Called by the shell once the new route is in the DOM. */
export function signalRouteCommitted(): void {
  if (pendingTimer) clearTimeout(pendingTimer);
  pendingTimer = null;
  const resolve = pendingCommit;
  pendingCommit = null;
  if (resolve && anchorSource) {
    const target =
      document.querySelector<HTMLElement>('[data-pane="detail"] [data-anchor-target="ticker"]') ??
      document.querySelector<HTMLElement>('[data-pane="single"] [data-anchor-target="ticker"]');
    if (target) {
      target.style.viewTransitionName = ANCHOR;
      anchorTarget = target;
    }
  }
  resolve?.();
}

function clearAnchors(): void {
  if (anchorSource) anchorSource.style.viewTransitionName = '';
  if (anchorTarget) anchorTarget.style.viewTransitionName = '';
  anchorSource = null;
  anchorTarget = null;
}

export function runNavigation(kind: NavKind, navigate: () => void): void {
  const root = document.documentElement;
  if (kind === 'none' || !supportsViewTransitions() || document.visibilityState !== 'visible') {
    clearAnchors();
    navigate();
    return;
  }
  // The latest navigation intent wins: settle any transition still waiting for its DOM.
  signalRouteCommitted();
  if (kind !== 'push') markAnchorSource(null);
  root.dataset.nav = kind;
  const transition = document.startViewTransition(
    () =>
      new Promise<void>((resolve) => {
        // The old view is captured; drop the source name so it is not duplicated in the new view.
        if (anchorSource) anchorSource.style.viewTransitionName = '';
        pendingCommit = resolve;
        // Never hold the old frame for long if the destination is slow to render.
        pendingTimer = setTimeout(signalRouteCommitted, 300);
        navigate();
      }),
  );
  transition.finished.finally(() => {
    clearAnchors();
    if (root.dataset.nav === kind) delete root.dataset.nav;
  });
}
