import { useEffect } from 'react';
import { useBeforeUnload, useBlocker } from 'react-router';
import { useConfirm } from '@/components/Sheet';

/**
 * Unsaved-work protection (spec pages 25, 38): leaving a dirty form asks whether to keep editing or
 * discard; an unchanged form leaves without a prompt. Drafts that persist locally say so.
 */
export function useUnsavedChangesGuard(dirty: boolean, body = 'Your changes have not been saved.') {
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      dirty && currentLocation.pathname !== nextLocation.pathname,
  );
  const { confirm, element } = useConfirm();

  useEffect(() => {
    if (blocker.state !== 'blocked') return;
    void confirm({
      title: 'Discard your changes?',
      body,
      confirmLabel: 'Discard changes',
      cancelLabel: 'Keep editing',
      destructive: true,
    }).then((discard) => (discard ? blocker.proceed() : blocker.reset()));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [blocker.state]);

  useBeforeUnload(
    (event) => {
      if (!dirty) return;
      event.preventDefault();
    },
    { capture: true },
  );

  return element;
}
