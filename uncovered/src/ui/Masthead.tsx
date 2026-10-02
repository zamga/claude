import { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from '../lib/router';
import { setThemePreference, useTheme } from '../lib/theme';
import { Seal } from '../seal/Seal';
import { Microtext } from './Microtext';
import styles from './Masthead.module.css';

const NAV = [
  { to: '/report/krka', label: 'Sample report' },
  { to: '/#how', label: 'How it works' },
  { to: '/method', label: 'Method' },
  { to: '/#pricing', label: 'Pricing' },
];

export function Wordmark({ size = 30 }: { size?: number }) {
  return (
    <span className={styles.wordmark}>
      <Seal seed="Uncovered" size={size} detail="glyph" draw="static" />
      <span className={styles.word}>Uncovered</span>
    </span>
  );
}

export function Masthead() {
  const theme = useTheme();
  const { path } = useLocation();
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const open = menuFor === path; // the menu closes itself on navigation
  const buttonRef = useRef<HTMLButtonElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setMenuFor(null);
        buttonRef.current?.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    sheetRef.current?.querySelector<HTMLElement>('a')?.focus();
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  const uv = theme === 'dark';
  const toggleUv = () => setThemePreference(uv ? 'light' : 'dark');

  return (
    <header className={styles.masthead}>
      <div className={`page ${styles.bar}`}>
        <Link to="/" className={styles.brand} aria-label="Uncovered, home">
          <Wordmark />
          <span className={styles.desk}>Research</span>
        </Link>
        <nav aria-label="Main" className={styles.nav}>
          <ul role="list">
            {NAV.map((n) => (
              <li key={n.to}>
                <Link to={n.to} aria-current={path === n.to ? 'page' : undefined}>
                  {n.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <div className={styles.tools}>
          <button
            type="button"
            className={styles.uv}
            aria-pressed={uv}
            onClick={toggleUv}
            title={uv ? 'Switch to daylight' : 'Inspect under UV light'}
          >
            <span className={styles.lamp} aria-hidden="true" />
            <span>UV</span>
            <span className="visually-hidden"> light: dark theme</span>
          </button>
          <Link to="/initiate" className={styles.cta} data-magnetic>
            Initiate coverage
          </Link>
          <button
            ref={buttonRef}
            type="button"
            className={styles.menuButton}
            aria-expanded={open}
            aria-controls="menu-sheet"
            onClick={() => setMenuFor(open ? null : path)}
          >
            <span className="visually-hidden">Menu</span>
            <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
              {open ? (
                <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="1.5" />
              ) : (
                <path d="M3 8h18M3 16h18" stroke="currentColor" strokeWidth="1.5" />
              )}
            </svg>
          </button>
        </div>
      </div>
      <Microtext
        className={styles.rule}
        text="Uncovered · Initiating coverage on every company · Every figure footnoted · "
      />
      <div id="menu-sheet" ref={sheetRef} className={styles.sheet} hidden={!open}>
        <nav aria-label="Main, mobile">
          <ul role="list">
            {NAV.map((n) => (
              <li key={n.to}>
                <Link to={n.to}>{n.label}</Link>
              </li>
            ))}
            <li>
              <Link to="/initiate">Initiate coverage</Link>
            </li>
          </ul>
        </nav>
      </div>
    </header>
  );
}
