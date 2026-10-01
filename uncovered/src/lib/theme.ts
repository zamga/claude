import { useSyncExternalStore } from 'react';

/*
 * Two looks for one document: Daylight (security paper) and UV (the same
 * document under an inspection lamp). "system" follows the OS. The resolved
 * theme lives on <html data-theme>, so CSS tokens and canvas renderers agree.
 */
export type ThemePreference = 'system' | 'light' | 'dark';
export type Theme = 'light' | 'dark';

const KEY = 'uncovered:theme';
const listeners = new Set<() => void>();
const media = typeof window !== 'undefined' ? window.matchMedia('(prefers-color-scheme: dark)') : null;

function readPreference(): ThemePreference {
  try {
    const v = window.localStorage.getItem(KEY);
    return v === 'light' || v === 'dark' ? v : 'system';
  } catch {
    return 'system';
  }
}

let preference: ThemePreference = typeof window === 'undefined' ? 'system' : readPreference();

/**
 * The theme on screen. The root's data-theme wins, whether this page set it or
 * a host embedding the page did; otherwise the operating system decides.
 */
function resolve(): Theme {
  const attr = typeof document !== 'undefined' ? document.documentElement.getAttribute('data-theme') : null;
  if (attr === 'light' || attr === 'dark') return attr;
  if (preference !== 'system') return preference;
  return media?.matches ? 'dark' : 'light';
}

function apply() {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  if (preference === 'system') root.removeAttribute('data-theme');
  else root.setAttribute('data-theme', preference);
}

media?.addEventListener('change', () => listeners.forEach((l) => l()));
if (typeof MutationObserver !== 'undefined' && typeof document !== 'undefined') {
  new MutationObserver(() => listeners.forEach((l) => l())).observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['data-theme'],
  });
}

export function setThemePreference(next: ThemePreference) {
  preference = next;
  try {
    if (next === 'system') window.localStorage.removeItem(KEY);
    else window.localStorage.setItem(KEY, next);
  } catch {
    // Storage can be unavailable (private windows, sandboxes); the choice still applies.
  }
  apply();
  listeners.forEach((l) => l());
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

export function useThemePreference(): ThemePreference {
  return useSyncExternalStore(
    subscribe,
    () => preference,
    () => 'system',
  );
}

export function useTheme(): Theme {
  return useSyncExternalStore(subscribe, resolve, () => 'light');
}

/** Read a CSS custom property from the root, for canvas drawing. */
export function token(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}
