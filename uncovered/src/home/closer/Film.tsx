import { useEffect, useRef, useState } from 'react';
import { Link } from '../../lib/router';
import { BEATS, MM_PER_PX_OF_COVER, SOURCE, SOURCE_NUMBER } from './beats';
import { beatAt, timeAt } from './path';
import { frameUrl } from './frames';
import { createPlayer, type Player } from './player';
import styles from './Film.module.css';

/*
 * The film: a stage held on screen while the section scrolls past it, the
 * photographs drawn on a canvas by the player, and the words for the one in
 * view. Loaded after the page, so the front page's first paint never waits
 * for it.
 */

// A scale bar, as a photomicrograph carries: the longest round length that fits the bar's space.
const BARS = [100, 50, 20, 10, 5, 2, 1, 0.5, 0.2];

export function Film() {
  const trackRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const barRef = useRef<HTMLSpanElement>(null);
  const barLabelRef = useRef<HTMLSpanElement>(null);
  const fieldRef = useRef<HTMLSpanElement>(null);
  const playerRef = useRef<Player | null>(null);
  const [beat, setBeat] = useState(0);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const track = trackRef.current;
    const canvas = canvasRef.current;
    if (!track || !canvas) return;
    const ground = getComputedStyle(track).getPropertyValue('--film-ground').trim() || '#cac5bb';
    const player = createPlayer(canvas, {
      ground,
      onReady: () => setReady(true),
      onDraw: (scale) => {
        // Screen pixels per millimetre of paper, for the scale bar and the width of the view.
        const perMm = scale / MM_PER_PX_OF_COVER;
        const bar = BARS.find((mm) => mm * perMm <= 132) ?? BARS[BARS.length - 1]!;
        if (barRef.current) barRef.current.style.width = `${(bar * perMm).toFixed(1)}px`;
        if (barLabelRef.current) barLabelRef.current.textContent = `${bar} mm`;
        if (fieldRef.current) fieldRef.current.textContent = `${Math.round(canvas.clientWidth / perMm)} mm`;
      },
    });
    playerRef.current = player;

    let raf = 0;
    let shown = 0;
    const progress = () => {
      const r = track.getBoundingClientRect();
      const span = r.height - window.innerHeight;
      return span > 0 ? Math.min(1, Math.max(0, -r.top / span)) : 0;
    };
    const update = () => {
      raf = 0;
      const t = timeAt(progress());
      player.seek(t);
      const b = beatAt(t);
      if (b !== shown) {
        shown = b;
        setBeat(b);
      }
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };
    player.seek(timeAt(progress()), true);

    // Fetch frames once the page has finished loading and the film is near; never ahead of the page's own needs.
    let near = false;
    let loaded = document.readyState === 'complete';
    const begin = () => {
      if (!near || !loaded) return;
      // Safari has no requestIdleCallback; a short timeout stands in for it.
      if (typeof window.requestIdleCallback === 'function') {
        window.requestIdleCallback(() => player.load(), { timeout: 1500 });
      } else setTimeout(() => player.load(), 200);
    };
    const onLoad = () => {
      loaded = true;
      begin();
    };
    if (!loaded) window.addEventListener('load', onLoad, { once: true });
    const io = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting)) return;
        near = true;
        io.disconnect();
        begin();
      },
      { rootMargin: '150% 0px' },
    );
    io.observe(track);

    const ro = new ResizeObserver(() => player.resize());
    ro.observe(canvas);
    window.addEventListener('scroll', onScroll, { passive: true });
    update();
    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
      ro.disconnect();
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('load', onLoad);
      player.destroy();
      playerRef.current = null;
    };
  }, []);

  // A keyboard reaching the source link while another photograph shows is taken to the last one.
  const toEnd = () => {
    const track = trackRef.current;
    if (!track) return;
    const r = track.getBoundingClientRect();
    const top = window.scrollY + r.top + (r.height - window.innerHeight) * 0.95;
    window.scrollTo({ top, behavior: 'instant' });
  };

  return (
    <section className={styles.filmSection} aria-labelledby="closer-title" data-beat={beat}>
      <div ref={trackRef} className={styles.track}>
        <div className={styles.stage}>
          <picture className={styles.poster}>
            <source media="(orientation: portrait)" srcSet={frameUrl('tall', 0)} />
            <img src={frameUrl('wide', 0)} alt="" width={1600} height={900} loading="lazy" decoding="async" />
          </picture>
          <canvas ref={canvasRef} className={styles.canvas} data-ready={ready ? '' : undefined} aria-hidden="true" />
          <div className={styles.scrim} aria-hidden="true" />
          <div className={`page ${styles.overlay}`}>
            <div className={styles.beats}>
              {BEATS.map((b, i) => (
                <div key={i} className={styles.beat} data-on={beat === i ? '' : undefined}>
                  <p className={`eyebrow ${styles.kicker}`}>{b.kicker}</p>
                  {i === 0 ? (
                    <h2 id="closer-title" className={styles.title}>
                      {b.title}
                    </h2>
                  ) : (
                    <p className={styles.display}>{b.title}</p>
                  )}
                  {b.line && <p className={styles.sourceLine}>{b.line}</p>}
                  <p className={styles.body}>{b.body}</p>
                  {i === 2 && (
                    <p className={styles.more}>
                      <Link to={`/report/krka#src-${SOURCE.id}`} onFocus={toEnd}>
                        Open source {SOURCE_NUMBER} in the report
                      </Link>
                    </p>
                  )}
                </div>
              ))}
            </div>
            <p className={styles.readout} aria-hidden="true">
              <span className={styles.scale}>
                <span ref={barRef} className={styles.bar} />
                <span ref={barLabelRef}>10 mm</span>
              </span>
              <span>
                Field <span ref={fieldRef}>—</span>
              </span>
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
