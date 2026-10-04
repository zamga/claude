/** iPhone, iPad or iPod, including iPadOS, which reports itself as a Mac with a touch screen. */
export function isIos(): boolean {
  if (typeof navigator === 'undefined') return false;
  const agent = navigator.userAgent;
  return (
    /iPad|iPhone|iPod/.test(agent) || (agent.includes('Macintosh') && navigator.maxTouchPoints > 1)
  );
}

/** Opened from a home-screen icon as an installed app rather than in a browser tab. */
export function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia?.('(display-mode: standalone)').matches === true ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

/** A phone or tablet: touch is the main input. */
export function isTouchDevice(): boolean {
  return typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches === true;
}
