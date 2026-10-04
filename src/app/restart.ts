import { appUrl } from '@/lib/base';

/** Reload the app at its start screen, in the browser build and in the hash-routed preview. */
export function restartApp(): void {
  if (import.meta.env.VITE_ROUTER === 'hash') {
    window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}`);
    window.location.reload();
    return;
  }
  window.location.assign(appUrl('/'));
}
