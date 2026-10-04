import { createRoot } from 'react-dom/client';
import './styles/fonts.css';
import './styles/tokens.css';
import './styles/base.css';
import { App } from './app/App';
import { assertConfiguration } from './app/config';
import { loadDemoServer } from './data/api';
import { DATA_MODE } from './data/transport';
import { listenForInstall } from './features/install';

// A host page may put the entry stylesheets in <body> (the static preview). Route chunks append
// theirs to <head>, so move ours there first: routes must keep the later place in the cascade.
for (const sheet of document.body.querySelectorAll('style, link[rel="stylesheet"]'))
  document.head.appendChild(sheet);

assertConfiguration();
listenForInstall();
// Fetch the demo service in parallel with the first render; requests await it.
if (DATA_MODE === 'demo') void loadDemoServer();

const root = document.getElementById('root');
if (!root) throw new Error('Root element missing');
createRoot(root).render(<App />);
