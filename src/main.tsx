import { StrictMode } from 'react';
import { createRoot, hydrateRoot } from 'react-dom/client';
import './styles/fonts.css';
import './styles/tokens.css';
import './styles/base.css';
import { App } from './app/App';
import { installTelemetry } from './lib/telemetry';

// Before hydration, so errors while attaching to the prerendered page are caught too.
installTelemetry();

const root = document.getElementById('root');
const app = (
  <StrictMode>
    <App />
  </StrictMode>
);

if (root?.firstElementChild) {
  // Prerendered page: attach to the HTML that is already there, but only
  // after the browser has painted it. Hydrating straight away would hold the
  // first paint (and the headline, the LCP element) behind React's work.
  // requestAnimationFrame runs just before the next paint; the timeout lands
  // just after it. A hidden page (background tab, speculative prerender) has
  // no frames, so it hydrates at once and is ready when shown.
  const hydrate = () => hydrateRoot(root, app);
  if (document.visibilityState === 'hidden') setTimeout(hydrate, 0);
  else requestAnimationFrame(() => setTimeout(hydrate, 0));
} else if (root) {
  createRoot(root).render(app);
}
