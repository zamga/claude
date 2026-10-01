import { lazy, Suspense, useEffect, useState } from 'react';
import { useLocation } from '../lib/router';
import { Masthead } from '../ui/Masthead';
import { Footer } from '../ui/Footer';
import { Home } from '../pages/Home';
import { NotFound } from '../pages/NotFound';
import { fetchReport, findReport, reportIdOf } from '../report/library';
import type { Report as ReportData } from '../report/types';

const Report = lazy(() => import('../pages/Report').then((m) => ({ default: m.Report })));
const Initiate = lazy(() => import('../pages/Initiate').then((m) => ({ default: m.Initiate })));
const Method = lazy(() => import('../pages/Method').then((m) => ({ default: m.Method })));

/** The single-file preview has no server to ask for reports. */
const STANDALONE = import.meta.env.MODE === 'artifact';

const Loading = () => <div className="page" style={{ minHeight: '100svh' }} aria-busy="true" />;

/** A report by id: the sample or one rendered into the page, else fetched from the server. */
function ReportRoute({ id }: { id: string }) {
  const known = findReport(id);
  const [loaded, setLoaded] = useState<{ id: string; report: ReportData | null; problem?: string }>();
  useEffect(() => {
    if (known || STANDALONE) return;
    let live = true;
    fetchReport(id).then(
      (report) => live && setLoaded({ id, report }),
      (e: unknown) =>
        live &&
        setLoaded({
          id,
          report: null,
          problem: e instanceof Error ? e.message : 'The report could not be loaded.',
        }),
    );
    return () => {
      live = false;
    };
  }, [id, known]);
  if (known) return <Report key={id} report={known} />;
  if (STANDALONE) return <NotFound />;
  if (loaded?.id !== id) return <Loading />;
  if (loaded.report) return <Report key={id} report={loaded.report} />;
  return <NotFound problem={loaded.problem} />;
}

function route(path: string) {
  if (path === '/') return <Home />;
  const reportId = reportIdOf(path);
  if (reportId) return <ReportRoute id={reportId} />;
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
        <Suspense fallback={<Loading />}>{route(path)}</Suspense>
      </main>
      <Footer />
    </>
  );
}
