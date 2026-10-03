import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useCallback, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { useLocation } from 'react-router';
import { useAppNavigation } from '@/app/navigation';
import { useSession } from '@/app/session';
import { Button } from '@/components/Button';
import { Sheet } from '@/components/Sheet';
import { useToast } from '@/components/Toast';
import { api } from '@/data/api';
import { errorMessage } from '@/data/errors';
import { qk, useWatchlists } from '@/data/queries';
import type { Watchlist } from '@/data/types';
import { newIdempotencyKey } from '@/data/transport';
import { haptics } from '@/lib/haptics';

type Intent = { kind: 'auth' } | { kind: 'verify' } | null;

/**
 * Save and remove a company (spec pages 26, 45): optimistic, with a toast that names the list and
 * offers Undo as an inverse persisted operation; a rejected write restores the previous state.
 * Removing from one list never touches notes, alerts or other lists.
 */
export function useWatchlistMembership(
  instrumentId: string | undefined,
  symbol: string | undefined,
) {
  const { signedIn, verified } = useSession();
  const lists = useWatchlists(signedIn);
  const queryClient = useQueryClient();
  const toast = useToast();
  const [intent, setIntent] = useState<Intent>(null);
  const [pendingList, setPendingList] = useState<string | null>(null);

  const memberOf = (lists.data ?? []).filter((list) =>
    list.members.some((member) => member.instrumentId === instrumentId),
  );
  const defaultList = (lists.data ?? [])[0] ?? null;

  const patchCache = useCallback(
    (listId: string, change: (list: Watchlist) => Watchlist) => {
      queryClient.setQueryData<Watchlist[]>(qk.watchlists, (current) =>
        current?.map((list) => (list.id === listId ? change(list) : list)),
      );
    },
    [queryClient],
  );

  const mutation = useMutation({
    mutationFn: async ({ listId, action }: { listId: string; action: 'add' | 'remove' }) =>
      action === 'add'
        ? api.watchlists.addMember(listId, instrumentId!)
        : api.watchlists.removeMember(listId, instrumentId!),
  });

  type Apply = (
    listId: string,
    action: 'add' | 'remove',
    options?: { undoable: boolean },
  ) => Promise<void>;
  // Undo calls the latest `apply` through a ref instead of the callback referring to itself.
  const applyRef = useRef<Apply | null>(null);

  const apply = useCallback(
    async (
      listId: string,
      action: 'add' | 'remove',
      options: { undoable: boolean } = { undoable: true },
    ) => {
      if (!instrumentId || !symbol) return;
      const snapshot = queryClient.getQueryData<Watchlist[]>(qk.watchlists);
      const list = snapshot?.find((candidate) => candidate.id === listId);
      if (!list) return;
      setPendingList(listId);
      patchCache(listId, (current) =>
        action === 'add'
          ? {
              ...current,
              members: [
                ...current.members,
                {
                  instrumentId,
                  symbol,
                  position: current.members.length,
                  addedAt: new Date().toISOString(),
                },
              ],
            }
          : {
              ...current,
              members: current.members.filter((member) => member.instrumentId !== instrumentId),
            },
      );
      try {
        const saved = await mutation.mutateAsync({ listId, action });
        queryClient.setQueryData<Watchlist[]>(qk.watchlists, (current) =>
          current?.map((item) => (item.id === saved.id ? saved : item)),
        );
        haptics.success();
        if (options.undoable) {
          toast({
            message:
              action === 'add'
                ? `Saved ${symbol} to ${list.name}`
                : `Removed ${symbol} from ${list.name}`,
            action: {
              label: 'Undo',
              onAction: () =>
                void applyRef.current?.(listId, action === 'add' ? 'remove' : 'add', {
                  undoable: false,
                }),
            },
          });
        }
      } catch (error) {
        queryClient.setQueryData(qk.watchlists, snapshot);
        haptics.error();
        toast({
          message: `${errorMessage(error)} ${symbol} ${action === 'add' ? 'was not saved' : 'is still saved'}.`,
          tone: 'error',
        });
      } finally {
        setPendingList(null);
        void queryClient.invalidateQueries({ queryKey: qk.watchlists });
      }
    },
    [instrumentId, symbol, mutation, patchCache, queryClient, toast],
  );
  useLayoutEffect(() => {
    applyRef.current = apply;
  }, [apply]);

  const ensureAllowed = useCallback((): boolean => {
    if (!signedIn) {
      setIntent({ kind: 'auth' });
      return false;
    }
    if (!verified) {
      setIntent({ kind: 'verify' });
      return false;
    }
    return true;
  }, [signedIn, verified]);

  /** Quick save to the default list, creating "My first list" if there is none. */
  const quickSave = useCallback(async () => {
    if (!ensureAllowed()) return;
    let target = defaultList;
    if (!target) {
      try {
        target = await api.watchlists.create('My first list', newIdempotencyKey());
        queryClient.setQueryData<Watchlist[]>(qk.watchlists, (current) => [
          ...(current ?? []),
          target!,
        ]);
      } catch (error) {
        toast({ message: errorMessage(error), tone: 'error' });
        return;
      }
    }
    await apply(target.id, 'add');
  }, [apply, defaultList, ensureAllowed, queryClient, toast]);

  return {
    signedIn,
    lists: lists.data ?? [],
    listsLoading: lists.isPending && signedIn,
    memberOf,
    saved: memberOf.length > 0,
    defaultList,
    pendingList,
    quickSave,
    add: (listId: string) => (ensureAllowed() ? apply(listId, 'add') : undefined),
    remove: (listId: string) => (ensureAllowed() ? apply(listId, 'remove') : undefined),
    ensureAllowed,
    intent,
    clearIntent: () => setIntent(null),
  };
}

/** Explains why an action needs an account and offers the next step without losing context. */
export function AccountPrompt({
  intent,
  onClose,
  what,
}: {
  intent: Intent;
  onClose: () => void;
  what: ReactNode;
}) {
  const location = useLocation();
  const { push } = useAppNavigation();
  const returnTo = encodeURIComponent(`${location.pathname}${location.search}`);
  return (
    <Sheet
      open={intent != null}
      onClose={onClose}
      title={intent?.kind === 'verify' ? 'Verify your email first.' : 'Save it to your account.'}
      size="auto"
      footer={
        intent?.kind === 'verify' ? (
          <Button
            full
            onClick={() => {
              onClose();
              push(`/auth/verify?returnTo=${returnTo}`);
            }}
          >
            Verify email
          </Button>
        ) : (
          <>
            <Button
              full
              onClick={() => {
                onClose();
                push(`/auth/sign-in?returnTo=${returnTo}`);
              }}
            >
              Sign in
            </Button>
            <Button
              full
              variant="quiet"
              onClick={() => {
                onClose();
                push(`/auth/register?returnTo=${returnTo}`);
              }}
            >
              Create an account
            </Button>
          </>
        )
      }
    >
      <p className="t-body">
        {intent?.kind === 'verify'
          ? 'Confirm your email address to save companies, research, alerts and paper positions. You will come straight back here.'
          : what}
      </p>
    </Sheet>
  );
}
