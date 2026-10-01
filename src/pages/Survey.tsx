import { useEffect, useState, type FormEvent } from 'react';
import { navigate } from '../lib/router';
import { useHydrated } from '../lib/hydration';
import { EXAMPLE_ENTRY, loadCustom, saveCustom, type CustomEntry } from '../model/custom';
import styles from './Survey.module.css';

type Field = {
  key: keyof CustomEntry;
  label: string;
  hint: string;
  unit: string;
  required?: boolean;
  allowNegative?: boolean;
  optional?: boolean;
  percent?: boolean;
};

const FIELDS: Field[] = [
  { key: 'revenue', label: 'Revenue, last year', hint: 'Total sales for the most recent full year.', unit: '$M', required: true },
  {
    key: 'priorRevenue',
    label: 'Revenue, the year before',
    hint: 'Optional. Sets the starting growth rate.',
    unit: '$M',
    optional: true,
  },
  {
    key: 'operatingIncome',
    label: 'Operating income, last year',
    hint: 'Profit before interest and tax. Negative if the company loses money.',
    unit: '$M',
    allowNegative: true,
  },
  { key: 'cash', label: 'Cash and investments', hint: 'On the latest balance sheet.', unit: '$M' },
  { key: 'debt', label: 'Debt', hint: 'Loans and bonds; leave out leases.', unit: '$M' },
  {
    key: 'shares',
    label: 'Shares outstanding',
    hint: 'Fully diluted, including options you expect to be exercised.',
    unit: 'million',
    required: true,
  },
  {
    key: 'price',
    label: 'Reference price per share',
    hint: 'The last funding round, an offer on the table, or the strike price of your options.',
    unit: '$',
    required: true,
  },
  { key: 'taxRate', label: 'Tax rate', hint: 'Optional. 21% if left blank.', unit: '%', optional: true, percent: true },
];

type Draft = Record<keyof CustomEntry, string>;

function toDraft(e: CustomEntry): Draft {
  return {
    name: e.name,
    revenue: String(e.revenue),
    priorRevenue: e.priorRevenue === null ? '' : String(e.priorRevenue),
    operatingIncome: String(e.operatingIncome),
    cash: String(e.cash),
    debt: String(e.debt),
    shares: String(e.shares),
    price: String(e.price),
    taxRate: e.taxRate === null ? '' : String(Math.round(e.taxRate * 1000) / 10),
  };
}

const EMPTY: Draft = {
  name: '',
  revenue: '',
  priorRevenue: '',
  operatingIncome: '',
  cash: '',
  debt: '',
  shares: '',
  price: '',
  taxRate: '',
};

export function Survey() {
  const hydrated = useHydrated();
  // Keyed so the form re-reads saved figures once the page is interactive.
  return <SurveyForm key={hydrated ? 'live' : 'static'} restore={hydrated} />;
}

function SurveyForm({ restore }: { restore: boolean }) {
  const [draft, setDraft] = useState<Draft>(() => toDraft((restore ? loadCustom() : null) ?? EXAMPLE_ENTRY));
  const [errors, setErrors] = useState<Partial<Record<keyof CustomEntry, string>>>({});
  const isExample = draft.name === EXAMPLE_ENTRY.name;

  useEffect(() => {
    document.title = 'Survey your own company · Plimsoll';
  }, []);

  const num = (s: string) => (s.trim() === '' ? null : Number(s.replace(/[,$\s%]/g, '')));

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    const next: Partial<Record<keyof CustomEntry, string>> = {};
    const values: Partial<Record<keyof CustomEntry, number | null>> = {};
    for (const f of FIELDS) {
      const v = num(draft[f.key]);
      if (v !== null && !Number.isFinite(v)) next[f.key] = 'Enter a number.';
      else if (v === null && f.required) next[f.key] = 'Needed to draw the chart.';
      else if (v !== null && v < 0 && !f.allowNegative) next[f.key] = 'Cannot be negative.';
      else if (v !== null && v === 0 && f.required) next[f.key] = 'Must be more than zero.';
      values[f.key] = v;
    }
    if (!draft.name.trim()) next.name = 'Give the company a name.';
    setErrors(next);
    if (Object.keys(next).length > 0) {
      const first = document.getElementById(`survey-${Object.keys(next)[0]}`);
      first?.focus();
      return;
    }
    const entry: CustomEntry = {
      name: draft.name.trim().slice(0, 80),
      revenue: values.revenue!,
      priorRevenue: values.priorRevenue ?? null,
      operatingIncome: values.operatingIncome ?? 0,
      cash: values.cash ?? 0,
      debt: values.debt ?? 0,
      shares: values.shares!,
      price: values.price!,
      taxRate: values.taxRate === null || values.taxRate === undefined ? null : values.taxRate / 100,
    };
    saveCustom(entry);
    navigate('/chart/custom');
  };

  return (
    <div className={`page ${styles.survey}`}>
      <header className={styles.head}>
        <p className="eyebrow">Survey your own</p>
        <h1 data-page-focus tabIndex={-1} className={styles.title}>
          Chart a company from its figures.
        </h1>
        <p className={styles.lede}>
          A private firm, a startup offering you equity, your own business. Seven figures are enough to draw its chart.
          Everything stays in this browser unless you share the link.
        </p>
      </header>

      <form className={styles.form} onSubmit={onSubmit} noValidate>
        {isExample && (
          <p className={styles.example} role="note">
            These are example figures for a made-up company.{' '}
            <button type="button" onClick={() => setDraft(EMPTY)}>
              Clear them
            </button>
          </p>
        )}
        <div className={styles.field}>
          <label htmlFor="survey-name">Company name</label>
          <input
            id="survey-name"
            value={draft.name}
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            aria-invalid={errors.name ? true : undefined}
            aria-describedby={errors.name ? 'survey-name-error' : undefined}
            autoComplete="organization"
          />
          {errors.name && (
            <p id="survey-name-error" className={styles.error}>
              {errors.name}
            </p>
          )}
        </div>
        <div className={styles.grid}>
          {FIELDS.map((f) => (
            <div key={f.key} className={styles.field}>
              <label htmlFor={`survey-${f.key}`}>
                {f.label}
                {f.optional && <span className={styles.optional}> optional</span>}
              </label>
              <div className={styles.inputRow}>
                <input
                  id={`survey-${f.key}`}
                  inputMode="decimal"
                  value={draft[f.key]}
                  onChange={(e) => setDraft({ ...draft, [f.key]: e.target.value })}
                  aria-invalid={errors[f.key] ? true : undefined}
                  aria-describedby={`survey-${f.key}-hint${errors[f.key] ? ` survey-${f.key}-error` : ''}`}
                />
                <span className={styles.unit} aria-hidden="true">
                  {f.unit}
                </span>
              </div>
              <p id={`survey-${f.key}-hint`} className={styles.hint}>
                {f.hint} {f.unit === '$M' ? 'In millions of dollars.' : ''}
              </p>
              {errors[f.key] && (
                <p id={`survey-${f.key}-error`} className={styles.error}>
                  {errors[f.key]}
                </p>
              )}
            </div>
          ))}
        </div>
        <div className={styles.actions}>
          <button type="submit" className={styles.submit}>
            Draw the chart <span aria-hidden="true">→</span>
          </button>
          <p className={styles.small}>
            Plimsoll assumes the cost of capital of a typical private company. You can change every assumption on the
            chart.
          </p>
        </div>
      </form>
    </div>
  );
}
