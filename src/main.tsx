import { createRoot } from 'react-dom/client';
import './styles/fonts.css';
import './styles/tokens.css';
import './styles/base.css';
import { App } from './app/App';
import { assertConfiguration } from './app/config';
import { loadDemoServer } from './data/api';
import { DATA_MODE } from './data/transport';

assertConfiguration();
// Fetch the demo service in parallel with the first render; requests await it.
if (DATA_MODE === 'demo') void loadDemoServer();

const root = document.getElementById('root');
if (!root) throw new Error('Root element missing');
createRoot(root).render(<App />);
