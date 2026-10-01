import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { COMPANIES } from '../data/companies';
import { formatPrice } from '../engine/format';
import { navigate } from '../lib/router';

const LIVE_SURVEY = import.meta.env.VITE_LIVE_API === '1';
import styles from './CommandPalette.module.css';

interface Item {
  id: string;
  title: string;
  detail: string;
  to: string;
}

const ITEMS: Item[] = [
  ...COMPANIES.map((c) => ({
    id: c.ticker,
    title: c.shortName,
    detail: `${c.ticker} · ${c.industryLabel} · ${formatPrice(c.price.value)}`,
    to: `/chart/${c.ticker.toLowerCase()}`,
  })),
  { id: 'survey', title: 'Survey your own company', detail: 'Private firm, startup or employer', to: '/survey' },
  { id: 'atlas', title: 'Atlas of all charts', detail: `${COMPANIES.length} surveyed companies`, to: '/atlas' },
  { id: 'method', title: 'Method', detail: 'How the chart is drawn', to: '/method' },
];

function score(item: Item, q: string) {
  if (!q) return 1;
  const t = `${item.id} ${item.title} ${item.detail}`.toLowerCase();
  if (item.id.toLowerCase() === q) return 100;
  if (item.title.toLowerCase().startsWith(q)) return 50;
  if (t.includes(q)) return 10;
  return 0;
}

/** Accessible combobox in a modal dialog: type, arrow, enter. */
export function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const listId = useId();

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    const local = ITEMS.map((item) => ({ item, s: score(item, q) }))
      .filter((r) => r.s > 0)
      .sort((a, b) => b.s - a.s)
      .map((r) => r.item);
    // With the survey API deployed, any ticker can be charted from its filings.
    if (LIVE_SURVEY && /^[a-z][a-z0-9.-]{0,9}$/.test(q) && !local.some((i) => i.id.toLowerCase() === q)) {
      local.push({
        id: `live-${q}`,
        title: `Survey ${q.toUpperCase()} from its SEC filings`,
        detail: 'Any US-listed company, figures straight from EDGAR',
        to: `/chart/${q}`,
      });
    }
    return local;
  }, [query]);

  useEffect(() => {
    const d = dialogRef.current;
    if (!d) return;
    if (open && !d.open) {
      setQuery('');
      setActive(0);
      d.showModal();
      requestAnimationFrame(() => inputRef.current?.focus());
    } else if (!open && d.open) {
      d.close();
    }
  }, [open]);

  const go = (item: Item | undefined) => {
    if (!item) return;
    onClose();
    navigate(item.to);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((a) => Math.min(results.length - 1, a + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((a) => Math.max(0, a - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      go(results[active]);
    }
  };

  return (
    // Clicking the backdrop is a mouse shortcut; Escape closes the dialog for keyboard users.
    // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-noninteractive-element-interactions
    <dialog
      ref={dialogRef}
      className={styles.dialog}
      aria-label="Chart a company"
      onClose={onClose}
      onClick={(e) => {
        if (e.target === dialogRef.current) onClose();
      }}
    >
      <div className={styles.panel}>
        <label className={styles.field}>
          <span className="visually-hidden">Company or ticker</span>
          <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true">
            <circle cx="8.5" cy="8.5" r="5.5" fill="none" stroke="currentColor" strokeWidth="1.6" />
            <path d="M13 13l4.5 4.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
          <input
            ref={inputRef}
            type="text"
            role="combobox"
            aria-expanded="true"
            aria-controls={listId}
            aria-activedescendant={results[active] ? `${listId}-${results[active].id}` : undefined}
            aria-autocomplete="list"
            placeholder="Company or ticker, e.g. NVIDIA"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActive(0);
            }}
            onKeyDown={onKeyDown}
            autoComplete="off"
            spellCheck={false}
          />
          <kbd className={styles.esc} aria-hidden="true">
            Esc
          </kbd>
        </label>
        <ul id={listId} role="listbox" className={styles.list} aria-label="Results">
          {results.map((item, i) => (
            // Options are chosen with the arrow keys and Enter in the combobox input (aria-activedescendant).
            // eslint-disable-next-line jsx-a11y/click-events-have-key-events
            <li
              key={item.id}
              id={`${listId}-${item.id}`}
              role="option"
              aria-selected={i === active}
              className={styles.option}
              onMouseEnter={() => setActive(i)}
              onClick={() => go(item)}
            >
              <span className={styles.title}>{item.title}</span>
              <span className={styles.detail}>{item.detail}</span>
            </li>
          ))}
          {results.length === 0 && (
            <li className={styles.empty} role="option" aria-selected="false" aria-disabled="true">
              Not surveyed yet. Try “Survey your own” to chart any company from its figures.
            </li>
          )}
        </ul>
      </div>
    </dialog>
  );
}
