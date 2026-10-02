import {
  useDeferredValue,
  useEffect,
  useId,
  useRef,
  useState,
  useSyncExternalStore,
  type ChangeEvent,
  type FormEvent,
  type RefObject,
} from 'react';
import { usePageMeta } from '../app/routes';
import { Cover } from '../report/Cover';
import { Seal } from '../seal/Seal';
import { serialFor } from '../seal/guilloche';
import { Serial } from '../ui/Serial';
import { Link, navigate, useLocation } from '../lib/router';
import { engineStatus, runAddress, startRun, type EngineStatus } from '../lib/run';
import { LiveRun } from './LiveRun';
import {
  ACCEPTED,
  COUNTRIES,
  COUNTRY_INFO,
  PURPOSES,
  fileSize,
  getDraft,
  researchPlan,
  validate,
  type FieldErrors,
  type InitiationRequest,
  type Listing,
  type Purpose,
} from '../lib/request';
import styles from './Initiate.module.css';

const LISTINGS: { value: Listing; label: string }[] = [
  { value: 'private', label: 'Private' },
  { value: 'listed', label: 'Listed' },
  { value: 'unsure', label: 'Not sure' },
];

/** The single-file preview has no server, so no engine. */
const STANDALONE = import.meta.env.MODE === 'artifact';

const never = () => () => {};
const NO_ENGINE: EngineStatus = { engine: 'off', access: 'open' };
// The page is rendered for the host that serves it (see renderForEngine), so its first paint
// already says whether the engine runs, and hydration reads the same answer from the page.
const currentEngine = (): EngineStatus => (STANDALONE ? NO_ENGINE : engineStatus());

/**
 * Commission an initiation. Where the server runs the research engine, the
 * request is sent with its files and the page follows the run as it happens
 * (at /initiate?run=<id>, so the address can be left and come back to).
 * Without an engine, the request is checked and turned into the plan the
 * engine would follow, nothing is sent or stored, and the page says so.
 */
export function Initiate() {
  const { query } = useLocation();
  const run = query.get('run');
  const draft = getDraft();
  const [request, setRequest] = useState<InitiationRequest>({
    company: draft.company,
    country: draft.country,
    listing: 'private',
    ticker: '',
    registration: '',
    website: '',
    files: [],
    purpose: 'Investment',
    focus: '',
  });
  const [errors, setErrors] = useState<FieldErrors>({});
  const [submitted, setSubmitted] = useState<InitiationRequest | null>(null);
  const engine = useSyncExternalStore(never, currentEngine, currentEngine);
  const [code, setCode] = useState('');
  const [sending, setSending] = useState(false);
  const [problem, setProblem] = useState<string>();
  const [sent, setSent] = useState<InitiationRequest>();
  const shown = useDeferredValue(request.company);
  const id = useId();
  const slipRef = useRef<HTMLHeadingElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  // The files themselves, by name; the request carries only their names and sizes.
  const filesRef = useRef(new Map<string, File>());
  const live = engine.engine !== 'off';

  usePageMeta('/initiate');

  useEffect(() => {
    if (submitted) slipRef.current?.focus();
  }, [submitted]);

  const set = <K extends keyof InitiationRequest>(key: K, value: InitiationRequest[K]) =>
    setRequest((r) => ({ ...r, [key]: value }));

  const onFiles = (e: ChangeEvent<HTMLInputElement>) => {
    const chosen = Array.from(e.target.files ?? []);
    for (const f of chosen) filesRef.current.set(f.name, f);
    const list = chosen.map((f) => ({ name: f.name, size: f.size }));
    set(
      'files',
      [...request.files, ...list].filter((f, i, all) => all.findIndex((g) => g.name === f.name) === i),
    );
    e.target.value = '';
  };

  const focusField = (name: string) => formRef.current?.querySelector<HTMLElement>(`[name="${name}"]`)?.focus();

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const found = validate(request);
    if (live && engine.access === 'code' && !code.trim())
      found.code = 'Enter the access code that came with your invitation.';
    setErrors(found);
    setProblem(undefined);
    const first = Object.keys(found)[0];
    if (first) {
      focusField(first);
      return;
    }
    if (!live) {
      setSubmitted(request);
      return;
    }
    const form = new FormData();
    form.set('company', request.company);
    form.set('country', request.country);
    form.set('listing', request.listing);
    form.set('ticker', request.ticker);
    form.set('registration', request.registration);
    form.set('website', request.website);
    form.set('purpose', request.purpose);
    form.set('focus', request.focus);
    form.set('code', code);
    for (const f of request.files) {
      const file = filesRef.current.get(f.name);
      if (file) form.append('files', file, file.name);
    }
    setSending(true);
    const result = await startRun(form);
    setSending(false);
    if (!result.ok) {
      if (result.field && ['company', 'website', 'files', 'ticker', 'code'].includes(result.field)) {
        setErrors({ [result.field]: result.error });
        focusField(result.field);
      } else setProblem(result.error);
      return;
    }
    setSent(request);
    navigate(runAddress(result.id));
  };

  const err = (key: keyof FieldErrors) =>
    errors[key] ? (
      <p className={styles.error} id={`${id}-${key}-error`}>
        {errors[key]}
      </p>
    ) : null;
  const describedBy = (key: keyof FieldErrors, hint?: string) =>
    [hint, errors[key] ? `${id}-${key}-error` : undefined].filter(Boolean).join(' ') || undefined;

  if (run) return <LiveRun key={run} id={run} request={sent} onEdit={sent ? () => navigate('/initiate') : undefined} />;
  if (submitted) return <Slip request={submitted} onEdit={() => setSubmitted(null)} headingRef={slipRef} />;

  return (
    <div className={styles.initiate}>
      <header className={`page ${styles.head}`}>
        <p className="eyebrow">Initiate coverage</p>
        <h1 className={styles.title} data-page-focus tabIndex={-1}>
          Commission an <em>initiation</em>.
        </h1>
        <p className={styles.lede}>
          Name the company and what you need to know. Uncovered gathers the filings, builds the model and writes the
          report, with every figure traced to its source.
        </p>
        {live ? (
          <p className={styles.preview} role="note">
            <strong>{engine.engine === 'fixture' ? 'Test engine.' : 'The engine is live.'}</strong>{' '}
            {engine.engine === 'fixture'
              ? 'This server runs a scripted test of the engine: whatever you ask, it researches a fictional company from its test documents.'
              : 'An initiation takes about twenty minutes, and you can watch it being researched. Your files are read for this report and not kept.'}
          </p>
        ) : (
          <p className={styles.preview} role="note">
            <strong>Preview.</strong> The research engine is not connected here. You can complete a request and see the
            plan it would follow; nothing is sent or stored.
          </p>
        )}
      </header>

      <div className={`page ${styles.grid}`}>
        <form ref={formRef} className={styles.form} onSubmit={submit} noValidate>
          <fieldset className={styles.group}>
            <legend className={styles.legend}>
              <span>01</span> The company
            </legend>
            <div className={styles.row}>
              <div className={styles.field} data-invalid={errors.company ? true : undefined}>
                <label htmlFor={`${id}-company`}>Company</label>
                <div className={styles.inputWrap}>
                  <input
                    id={`${id}-company`}
                    name="company"
                    value={request.company}
                    onChange={(e) => set('company', e.target.value)}
                    autoComplete="organization"
                    spellCheck={false}
                    required
                    aria-invalid={errors.company ? true : undefined}
                    aria-describedby={describedBy('company')}
                  />
                  {shown.trim() && (
                    <Seal seed={shown} size={40} detail="glyph" duration={900} className={styles.miniSeal} />
                  )}
                </div>
                {err('company')}
              </div>
              <div className={styles.field}>
                <label htmlFor={`${id}-country`}>Country</label>
                <select
                  id={`${id}-country`}
                  name="country"
                  value={request.country}
                  onChange={(e) => set('country', e.target.value)}
                >
                  {COUNTRIES.map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </div>
            </div>

            <fieldset className={styles.segmented}>
              <legend>Shares</legend>
              <div>
                {LISTINGS.map((l) => (
                  <label key={l.value}>
                    <input
                      type="radio"
                      name="listing"
                      value={l.value}
                      checked={request.listing === l.value}
                      onChange={() => set('listing', l.value)}
                    />
                    <span>{l.label}</span>
                  </label>
                ))}
              </div>
            </fieldset>

            <div className={styles.row}>
              {request.listing === 'listed' ? (
                <div className={styles.field}>
                  <label htmlFor={`${id}-ticker`}>Exchange and ticker</label>
                  <input
                    id={`${id}-ticker`}
                    name="ticker"
                    value={request.ticker}
                    onChange={(e) => set('ticker', e.target.value)}
                    placeholder="e.g. Ljubljana: KRKG"
                    spellCheck={false}
                  />
                </div>
              ) : (
                <div className={styles.field}>
                  <label htmlFor={`${id}-registration`}>Registration number</label>
                  <input
                    id={`${id}-registration`}
                    name="registration"
                    value={request.registration}
                    onChange={(e) => set('registration', e.target.value)}
                    inputMode="numeric"
                    spellCheck={false}
                    aria-describedby={`${id}-registration-hint`}
                  />
                  <p className={styles.hint} id={`${id}-registration-hint`}>
                    Optional. In Slovenia, the matična številka.
                  </p>
                </div>
              )}
              <div className={styles.field} data-invalid={errors.website ? true : undefined}>
                <label htmlFor={`${id}-website`}>Website</label>
                <input
                  id={`${id}-website`}
                  name="website"
                  value={request.website}
                  onChange={(e) => set('website', e.target.value)}
                  inputMode="url"
                  autoComplete="url"
                  spellCheck={false}
                  placeholder="Optional"
                  aria-invalid={errors.website ? true : undefined}
                  aria-describedby={describedBy('website')}
                />
                {err('website')}
              </div>
            </div>
          </fieldset>

          <fieldset className={styles.group}>
            <legend className={styles.legend}>
              <span>02</span> Filings
            </legend>
            <div className={styles.drop} data-invalid={errors.files ? true : undefined}>
              <input
                id={`${id}-files`}
                name="files"
                type="file"
                multiple
                accept={ACCEPTED.join(',')}
                onChange={onFiles}
                aria-describedby={describedBy('files', `${id}-files-hint`)}
              />
              <label htmlFor={`${id}-files`}>
                <span className={styles.dropTitle}>Attach annual reports or statements</span>
                <span className={styles.hint} id={`${id}-files-hint`}>
                  PDFs, filings in XHTML or HTML, or text, up to 25 MB each. Drop them here or choose files.{' '}
                  {live ? 'They are read for this report and not kept.' : 'They stay on this device in the preview.'}
                </span>
              </label>
            </div>
            {err('files')}
            {request.files.length > 0 && (
              <ul className={styles.files} role="list" aria-label="Attached files">
                {request.files.map((f) => (
                  <li key={f.name}>
                    <span className={styles.fileName}>{f.name}</span>
                    <span className={styles.fileSize}>{fileSize(f.size)}</span>
                    <button
                      type="button"
                      className={styles.remove}
                      onClick={() => {
                        filesRef.current.delete(f.name);
                        set(
                          'files',
                          request.files.filter((g) => g.name !== f.name),
                        );
                      }}
                    >
                      Remove<span className="visually-hidden"> {f.name}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </fieldset>

          <fieldset className={styles.group}>
            <legend className={styles.legend}>
              <span>03</span> Your question
            </legend>
            <fieldset className={styles.segmented}>
              <legend>The report is for</legend>
              <div>
                {PURPOSES.map((p) => (
                  <label key={p}>
                    <input
                      type="radio"
                      name="purpose"
                      value={p}
                      checked={request.purpose === p}
                      onChange={() => set('purpose', p as Purpose)}
                    />
                    <span>{p}</span>
                  </label>
                ))}
              </div>
            </fieldset>
            <div className={styles.field}>
              <label htmlFor={`${id}-focus`}>What should the report answer?</label>
              <textarea
                id={`${id}-focus`}
                name="focus"
                rows={4}
                value={request.focus}
                onChange={(e) => set('focus', e.target.value)}
                placeholder="e.g. Can it fund the new plant from its own cash? How does it compare with its closest competitor?"
              />
            </div>
            {live && engine.access === 'code' && (
              <div className={styles.field} data-invalid={errors.code ? true : undefined}>
                <label htmlFor={`${id}-code`}>Access code</label>
                <input
                  id={`${id}-code`}
                  name="code"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  autoComplete="off"
                  spellCheck={false}
                  aria-invalid={errors.code ? true : undefined}
                  aria-describedby={describedBy('code', `${id}-code-hint`)}
                />
                <p className={styles.hint} id={`${id}-code-hint`}>
                  Uncovered is in private beta. Your invitation came with a code.
                </p>
                {err('code')}
              </div>
            )}
          </fieldset>

          {problem && (
            <p className={styles.problem} role="alert">
              {problem}
            </p>
          )}
          <div className={styles.submitRow}>
            <button type="submit" className={styles.submit} disabled={sending} aria-busy={sending || undefined}>
              {live ? (sending ? 'Sending the request…' : 'Initiate coverage') : 'See the research plan'}
              <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true">
                <path d="M4 10h11M11 5l5 5-5 5" fill="none" stroke="currentColor" strokeWidth="1.6" />
              </svg>
            </button>
            <p className={styles.hint}>
              {live
                ? 'An initiation takes about twenty minutes. You can follow it as it works, or come back to its address.'
                : 'A full initiation takes about twenty minutes once the engine is connected.'}
            </p>
          </div>
        </form>

        <aside className={styles.stage} aria-label="Cover preview">
          <Cover
            report={null}
            name={shown}
            country={{ name: request.country, code: COUNTRY_INFO[request.country]?.code ?? 'XX' }}
            size="hero"
            inspect
            tilt
          />
          <p className={styles.caption}>
            {shown.trim()
              ? `The cover of the ${shown.trim()} initiation, its seal engraved from the name.`
              : 'Type a company to engrave its seal.'}
          </p>
        </aside>
      </div>
    </div>
  );
}

/** Up to two initials, skipping legal forms such as d.o.o. */
function initials(name: string): string {
  const words = name
    .replace(/[,.]/g, ' ')
    .split(/\s+/)
    .filter((w) => w && !/^(d|o|dd|doo|sp|ltd|plc|ag|gmbh|inc|sa|nv|llc)$/i.test(w));
  return words
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join('');
}

function Slip({
  request,
  onEdit,
  headingRef,
}: {
  request: InitiationRequest;
  onEdit: () => void;
  headingRef: RefObject<HTMLHeadingElement | null>;
}) {
  const plan = researchPlan(request);
  const code = COUNTRY_INFO[request.country]?.code ?? 'XX';
  const needs = plan.filter((s) => s.status === 'needs-you').length;
  const company = request.company.trim();
  return (
    <div className={`page ${styles.slipPage}`}>
      <article className={styles.slip} aria-labelledby="slip-title">
        <header className={styles.slipHead}>
          <span>Coverage request</span>
          <Serial value={serialFor(company, code)} />
        </header>
        <div className={styles.slipMain}>
          <div>
            <p className="eyebrow">
              {request.country} · {LISTINGS.find((l) => l.value === request.listing)!.label} · {request.purpose}
            </p>
            <h1 id="slip-title" ref={headingRef} tabIndex={-1} className={styles.slipTitle}>
              {company}
            </h1>
            {request.focus.trim() && <blockquote className={styles.question}>“{request.focus.trim()}”</blockquote>}
          </div>
          <Seal
            seed={company}
            size={168}
            monogram={initials(company)}
            submark={code}
            ring={`${company} · Coverage request · Uncovered Research`}
            sheen
            className={styles.slipSeal}
          />
        </div>

        <h2 className={styles.planTitle}>The research plan</h2>
        <ol className={styles.plan} role="list">
          {plan.map((s, i) => (
            <li key={s.title} data-status={s.status}>
              <span className={styles.planNo}>{String(i + 1).padStart(2, '0')}</span>
              <div>
                <h3>{s.title}</h3>
                <p>{s.detail}</p>
              </div>
              <span className={styles.status}>{s.status === 'ready' ? 'Ready' : 'Needs you'}</span>
            </li>
          ))}
        </ol>
        {needs > 0 && (
          <p className={styles.needs}>
            {needs === 1 ? 'One step needs' : `${needs} steps need`} a document only you can supply. Attach it and the
            plan updates.
          </p>
        )}
        {request.files.length > 0 && (
          <p className={styles.attached}>Attached: {request.files.map((f) => f.name).join(', ')}.</p>
        )}

        <p className={styles.preview} role="note">
          <strong>Preview.</strong> The research engine is not connected, so no report will be written. Nothing has been
          sent or stored, and leaving this page discards the request.
        </p>
        <div className={styles.slipActions}>
          <button type="button" className={styles.secondary} onClick={onEdit}>
            Edit the request
          </button>
          <Link to="/report/krka" className={styles.submit}>
            Read a finished initiation
          </Link>
        </div>
      </article>
    </div>
  );
}
