import { useEffect, useRef } from 'react';
import { useSeen, useWidth } from '../lib/hooks';
import { prefersReducedMotion } from '../lib/motion';
import { token, useTheme } from '../lib/theme';
import { whenNear } from '../motion/scroll';
import styles from './Gap.module.css';

const ENTITIES = 294_000;
const PER_DOT = 100;
const DOTS = ENTITIES / PER_DOT;
const GAP = 9;

const ease = (t: number) => 1 - (1 - t) ** 3;

/**
 * The coverage gap as a field of 2,940 dots, one per hundred registered
 * entities in Slovenia. A single dot is lit. The lamp searches the register
 * as the section scrolls past (dots fluoresce under it) and comes to rest on
 * the one covered company; with a mouse, you can search it yourself.
 */
export function Gap() {
  const [box, width] = useWidth<HTMLDivElement>(1000);
  const [seenRef, seen] = useSeen<HTMLDivElement>();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const glowRef = useRef<HTMLCanvasElement>(null);
  const theme = useTheme();
  const cols = Math.max(24, Math.floor(width / GAP));
  const rows = Math.ceil(DOTS / cols);
  const height = rows * GAP;
  const lit = Math.floor(DOTS * 0.618); // the one covered dot, placed off-centre

  useEffect(() => {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    // The register as printed, and the same dots as they fluoresce under the lamp.
    const layers: [HTMLCanvasElement | null, string, number][] = [
      [canvasRef.current, token('--rule-2') || '#b4bdb7', 1.5],
      [glowRef.current, token('--ovi-b') || '#6b4bd6', 1.9],
    ];
    for (const [canvas, color, r] of layers) {
      if (!canvas) continue;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      const ctx = canvas.getContext('2d');
      if (!ctx) continue;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, width, height);
      ctx.fillStyle = color;
      for (let i = 0; i < DOTS; i++) {
        if (i === lit) continue;
        ctx.beginPath();
        ctx.arc((i % cols) * GAP + GAP / 2, Math.floor(i / cols) * GAP + GAP / 2, r, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }, [width, height, cols, lit, theme]);

  const litX = (lit % cols) * GAP + GAP / 2;
  const litY = Math.floor(lit / cols) * GAP + GAP / 2;

  // Where the lamp is: searching along the scroll, under the pointer, or at rest on the lit dot.
  const target = useRef({ litX, litY, width, height });
  useEffect(() => {
    target.current = { litX, litY, width, height };
    const field = box.current;
    if (field && !field.dataset.lamp) {
      field.style.setProperty('--lx', `${litX}px`);
      field.style.setProperty('--ly', `${litY}px`);
    }
  }, [box, litX, litY, width, height]);

  useEffect(() => {
    const field = box.current;
    if (!field || prefersReducedMotion()) return;
    let held = false;
    let swept = 1;
    const place = (x: number, y: number) => {
      field.style.setProperty('--lx', `${x.toFixed(1)}px`);
      field.style.setProperty('--ly', `${y.toFixed(1)}px`);
    };
    const sweep = (p: number) => {
      swept = p;
      if (held) return;
      const { litX: lx, litY: ly, width: w, height: h } = target.current;
      const k = ease(p);
      // A searching path: across and back over the register, narrowing onto the one covered company.
      place(
        lx + (Math.sin(p * Math.PI * 3.2) * w * 0.42 + (0.5 * w - lx) * 0.3) * (1 - k),
        ly + Math.cos(p * Math.PI * 2.1) * h * 0.38 * (1 - k),
      );
    };
    const move = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse') return;
      const r = field.getBoundingClientRect();
      held = true;
      field.dataset.lamp = 'held';
      place(e.clientX - r.left, e.clientY - r.top);
    };
    const leave = () => {
      held = false;
      delete field.dataset.lamp;
      sweep(swept);
    };
    field.addEventListener('pointermove', move);
    field.addEventListener('pointerleave', leave);
    const cancel = whenNear(
      field,
      ({ ScrollTrigger }) => {
        const trigger = ScrollTrigger.create({
          trigger: field,
          start: 'top 85%',
          end: 'bottom 45%',
          scrub: true,
          onUpdate: (self) => sweep(self.progress),
        });
        sweep(trigger.progress);
        return () => trigger.kill();
      },
      '15%',
    );
    return () => {
      cancel();
      field.removeEventListener('pointermove', move);
      field.removeEventListener('pointerleave', leave);
    };
  }, [box]);

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
          <canvas ref={glowRef} className={styles.glow} style={{ width, height }} aria-hidden="true" />
          <span className={styles.lit} style={{ left: litX, top: litY }} aria-hidden="true" />
          <p className={styles.legend}>
            <span>
              Each dot is a hundred entities in Slovenia’s business register. <strong>One is lit.</strong>{' '}
              <span className={styles.forPointer}>Pass the lamp over the register to search it.</span>
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
