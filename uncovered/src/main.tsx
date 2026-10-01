import { StrictMode } from 'react';
import { createRoot, hydrateRoot } from 'react-dom/client';
import './styles/tokens.css';
import './styles/base.css';
import { App } from './app/App';
import { provideRun, renderedAddress, type GivenRun } from './lib/run';
import { registerReport } from './report/library';
import type { Report } from './report/types';

// A report or a run the server rendered into this page travels with it, so the page hydrates without asking again.
const report = document.getElementById('report-data')?.textContent;
if (report) registerReport(JSON.parse(report) as Report);
const run = document.getElementById('run-data')?.textContent;
if (run) provideRun(JSON.parse(run) as GivenRun);

const root = document.getElementById('root');
if (root) {
  const app = (
    <StrictMode>
      <App />
    </StrictMode>
  );
  const here = renderedAddress(
    window.location.pathname.replace(/\/+$/, '') || '/',
    new URLSearchParams(window.location.search),
  );
  // A prerendered page is hydrated at the address it was rendered for. Anything else, such as
  // the shell or the 404 page served for an unknown address, or the request page served
  // for a run by a host that cannot render runs, renders afresh.
  if (root.firstElementChild && root.dataset.path === here) hydrateRoot(root, app);
  else createRoot(root).render(app);
}
