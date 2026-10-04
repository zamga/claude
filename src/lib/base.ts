/**
 * Where the app is served from: "/" at a domain root, "/claude/" on a GitHub Pages project site,
 * "./" in the hash-routed preview build. The router handles in-app links; these helpers cover the
 * few URLs that bypass it (full reloads, redirects before the router starts).
 */
const BASE = import.meta.env.BASE_URL;

/** Router basename for the browser router: "/claude" under a sub-path, undefined at the root. */
export const ROUTER_BASENAME =
  BASE.startsWith('/') && BASE !== '/' ? BASE.replace(/\/$/, '') : undefined;

/** The full address of an in-app path, for navigation that does not go through the router. */
export function appUrl(path: string): string {
  return `${ROUTER_BASENAME ?? ''}${path}`;
}
