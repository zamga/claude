import { useAppNavigation } from '@/app/navigation';
import { Button } from '@/components/Button';
import { CheckRow } from '@/components/Form';
import { Sheet } from '@/components/Sheet';
import { Plus } from '@/components/icons';
import type { useWatchlistMembership } from './watchlist';

type Membership = ReturnType<typeof useWatchlistMembership>;

/** Choose collections for a company; each change persists on its own with an Undo toast. */
export function WatchlistPickerSheet({
  open,
  onClose,
  membership,
  symbol,
}: {
  open: boolean;
  onClose: () => void;
  membership: Membership;
  symbol: string;
}) {
  const { push } = useAppNavigation();
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={`Save ${symbol}`}
      size="auto"
      footer={
        <Button
          variant="quiet"
          full
          icon={Plus}
          iconPosition="start"
          onClick={() => {
            onClose();
            push(`/watchlists/new?add=${encodeURIComponent(symbol)}`);
          }}
        >
          Create a new list
        </Button>
      }
    >
      <p className="t-label t-muted" style={{ marginBottom: 12 }}>
        Removing {symbol} from a list keeps your notes, alerts and other lists.
      </p>
      <div role="group" aria-label="Watchlists">
        {membership.lists.map((list) => {
          const member = membership.memberOf.some((candidate) => candidate.id === list.id);
          return (
            <CheckRow
              key={list.id}
              label={list.name}
              detail={`${list.members.length} ${list.members.length === 1 ? 'company' : 'companies'}${membership.pendingList === list.id ? ' · saving…' : ''}`}
              checked={member}
              onChange={(next) =>
                void (next ? membership.add(list.id) : membership.remove(list.id))
              }
            />
          );
        })}
      </div>
    </Sheet>
  );
}
