import { FILM } from './film';

/** Wide frames for landscape screens, tall ones for phones held upright. */
export type Orientation = 'wide' | 'tall';

/** Where a frame of "Look closer" is served from; the version changes whenever the frames do. */
export const frameUrl = (o: Orientation, i: number) =>
  `${import.meta.env.BASE_URL}film/look-closer/${FILM.version}/${o}/${String(i).padStart(2, '0')}.webp`;
