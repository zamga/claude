import { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from '../lib/router';
import { setThemePreference, useThemePreference, type ThemePreference } from '../lib/theme';
import { PlimsollMark } from './Mark';
import styles from './Header.module.css';

const NAV = [
  { to: '/atlas', label: 'Atlas' },
  { to: '/survey', label: 'Survey your own' },
  { to: '/method', label: 'Method' },
];

const THEMES: { id: ThemePreference; label: string; short: string }[] = [
  { id: 'system', label: 'Match system', short: 'Auto' },
  { id: 'light', label: 'Day chart', short: 'Day' },
  { id: 'dark', label: 'Night watch', short: 'Night' },
];

export function Header({ onSearch }: { onSearch: () => void }) {
  const { path } = useLocation();
  // The menu belongs to the page it was opened on, so navigating closes it.
  const [openOn, setOpenOn] = useState<string | null>(null);
  const open = openOn === path;
  const setOpen = (next: boolean | ((o: boolean) => boolean)) =>
    setOpenOn(typeof next === 'function' ? (next(open) ? path : null) : next ? path : null);
  const theme = useThemePreference();
  const menuRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpenOn(null);
        buttonRef.current?.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    menuRef.current?.querySelector<HTMLElement>('a, button')?.focus();
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <header className={styles.header}>
      <div className={`page ${styles.inner}`}>
        <Link to="/" className={styles.brand} aria-label="Plimsoll, home">
          <PlimsollMark size={26} className={styles.mark} />
          <span className={styles.word}>Plimsoll</span>
        </Link>

        <nav aria-label="Main" className={styles.nav}>
          <ul role="list">
            {NAV.map((n) => (
              <li key={n.to}>
                <Link to={n.to} aria-current={path.startsWith(n.to) ? 'page' : undefined}>
                  {n.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className={styles.tools}>
          <button type="button" className={styles.search} onClick={onSearch} aria-keyshortcuts="Control+K Meta+K /">
            <svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true">
              <circle cx="8.5" cy="8.5" r="5.5" fill="none" stroke="currentColor" strokeWidth="1.6" />
              <path d="M13 13l4.5 4.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
            <span className={styles.searchLabel}>Chart a company</span>
            <kbd className={styles.kbd}>⌘K</kbd>
          </button>

          <div className={styles.theme} role="radiogroup" aria-label="Colour theme">
            {THEMES.map((t) => (
              <button
                key={t.id}
                type="button"
                role="radio"
                aria-checked={theme === t.id}
                title={t.label}
                onClick={() => setThemePreference(t.id)}
              >
                {t.short}
              </button>
            ))}
          </div>

          <button
            ref={buttonRef}
            type="button"
            className={styles.menuButton}
            aria-expanded={open}
            aria-controls="site-menu"
            onClick={() => setOpen((o) => !o)}
          >
            <span className="visually-hidden">Menu</span>
            <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
              {open ? (
                <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
              ) : (
                <path d="M4 8h16M4 16h16" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
              )}
            </svg>
          </button>
        </div>
      </div>

      <div id="site-menu" ref={menuRef} className={styles.sheet} hidden={!open}>
        <nav aria-label="Main, mobile">
          <ul role="list">
            <li>
              <Link to="/">Home</Link>
            </li>
            {NAV.map((n) => (
              <li key={n.to}>
                <Link to={n.to}>{n.label}</Link>
              </li>
            ))}
          </ul>
        </nav>
        <div className={styles.sheetTheme} role="radiogroup" aria-label="Colour theme">
          {THEMES.map((t) => (
            <button key={t.id} type="button" role="radio" aria-checked={theme === t.id} onClick={() => setThemePreference(t.id)}>
              {t.label}
            </button>
          ))}
        </div>
      </div>
    </header>
  );
}
