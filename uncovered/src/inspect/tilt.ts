/*
 * The phone's tilt moves the foil. Most browsers report it freely; Safari on
 * iOS reports it only after the person allows it, which must be asked from a
 * tap. tiltNeedsPermission() says whether to offer that tap, and askForTilt()
 * makes the request; every inspected sheet listening hears the answer.
 */

type Permissioned = typeof DeviceOrientationEvent & { requestPermission?: () => Promise<'granted' | 'denied'> };

export const TILT_GRANTED = 'uncovered:tilt-granted';

export function tiltNeedsPermission(): boolean {
  if (typeof window === 'undefined' || typeof DeviceOrientationEvent === 'undefined') return false;
  return typeof (DeviceOrientationEvent as Permissioned).requestPermission === 'function';
}

export async function askForTilt(): Promise<boolean> {
  const request = (DeviceOrientationEvent as Permissioned).requestPermission;
  if (!request) return true;
  try {
    const answer = await request();
    if (answer === 'granted') window.dispatchEvent(new Event(TILT_GRANTED));
    return answer === 'granted';
  } catch {
    return false;
  }
}
