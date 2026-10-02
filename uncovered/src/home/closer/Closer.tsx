import { useEffect, useRef, useState, type ComponentType, type RefObject } from 'react';
import { useReducedMotion } from '../../lib/motion';
import { Link } from '../../lib/router';
import { BEATS, Heading, LAST, SOURCE, SOURCE_NUMBER, STOPS } from './beats';
import { frameUrl } from './frames';
import styles from './Closer.module.css';

/*
 * Look closer: the front page's cover, photographed, and a camera that moves
 * from the whole sheet to one figure and then to the source printed beneath
 * it. Scroll drives the camera. The page arrives with the same three
 * photographs laid out as a contact sheet, which is what reduced motion and
 * a page without scripts keep; the film replaces it once its code has loaded,
 * if the reader has not begun the section yet, so nothing moves under them.
 */

export function Closer() {
  const reduced = useReducedMotion();
  const ref = useRef<HTMLElement>(null);
  const [awake, setAwake] = useState(false);
  const [Film, setFilm] = useState<ComponentType | null>(null);
  // The contact sheet stays for this visit: the reader had begun it, or the film could not load.
  const [stays, setStays] = useState(false);

  // Nothing of this section is fetched while the first screen paints: it wakes at the reader's first
  // scroll, touch or key, or a few seconds after the page has loaded.
  useEffect(() => {
    let timer = 0;
    const wake = () => {
      setAwake(true);
      stop();
    };
    const events = ['scroll', 'pointerdown', 'keydown', 'touchstart', 'wheel'] as const;
    const stop = () => {
      window.clearTimeout(timer);
      window.removeEventListener('load', later);
      events.forEach((e) => window.removeEventListener(e, wake));
    };
    const later = () => {
      timer = window.setTimeout(wake, 3000);
    };
    events.forEach((e) => window.addEventListener(e, wake, { passive: true, once: true }));
    if (document.readyState === 'complete') later();
    else window.addEventListener('load', later, { once: true });
    return stop;
  }, []);

  useEffect(() => {
    if (!awake || reduced) return;
    let live = true;
    import('./Film')
      .then(({ Film: loaded }) => {
        if (!live) return;
        // Only while the reader has not begun the section: once they are reading the contact sheet, it stays.
        const top = ref.current?.getBoundingClientRect().top ?? 0;
        if (top > window.innerHeight * 0.25) setFilm(() => loaded);
        else setStays(true);
      })
      .catch(() => live && setStays(true));
    return () => {
      live = false;
    };
  }, [awake, reduced]);

  // Reduced motion, chosen at any time, goes back to the contact sheet.
  if (Film && !reduced) return <Film />;
  // Its photographs are fetched only once it is certain to stay, so a film that is coming costs nothing.
  return <ContactSheet sectionRef={ref} photos={awake && (reduced || stays)} />;
}

/**
 * The three photographs with their words. Until the section wakes, a photograph is markup for pages
 * without scripts only, so none is fetched while the first screen paints.
 */
function ContactSheet({ sectionRef, photos }: { sectionRef: RefObject<HTMLElement | null>; photos: boolean }) {
  return (
    <section ref={sectionRef} className={styles.sheetSection} aria-labelledby="closer-title">
      <div className="page">
        <header className={styles.sheetHead}>
          <p className="eyebrow">{BEATS[0]!.kicker}</p>
          <Heading id="closer-title" />
          <p className={styles.lede}>{BEATS[0]!.body}</p>
        </header>
        <ol className={styles.sheet}>
          {BEATS.map((b, i) => (
            <li key={i}>
              <figure className={styles.frame}>
                <p className={styles.frameNo} aria-hidden="true">
                  {String(STOPS[i]).padStart(2, '0')} / {LAST}
                </p>
                <Photo src={frameUrl('wide', STOPS[i]!)} alt={b.alt} live={photos} />
                <figcaption>
                  <span className={styles.caption}>{b.caption}</span>
                  {i > 0 && (
                    <>
                      <span className={styles.display}>{b.title}</span>
                      {b.line && <span className={styles.sourceLine}>{b.line}</span>}
                      <span className={styles.body}>{b.body}</span>
                    </>
                  )}
                </figcaption>
              </figure>
            </li>
          ))}
        </ol>
        <p className={styles.after}>
          <Link to={`/report/krka#src-${SOURCE.id}`}>Open source {SOURCE_NUMBER} in the report</Link>
        </p>
      </div>
    </section>
  );
}

/** A photograph in a box that keeps its place, so nothing moves when it arrives. */
function Photo({ src, alt, live }: { src: string; alt: string; live: boolean }) {
  const img = <img src={src} width={1600} height={900} alt={alt} loading="lazy" decoding="async" />;
  return <span className={styles.photo}>{live ? img : <noscript>{img}</noscript>}</span>;
}
