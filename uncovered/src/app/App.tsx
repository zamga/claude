import { lazy, Suspense, useEffect } from 'react';
import { useLocation } from '../lib/router';
import { Masthead } from '../ui/Masthead';
import { Footer } from '../ui/Footer';
import { Home } from '../pages/Home';
import { NotFound } from '../pages/NotFound';

const Report = lazy(() => import('../pages/Report').then((m) => ({ default: m.Report })));
const Initiate = lazy(() => import('../pages/Initiate').then((m) => ({ default: m.Initiate })));
const Method = lazy(() => import('../pages/Method').then((m) => ({ default: m.Method })));

function route(path: string) {
  if (path === '/') return <Home />;
  if (path === '/report/krka') return <Report />;
  if (path === '/initiate') return <Initiate />;
  if (path === '/method') return <Method />;
  return <NotFound />;
}

export function App() {
  const { path } = useLocation();

  useEffect(() => {
    document.documentElement.dataset.ready = 'true';
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
      <Masthead />
      <main id="main" tabIndex={-1}>
        <Suspense fallback={<div className="page" style={{ minHeight: '100svh' }} aria-busy="true" />}>
          {route(path)}
        </Suspense>
      </main>
      <Footer />
    </>
  );
}
