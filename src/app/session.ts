import { useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { api } from '@/data/api';
import { clearPrivateClientState } from '@/data/queryClient';
import { qk, useMe } from '@/data/queries';

/** Current account state. `me` is null when signed out (not an error). */
export function useSession() {
  const query = useMe();
  const me = query.data ?? null;
  return {
    me,
    signedIn: me != null,
    verified: me?.verified ?? false,
    loading: query.isPending,
    query,
  };
}

/** Sign-out clears the local authenticated view, private caches and drafts (spec page 26). */
export function useSignOut() {
  const queryClient = useQueryClient();
  return useCallback(async () => {
    const accountId =
      (queryClient.getQueryData(qk.me) as { id: string } | null | undefined)?.id ?? null;
    await api.me.signOut();
    clearPrivateClientState(accountId);
  }, [queryClient]);
}
