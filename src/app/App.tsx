import { lazy, Suspense, useEffect, useState } from 'react';
import { matchPath, useLocation } from '../lib/router';
import { Header } from '../ui/Header';
import { Footer } from '../ui/Footer';
import { CommandPalette } from '../ui/CommandPalette';
import { Home } from '../pages/Home';
import { NotFound } from '../pages/NotFound';

// Routes beyond the landing page load on demand.
const ChartPage = lazy(() => import('../pages/ChartPage').then((m) => ({ default: m.ChartPage })));
const Atlas = lazy(() => import('../pages/Atlas').then((m) => ({ default: m.Atlas })));
const Method = lazy(() => import('../pages/Method').then((m) => ({ default: m.Method })));
const Survey = lazy(() => import('../pages/Survey').then((m) => ({ default: m.Survey })));

function route(path: string, state: string | null) {
  if (path === '/') return <Home />;
  if (path === '/atlas') return <Atlas />;
  if (path === '/method') return <Method />;
  if (path === '/survey') return <Survey />;
  const chart = matchPath('/chart/:ticker', path);
  if (chart) return <ChartPage ticker={chart.ticker!} token={state} />;
  return <NotFound />;
}

export function App() {
  const { path, state } = useLocation();
  const [searchOpen, setSearchOpen] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const typing = !!target && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName));
      if ((e.key === 'k' || e.key === 'K') && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setSearchOpen(true);
      } else if (e.key === '/' && !typing) {
        e.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <>
      <a
        className="skip-link"
        href="#main"
        onClick={(e) => {
          e.preventDefault();
          document.getElementById('main')?.focus();
        }}
      >
        Skip to content
      </a>
      <Header onSearch={() => setSearchOpen(true)} />
      <main id="main" tabIndex={-1}>
        <Suspense fallback={<div className="page" style={{ minHeight: '60vh' }} aria-busy="true" />}>
          {route(path, state)}
        </Suspense>
      </main>
      <Footer />
      <CommandPalette open={searchOpen} onClose={() => setSearchOpen(false)} />
    </>
  );
}
