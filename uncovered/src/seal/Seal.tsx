import { useEffect, useId, useMemo, useRef, useState, type CSSProperties, type PointerEvent } from 'react';
import { sealSpec, type SealDetail } from './guilloche';
import { SealRenderer } from './renderer';
import { places } from '../lib/format';
import { prefersReducedMotion } from '../lib/motion';
import { token, useTheme } from '../lib/theme';
import styles from './Seal.module.css';

interface SealProps {
  /** What the seal is generated from, usually the company's name. */
  seed: string;
  /** CSS pixel size. */
  size: number;
  /** Centre monogram, e.g. a ticker or initials. */
  monogram?: string;
  /** Small line under the monogram, e.g. "SI · 1954". */
  submark?: string;
  /** Text engraved around the edge as microtext. */
  ring?: string;
  detail?: SealDetail;
  /** "engrave" draws the seal like a rose-engine lathe; "static" shows it finished. */
  draw?: 'engrave' | 'static';
  /** Engraving duration in ms. */
  duration?: number;
  /**
   * How much of the seal is engraved, 0 to 1, for a seal that grows with the
   * work it stands for. Each change engraves on from where the seal stands.
   */
  progress?: number;
  /** Shift the ink's colour as the pointer moves, like optically variable ink. */
  sheen?: boolean;
  /** Mark the seal as printed over foil, which an inspected sheet draws under it. */
  foil?: boolean;
  className?: string;
  /** Accessible name; omit for a decorative seal. */
  label?: string;
}

/**
 * A company's guilloche seal: canvas engraving, a microtext ring and a
 * monogram. Decorative by default (aria-hidden) unless given a label.
 */
export function Seal({
  seed,
  size,
  monogram,
  submark,
  ring,
  detail = 'full',
  draw = 'engrave',
  duration = 2200,
  progress,
  sheen = false,
  foil = false,
  className,
  label,
}: SealProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<SealRenderer | null>(null);
  const [angle, setAngle] = useState(0);
  const theme = useTheme();
  const pathId = useId().replace(/:/g, '');
  const spec = useMemo(() => sealSpec(seed, detail), [seed, detail]);
  const visible = useRef(false);
  const progressRef = useRef(progress);
  useEffect(() => {
    progressRef.current = progress;
  }, [progress]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ink = token('--intaglio') || '#155e46';
    const renderer = rendererRef.current ?? new SealRenderer(canvas, spec, { size, ink });
    rendererRef.current = renderer;
    renderer.update(spec, { size, ink, hairline: detail === 'glyph' ? 0.8 : 0.6 });
    const paint = () => {
      visible.current = true;
      const p = progressRef.current;
      if (p !== undefined) {
        if (prefersReducedMotion()) renderer.drawTo(p);
        else void renderer.engraveTo(p, duration);
      } else if (draw === 'static' || prefersReducedMotion()) renderer.drawStatic();
      else void renderer.engrave(duration);
    };
    // Seals off screen wait until they come into view: no work spent on what nobody
    // sees, and the engraving plays when it can be watched.
    if (typeof IntersectionObserver === 'undefined') {
      paint();
      return () => renderer.cancel();
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting)) return;
        io.disconnect();
        paint();
      },
      { rootMargin: draw === 'static' ? '50% 0px' : '0px' },
    );
    io.observe(canvas);
    return () => {
      io.disconnect();
      renderer.cancel();
    };
    // Redraw when the seal, its size or the ink (theme) changes.
  }, [spec, size, draw, duration, detail, theme]);

  // A seal following progress engraves on as the progress moves.
  useEffect(() => {
    const renderer = rendererRef.current;
    if (progress === undefined || !renderer || !visible.current) return;
    if (prefersReducedMotion()) renderer.drawTo(progress);
    else void renderer.engraveTo(progress, duration);
  }, [progress, duration]);

  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (!sheen) return;
    const r = e.currentTarget.getBoundingClientRect();
    const a = Math.atan2(e.clientY - (r.top + r.height / 2), e.clientX - (r.left + r.width / 2));
    setAngle((a * 180) / Math.PI);
  };

  const ringText = ring ? fillRing(ring, size) : null;
  const style = { '--seal-size': `${size}px`, '--sheen-angle': `${angle}deg` } as CSSProperties;

  return (
    <div
      className={`${styles.seal} ${className ?? ''}`}
      style={style}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      onPointerMove={onPointerMove}
      data-sheen={sheen ? 'on' : undefined}
      data-foil={foil ? '' : undefined}
    >
      <canvas ref={canvasRef} className={styles.canvas} width={size} height={size} />
      {sheen && <div className={styles.sheen} />}
      {(ringText || monogram) && (
        <svg className={styles.overlay} viewBox="-1 -1 2 2" aria-hidden="true">
          {ringText && (
            <>
              <defs>
                <path
                  id={pathId}
                  d={`M ${-spec.textRadius} 0 a ${spec.textRadius} ${spec.textRadius} 0 1 1 ${spec.textRadius * 2} 0 a ${spec.textRadius} ${spec.textRadius} 0 1 1 ${-spec.textRadius * 2} 0`}
                />
              </defs>
              <text className={styles.ring} fontSize={0.034}>
                <textPath
                  href={`#${pathId}`}
                  startOffset="0"
                  textLength={places(TAU_R(spec.textRadius) * 0.995, 3)}
                  lengthAdjust="spacing"
                >
                  {ringText}
                </textPath>
              </text>
            </>
          )}
          {monogram && (
            <>
              <text
                className={styles.monogram}
                x="0"
                y={submark ? 0.02 : 0.05}
                textAnchor="middle"
                fontSize={places(spec.hub * (monogram.length > 3 ? 0.62 : 0.85), 3)}
              >
                {monogram}
              </text>
              {submark && (
                <text
                  className={styles.submark}
                  x="0"
                  y={places(spec.hub * 0.58, 3)}
                  textAnchor="middle"
                  fontSize={0.034}
                >
                  {submark}
                </text>
              )}
            </>
          )}
        </svg>
      )}
    </div>
  );
}

const TAU_R = (r: number) => Math.PI * 2 * r;

/** Repeat the ring text so it fills the circumference without a gap. */
function fillRing(text: string, size: number): string {
  const unit = `${text.toUpperCase()} · `;
  const approxChars = Math.max(40, Math.round((Math.PI * size * 0.93) / (size * 0.034 * 0.62)));
  let out = unit;
  while (out.length + unit.length <= approxChars) out += unit;
  return out;
}
