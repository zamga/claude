/**
 * One polite live region for the whole app. Chart readings change as people
 * drag; we announce the settled result, not every intermediate frame.
 */
let region: HTMLElement | null = null;
let timer = 0;

function ensureRegion() {
  if (region) return region;
  region = document.createElement('div');
  region.setAttribute('role', 'status');
  region.setAttribute('aria-live', 'polite');
  region.className = 'visually-hidden';
  document.body.appendChild(region);
  return region;
}

export function announce(message: string, delay = 600) {
  window.clearTimeout(timer);
  timer = window.setTimeout(() => {
    const el = ensureRegion();
    el.textContent = '';
    // A fresh text node makes screen readers re-read identical messages.
    requestAnimationFrame(() => {
      el.textContent = message;
    });
  }, delay);
}
