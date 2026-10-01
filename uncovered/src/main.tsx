import { StrictMode } from 'react';
import { createRoot, hydrateRoot } from 'react-dom/client';
import './styles/tokens.css';
import './styles/base.css';
import { App } from './app/App';

const root = document.getElementById('root');
if (root) {
  const app = (
    <StrictMode>
      <App />
    </StrictMode>
  );
  const here = window.location.pathname.replace(/\/+$/, '') || '/';
  // A prerendered page is hydrated at the address it was rendered for. Anything
  // else, such as the shell or the 404 page served for an unknown address, renders afresh.
  if (root.firstElementChild && root.dataset.path === here) hydrateRoot(root, app);
  else createRoot(root).render(app);
}
