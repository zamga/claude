import { cameraAt, type Camera } from './path';
import { FILM } from './film';
import { frameUrl, type Orientation } from './frames';

/*
 * Plays "Look closer" on a canvas: scroll sets the film's time, and the
 * player draws the nearest frame it has, scaled and moved to where the camera
 * is at that moment. Because it knows the path each frame was photographed
 * on, a time between two frames is exact, not a cross-fade, and the film can
 * play from a few frames while the rest arrive.
 */

const LAST = FILM.frames - 1;
const STOPS = [0, LAST / 2, LAST];

/** The camera at film time t, for the framing a screen of this shape gets. */
export const cameraFor = (o: Orientation, t: number): Camera => cameraAt(FILM[o].shots, t);

/** The framing for a stage: tall frames for a screen held upright. */
export const orientationFor = (width: number, height: number): Orientation => (width < height ? 'tall' : 'wide');

/**
 * The order frames are fetched in: the three stops first, then ever finer
 * strides, so the film is whole early and sharpens as it loads. With Save-Data
 * on, only every sixth frame.
 */
export function loadOrder(saveData: boolean): number[] {
  const order: number[] = [];
  const add = (i: number) => {
    if (i >= 0 && i <= LAST && !order.includes(i)) order.push(i);
  };
  STOPS.forEach(add);
  for (const stride of saveData ? [12, 6] : [12, 6, 3, 1]) for (let i = 0; i <= LAST; i += stride) add(i);
  return order;
}

interface Options {
  /** The surface colour around the sheet, shown wherever a frame does not reach yet. */
  ground: string;
  /** Called after each draw with the screen's CSS pixels per CSS pixel of the cover, for the scale bar. */
  onDraw?: (scale: number) => void;
  /** Called once the first frame has been drawn. */
  onReady?: () => void;
}

export interface Player {
  /** Sets the film's time (0 to 1); the picture follows with a little smoothing. */
  seek(t: number, immediate?: boolean): void;
  /** Starts fetching frames for the stage's current shape. */
  load(): void;
  resize(): void;
  destroy(): void;
}

export function createPlayer(canvas: HTMLCanvasElement, options: Options): Player {
  const ctx = canvas.getContext('2d', { alpha: false });
  const frames: Record<Orientation, (HTMLImageElement | undefined)[]> = { wide: [], tall: [] };
  const started: Record<Orientation, boolean> = { wide: false, tall: false };
  let orientation: Orientation = 'wide';
  let target = 0;
  let current = 0;
  let drawn = -1;
  let raf = 0;
  let last = 0;
  let ready = false;
  let destroyed = false;
  let width = 0;
  let height = 0;

  const saveData = Boolean((navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData);

  const queues: Record<Orientation, number[] | null> = { wide: null, tall: null };
  // Fetches in flight per framing: four at a time, however often fetching is asked for.
  const running: Record<Orientation, number> = { wide: 0, tall: 0 };

  function fetchFrames(o: Orientation) {
    started[o] = true;
    // Picks up where it left off if the screen turned away from this framing and back.
    const queue = (queues[o] ??= loadOrder(saveData).filter((i) => !frames[o][i]));
    const next = async (): Promise<void> => {
      // A framing the screen no longer uses (it was turned) stops fetching; the other one takes over.
      if (destroyed || o !== orientation) return;
      const i = queue.shift();
      if (i === undefined) return;
      const img = new Image();
      img.decoding = 'async';
      img.src = frameUrl(o, i);
      try {
        await img.decode();
        frames[o][i] = img;
        // A frame nearer the camera than the one on screen sharpens the picture: draw again.
        if (o === orientation) {
          drawn = -1;
          request();
        }
      } catch {
        // A frame that fails to load is left out; its neighbours stand in for it.
      }
      return next();
    };
    const lane = async () => {
      running[o]++;
      await next();
      running[o]--;
    };
    for (let n = running[o]; n < 4; n++) void lane();
  }

  function resize() {
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    width = Math.max(1, Math.round(rect.width * dpr));
    height = Math.max(1, Math.round(rect.height * dpr));
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
    const o = orientationFor(rect.width, rect.height);
    if (rect.width > 0 && rect.height > 0 && o !== orientation) {
      orientation = o;
      if (started.wide || started.tall) fetchFrames(o);
    }
    drawn = -1;
    request();
  }

  /** The loaded frame to draw for frame position f: the nearest at or before it, else the nearest after. */
  function pick(f: number): number {
    const list = frames[orientation];
    for (let i = Math.floor(f); i >= 0; i--) if (list[i]) return i;
    for (let i = Math.ceil(f); i <= LAST; i++) if (list[i]) return i;
    return -1;
  }

  function draw() {
    if (!ctx) return;
    const f = current * LAST;
    const i = pick(f);
    if (i < 0) return;
    const img = frames[orientation][i]!;
    const framing = FILM[orientation];
    const now = cameraFor(orientation, current);
    const shot = cameraFor(orientation, i / LAST);
    // Cover the canvas with the frame, then move frame i's camera to where the camera is now.
    const fit = Math.max(width / framing.width, height / framing.height);
    const scale = fit * (now.zoom / shot.zoom);
    const px = framing.width / 2 + (now.x - shot.x) * shot.zoom;
    const py = framing.height / 2 + (now.y - shot.y) * shot.zoom;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = options.ground;
    ctx.fillRect(0, 0, width, height);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.setTransform(scale, 0, 0, scale, width / 2 - px * scale, height / 2 - py * scale);
    ctx.drawImage(img, 0, 0);
    options.onDraw?.((fit * now.zoom * canvas.clientWidth) / width);
    if (!ready) {
      ready = true;
      options.onReady?.();
    }
  }

  function tick(time: number) {
    raf = 0;
    const dt = last ? Math.min(64, time - last) : 16;
    last = time;
    // Follow the scroll closely but not rigidly: a 70 ms time constant.
    current += (target - current) * (1 - Math.exp(-dt / 70));
    if (Math.abs(target - current) < 0.0004) current = target;
    const key = Math.round(current * 1e5);
    if (key !== drawn) {
      drawn = key;
      draw();
    }
    if (current !== target) request();
    else last = 0;
  }

  function request() {
    if (!raf && !destroyed) raf = requestAnimationFrame(tick);
  }

  resize();

  return {
    seek(t, immediate = false) {
      target = Math.min(1, Math.max(0, t));
      if (immediate) current = target;
      request();
    },
    load() {
      // Measure again first: the framing is the one the stage has now, not when the player was made.
      resize();
      fetchFrames(orientation);
    },
    resize,
    destroy() {
      destroyed = true;
      cancelAnimationFrame(raf);
    },
  };
}
