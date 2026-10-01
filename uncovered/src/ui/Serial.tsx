import styles from './Serial.module.css';

/**
 * A report serial set by a numbering machine: each digit is a wheel that rolls
 * to its value. Letters and spaces print as they are.
 */
export function Serial({ value, label = 'Report number' }: { value: string; label?: string }) {
  return (
    <span className={styles.serial} aria-label={`${label} ${value}`} role="img">
      <span className={styles.no} aria-hidden="true">
        No.
      </span>
      {[...value].map((ch, i) =>
        /\d/.test(ch) ? (
          <span key={i} className={styles.wheel} aria-hidden="true">
            <span
              className={styles.reel}
              style={{ transform: `translateY(${-Number(ch) * 10}%)`, transitionDelay: `${i * 35}ms` }}
            >
              {'0123456789'.split('').map((d) => (
                <span key={d}>{d}</span>
              ))}
            </span>
          </span>
        ) : (
          <span key={i} className={styles.char} aria-hidden="true">
            {ch === ' ' ? ' ' : ch}
          </span>
        ),
      )}
    </span>
  );
}
