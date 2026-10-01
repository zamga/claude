import { useEffect, useState, useSyncExternalStore } from 'react';
import { Seal } from '../seal/Seal';
import { serialFor } from '../seal/guilloche';
import { Serial } from '../ui/Serial';
import { Link } from '../lib/router';
import { COUNTRY_INFO, researchPlan, type InitiationRequest, type Listing, type Purpose } from '../lib/request';
import {
  EMPTY_RUN,
  fetchRun,
  fold,
  followRun,
  givenRun,
  runProgress,
  type RunRecord,
  type RunView,
  type Stage,
} from '../lib/run';
import { num } from '../lib/format';
import shared from './Initiate.module.css';
import styles from './LiveRun.module.css';

/*
 * A run as it happens: the request slip becomes the record of the research.
 * The seal engraves as the evidence comes in, the plan's steps report what
 * the desk is doing, every verified passage and figure is counted, and the
 * slip is stamped when the report has passed its checks.
 */

const STAGE_OF: Record<string, Stage> = {
  'Identify the company': 'research',
  'Read your documents': 'research',
  'Read the filings': 'research',
  'Research the business': 'research',
  'Build the model': 'model',
  'Value it': 'model',
  'Write the initiation': 'write',
};

const CHECK_STEP = {
  title: 'Check every figure',
  detail:
    'Every quotation found word for word in its document; every number traced to a passage or computed by the model. A sentence that cannot be traced is withheld.',
};

const DOING: Record<Stage, string> = {
  research: 'Researching',
  model: 'Building the model',
  write: 'Writing',
  check: 'Checking every figure',
};

const STATUS = { waiting: 'Waiting', active: 'Working', done: 'Done' } as const;

function asRequest(r: RunRecord['request']): InitiationRequest {
  return {
    company: r.company,
    country: r.country,
    listing: (['listed', 'private', 'unsure'].includes(r.listing) ? r.listing : 'unsure') as Listing,
    ticker: '',
    registration: '',
    website: '',
    files: r.files,
    purpose: r.purpose as Purpose,
    focus: r.question ?? '',
  };
}

const initials = (name: string) =>
  name
    .replace(/[,.]/g, ' ')
    .split(/\s+/)
    .filter((w) => w && !/^(d|o|dd|doo|sp|ltd|plc|ag|gmbh|inc|sa|nv|llc)$/i.test(w))
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join('');

function duration(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000));
  const m = Math.floor(s / 60);
  return m ? `${m} min ${String(s % 60).padStart(2, '0')} s` : `${s} s`;
}

const never = () => () => {};
/** False while the page hydrates, so it first renders what the server rendered; true after. */
const useHydrated = () =>
  useSyncExternalStore(
    never,
    () => true,
    () => false,
  );

// Times are shown in the reader's own time zone once the page runs; the server, which cannot know it, writes UTC.
const zone = (local: boolean) => (local ? {} : { timeZone: 'UTC' });
const clock = (iso: string, local: boolean) =>
  new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit', ...zone(local) }) +
  (local ? '' : ' UTC');
const day = (ms: number, local: boolean) =>
  new Date(ms).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', ...zone(local) });

export function LiveRun({ id, request, onEdit }: { id: string; request?: InitiationRequest; onEdit?: () => void }) {
  // A page the server rendered for this run arrives with the run as it stood then.
  const given = givenRun(id);
  const [record, setRecord] = useState<RunRecord | null | undefined>(given?.record);
  const [view, setView] = useState<RunView>(
    () => given?.record?.events.reduce((v, e) => fold(v, e.event, e.at), EMPTY_RUN) ?? EMPTY_RUN,
  );
  const [now, setNow] = useState(() => (given ? Date.parse(given.at) : Date.now()));
  const local = useHydrated();

  useEffect(() => {
    let live = true;
    let stop = () => {};
    const follow = (after: number) => {
      stop = followRun(id, (event, at) => setView((v) => fold(v, event, at)), after);
    };
    if (given) {
      // Follow on from the last event the page was rendered with.
      if (given.record?.status === 'running') follow(given.record.events.length - 1);
    } else {
      void fetchRun(id).then((found) => {
        if (!live) return;
        setRecord(found ?? null);
        // The stream replays every event from the start, so the view is built whole.
        if (found) follow(-1);
      });
    }
    return () => {
      live = false;
      stop();
    };
  }, [id, given]);

  const running = view.status === 'running' && record !== null;
  useEffect(() => {
    if (!running) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [running]);

  if (record === null)
    return (
      <div className={`page ${shared.slipPage}`}>
        <article className={shared.slip} aria-labelledby="run-title">
          <h1 id="run-title" className={shared.slipTitle} data-page-focus tabIndex={-1}>
            No such request
          </h1>
          <p>This address does not lead to a research run on this server. It may have been made somewhere else.</p>
          <div className={shared.slipActions}>
            <Link to="/initiate" className={shared.submit}>
              Initiate coverage
            </Link>
          </div>
        </article>
      </div>
    );

  const req = request ?? (record ? asRequest(record.request) : undefined);
  const company = req?.company.trim() || 'Your company';
  const code = req ? (COUNTRY_INFO[req.country]?.code ?? 'XX') : 'XX';
  const steps = [
    ...(req ? researchPlan(req) : []).map((s) => ({
      title: s.title,
      detail: s.detail,
      stage: STAGE_OF[s.title] ?? 'research',
    })),
    { ...CHECK_STEP, stage: 'check' as Stage },
  ];
  const started = record ? new Date(record.createdAt).getTime() : now;
  const finished = view.endedAt ? new Date(view.endedAt).getTime() : now;
  const active = (['check', 'write', 'model', 'research'] as Stage[]).find((s) => view.stages[s] === 'active');
  const latest = view.activity[0];
  const announcement =
    view.status === 'done'
      ? 'The initiation is ready.'
      : view.status === 'failed'
        ? `The run stopped. ${view.error ?? ''}`
        : active
          ? `${DOING[active]}.`
          : '';
  const e = view.evidence;

  return (
    <div className={`page ${shared.slipPage}`}>
      <article className={`${shared.slip} ${styles.live}`} aria-labelledby="run-title" data-status={view.status}>
        <header className={shared.slipHead}>
          <span>
            {view.status === 'done' ? 'Covered' : view.status === 'failed' ? 'Not completed' : 'Coverage in progress'}
          </span>
          <Serial value={serialFor(company, code)} />
        </header>

        <div className={shared.slipMain}>
          <div>
            <p className="eyebrow">{req ? `${req.country} · ${req.purpose}` : 'Initiation of coverage'}</p>
            <h1 id="run-title" className={shared.slipTitle} data-page-focus tabIndex={-1}>
              {company}
            </h1>
            {req?.focus.trim() && <blockquote className={shared.question}>“{req.focus.trim()}”</blockquote>}
          </div>
          <div className={styles.sealWrap}>
            <Seal
              seed={company}
              size={168}
              monogram={initials(company) || 'U'}
              submark={code}
              ring={`${company} · Initiation of coverage · Uncovered Research`}
              progress={runProgress(view)}
              duration={1600}
              sheen
              className={shared.slipSeal}
            />
            {view.status === 'done' && (
              <p className={styles.stamp} aria-hidden="true">
                <span>Covered</span>
                <span>{day(finished, local)}</span>
              </p>
            )}
          </div>
        </div>

        <p className="visually-hidden" aria-live="polite">
          {announcement}
        </p>

        {view.status === 'running' && (
          <p className={styles.now}>
            <span className={styles.pulse} aria-hidden="true" />
            <span>
              {active ? DOING[active] : 'Starting'} · {duration(now - started)}
              {latest ? <span className={styles.latest}> · {latest.text}</span> : null}
            </span>
          </p>
        )}

        {view.status === 'done' && view.reportId && (
          <section className={styles.done} aria-labelledby="done-title">
            <h2 id="done-title">The initiation is ready.</h2>
            <p>
              Researched, modelled, written and checked in {duration(finished - started)}: {num(e.passages, 0)} passages
              verified word for word from {num(e.documents, 0)} {e.documents === 1 ? 'document' : 'documents'}, every
              figure traced.
            </p>
            <div className={shared.slipActions}>
              <Link to={`/report/${view.reportId}`} className={shared.submit}>
                Read the initiation
              </Link>
              <Link to="/initiate" className={shared.secondary}>
                Initiate another
              </Link>
            </div>
          </section>
        )}

        {view.status === 'failed' && (
          <section className={styles.failed} role="alert" aria-labelledby="failed-title">
            <h2 id="failed-title">The run stopped before the report was finished.</h2>
            <p>{view.error ?? record?.error}</p>
            <div className={shared.slipActions}>
              {onEdit && (
                <button type="button" className={shared.secondary} onClick={onEdit}>
                  Edit the request
                </button>
              )}
              <Link to="/initiate" className={shared.submit}>
                Start again
              </Link>
            </div>
          </section>
        )}

        <dl className={styles.ticker} aria-label="Evidence so far">
          <div>
            <dt>Documents read</dt>
            <dd className="display-num">{num(e.documents, 0)}</dd>
          </div>
          <div>
            <dt>Passages verified</dt>
            <dd className="display-num">{num(e.passages, 0)}</dd>
          </div>
          <div>
            <dt>Figures verified</dt>
            <dd className="display-num">{num(e.figures, 0)}</dd>
          </div>
          <div>
            <dt>Quotations sent back</dt>
            <dd className="display-num">{num(e.rejected, 0)}</dd>
          </div>
        </dl>

        <h2 className={shared.planTitle}>The research plan</h2>
        <ol className={`${shared.plan} ${styles.plan}`} role="list">
          {steps.map((s, i) => {
            const state =
              view.status === 'failed' && view.stages[s.stage] === 'active' ? 'waiting' : view.stages[s.stage];
            return (
              <li key={s.title} data-state={state}>
                <span className={shared.planNo}>{String(i + 1).padStart(2, '0')}</span>
                <div>
                  <h3>{s.title}</h3>
                  <p>{s.detail}</p>
                </div>
                <span className={`${shared.status} ${styles.state}`}>{STATUS[state]}</span>
              </li>
            );
          })}
        </ol>

        {view.activity.length > 0 && (
          <section aria-labelledby="notes-title">
            <h2 id="notes-title" className={styles.notesTitle}>
              Working notes
            </h2>
            <ol className={styles.notes} role="list">
              {view.activity.slice(0, 12).map((a, i) => (
                <li key={`${a.at}-${i}`}>
                  <time dateTime={a.at}>{clock(a.at, local)}</time>
                  <span>{a.text}</span>
                </li>
              ))}
            </ol>
          </section>
        )}
      </article>
    </div>
  );
}
