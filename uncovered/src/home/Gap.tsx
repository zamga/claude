import { useEffect, useRef } from 'react';
import { useSeen, useWidth } from '../lib/hooks';
import { token, useTheme } from '../lib/theme';
import styles from './Gap.module.css';

const ENTITIES = 294_000;
const PER_DOT = 100;
const DOTS = ENTITIES / PER_DOT;
const GAP = 9;

/**
 * The coverage gap as a field of 2,940 dots, one per hundred registered
 * entities in Slovenia. A single dot is lit.
 */
export function Gap() {
  const [box, width] = useWidth<HTMLDivElement>(1000);
  const [seenRef, seen] = useSeen<HTMLDivElement>();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const theme = useTheme();
  const cols = Math.max(24, Math.floor(width / GAP));
  const rows = Math.ceil(DOTS / cols);
  const height = rows * GAP;
  const lit = Math.floor(DOTS * 0.618); // the one covered dot, placed off-centre

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = token('--rule-2') || '#b4bdb7';
    for (let i = 0; i < DOTS; i++) {
      if (i === lit) continue;
      ctx.beginPath();
      ctx.arc((i % cols) * GAP + GAP / 2, Math.floor(i / cols) * GAP + GAP / 2, 1.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }, [width, height, cols, lit, theme]);

  const litX = (lit % cols) * GAP + GAP / 2;
  const litY = Math.floor(lit / cols) * GAP + GAP / 2;

  return (
    <section className={styles.gap} aria-labelledby="gap-title">
      <div className={`page ${styles.head}`}>
        <p className="eyebrow">The coverage gap</p>
        <h2 id="gap-title" className={styles.title}>
          294,000 companies. A handful have ever been <em>covered</em>.
        </h2>
        <div className={styles.copy}>
          <p>
            Research desks follow the few companies whose shares trade in Ljubljana. Everyone else, the suppliers,
            borrowers, acquisition targets and employers, is decided on without a single page of analysis.
          </p>
          <p>
            The filings exist: Slovenian companies publish their annual reports through AJPES, free to read. What has
            been missing is the analyst.
          </p>
        </div>
      </div>
      <div className="page" ref={seenRef}>
        <div ref={box} className={styles.field} style={{ height }} data-seen={seen ? 'true' : undefined}>
          <canvas ref={canvasRef} style={{ width, height }} aria-hidden="true" />
          <span className={styles.lit} style={{ left: litX, top: litY }} aria-hidden="true" />
          <p className={styles.legend}>
            <span>
              Each dot is a hundred entities in Slovenia’s business register. <strong>One is lit.</strong>
            </span>
            <span>
              Source:{' '}
              <a href="https://www.kyckr.com/blog/slovenian-business-registry" rel="noreferrer" target="_blank">
                Kyckr, Slovenian Business Registry (2026)
              </a>
            </span>
          </p>
        </div>
      </div>
    </section>
  );
}
