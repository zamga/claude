import styles from './Microtext.module.css';

/**
 * Microprinting: a rule made of tiny repeated text, as on banknotes and
 * certificates. Purely decorative, so hidden from assistive technology.
 */
export function Microtext({ text, className, hidden = false }: { text: string; className?: string; hidden?: boolean }) {
  const line = text.toUpperCase().repeat(24);
  return (
    <div className={`${styles.micro} ${hidden ? styles.uvOnly : ''} ${className ?? ''}`} aria-hidden="true">
      <span>{line}</span>
    </div>
  );
}
