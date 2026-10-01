import { StrictMode } from 'react';
import { createRoot, hydrateRoot } from 'react-dom/client';
import './styles/fonts.css';
import './styles/tokens.css';
import './styles/base.css';
import { App } from './app/App';

const root = document.getElementById('root');
const app = (
  <StrictMode>
    <App />
  </StrictMode>
);

if (root?.firstElementChild) {
  // Prerendered page: attach to the HTML that is already on screen.
  hydrateRoot(root, app);
} else if (root) {
  createRoot(root).render(app);
}
