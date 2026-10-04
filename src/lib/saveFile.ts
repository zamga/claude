import { isIos } from './platform';

export type SaveOutcome = 'shared' | 'downloaded' | 'cancelled';

/**
 * Saves a file the way the device does it best: the share sheet (Save to Files) on iPhone and
 * iPad, where a download from an app opened from the Home Screen is unreliable, and an ordinary
 * download elsewhere. Call it from the tap itself: the share sheet needs that gesture.
 */
export async function saveFile(blob: Blob, filename: string): Promise<SaveOutcome> {
  const file = new File([blob], filename, { type: blob.type });
  if (isIos() && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: filename });
      return 'shared';
    } catch (failure) {
      if (failure instanceof DOMException && failure.name === 'AbortError') return 'cancelled';
      // Not allowed here: fall back to a download.
    }
  }
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return 'downloaded';
}
