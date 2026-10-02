import type { CSSProperties } from 'react';
import styles from './Odometer.module.css';

/*
 * A number set like a numbering machine: each digit is a wheel that turns to
 * its place when the value changes. Other characters (currency signs,
 * separators) are set as they are. Decorative: give the value in words
 * elsewhere for assistive technology.
 */
export function Odometer({ value, className }: { value: string; className?: string }) {
  const chars = [...value];
  return (
    <span className={`${styles.odometer} ${className ?? ''}`} aria-hidden="true">
      {chars.map((c, i) => {
        // Key wheels from the right, so the units wheel stays the same wheel as the number grows.
        const key = chars.length - i;
        if (!/\d/.test(c))
          return (
            <span key={`c${key}`} className={styles.char}>
              {c}
            </span>
          );
        return (
          <span key={`d${key}`} className={styles.wheel} style={{ '--d': Number(c) } as CSSProperties}>
            <span className={styles.strip}>
              {'0123456789'.split('').map((d) => (
                <span key={d}>{d}</span>
              ))}
            </span>
            <span className={styles.sizer}>{c}</span>
          </span>
        );
      })}
    </span>
  );
}
