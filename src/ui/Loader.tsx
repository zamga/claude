import styles from './Loader.module.css';

/** The Plimsoll mark filling with water: used while a survey is under way. */
export function Loader({ label }: { label: string }) {
  return (
    <div className={styles.loader} role="status">
      <svg viewBox="0 0 64 64" width="72" height="72" aria-hidden="true">
        <defs>
          <clipPath id="loader-ring">
            <circle cx="32" cy="32" r="20" />
          </clipPath>
        </defs>
        <g clipPath="url(#loader-ring)">
          <rect className={styles.water} x="0" y="0" width="64" height="64" />
        </g>
        <circle cx="32" cy="32" r="20" className={styles.ring} />
        <line x1="4" x2="60" y1="32" y2="32" className={styles.ring} />
      </svg>
      <p>{label}</p>
    </div>
  );
}
