import { useState } from 'react';
import { IconButton } from '@/components/IconButton';
import { Bookmark } from '@/components/icons';
import { useOffline } from './status';
import { AccountPrompt, useWatchlistMembership } from './watchlist';
import { WatchlistPickerSheet } from './WatchlistPicker';
import styles from './SaveToggle.module.css';

/**
 * Row-level watchlist bookmark (spec pages 26, 31). The first press saves to the default list with
 * an Undo toast; once saved, the press opens list selection. Sheets mount on first use only.
 */
export function SaveToggle({
  instrumentId,
  symbol,
  showLabel = false,
  label = 'Watchlisted',
}: {
  instrumentId: string;
  symbol: string;
  showLabel?: boolean;
  label?: string;
}) {
  const membership = useWatchlistMembership(instrumentId, symbol);
  const offline = useOffline();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerMounted, setPickerMounted] = useState(false);
  const [promptMounted, setPromptMounted] = useState(false);

  const accessible = offline
    ? `Saving ${symbol} needs a connection`
    : membership.saved
      ? `${symbol} is on your watchlist. Edit lists`
      : `Save ${symbol} to your watchlist`;

  return (
    <span className={styles.toggle}>
      <IconButton
        icon={Bookmark}
        label={accessible}
        active={membership.saved}
        busy={membership.pendingList != null}
        disabled={offline}
        className={membership.saved ? styles.saved : undefined}
        onClick={() => {
          if (!membership.ensureAllowed()) {
            setPromptMounted(true);
            return;
          }
          if (membership.saved) {
            setPickerMounted(true);
            setPickerOpen(true);
          } else {
            void membership.quickSave();
          }
        }}
      />
      {showLabel && membership.saved && (
        <span className={styles.label} aria-hidden>
          {label}
        </span>
      )}
      {pickerMounted && (
        <WatchlistPickerSheet
          open={pickerOpen}
          onClose={() => setPickerOpen(false)}
          membership={membership}
          symbol={symbol}
        />
      )}
      {promptMounted && (
        <AccountPrompt
          intent={membership.intent}
          onClose={membership.clearIntent}
          what={`Sign in to save ${symbol} and see it with your other companies on every device.`}
        />
      )}
    </span>
  );
}
