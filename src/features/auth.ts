import { useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { useAppNavigation } from '@/app/navigation';
import { safeReturnTo } from '@/app/routeTable';
import { api } from '@/data/api';
import { qk } from '@/data/queries';
import type { Me } from '@/data/types';
import { readJson, writeJson } from '@/lib/storage';

const RETURN_KEY = 'stockpicks.auth.returnTo.v1';

/**
 * The destination to resume after a flow that leaves the app (an email link). Kept for this
 * browser session only, and always re-checked against the allowlist.
 */
export function rememberReturnTo(value: string | null): void {
  writeJson('session', RETURN_KEY, value ? safeReturnTo(value) : null);
}

export function pendingReturnTo(): string | null {
  return readJson<string>('session', RETURN_KEY);
}

/** After authentication: store the account, drop any other account's private cache, resume. */
export function useCompleteSignIn() {
  const queryClient = useQueryClient();
  const { push } = useAppNavigation();
  return useCallback(
    async (me: Me, returnTo: string | null) => {
      queryClient.setQueryData(qk.me, me);
      // Another account's private data is reset in place; mounted screens refetch as this account.
      void queryClient.resetQueries({ queryKey: ['private'] });
      const target = safeReturnTo(returnTo);
      let onboarded = true;
      try {
        const preferences = await api.me.preferences();
        queryClient.setQueryData(qk.preferences, preferences);
        onboarded = preferences.research.completedAt != null;
      } catch {
        // Preferences can be completed later from Profile.
      }
      if (!me.verified)
        push(`/auth/verify?returnTo=${encodeURIComponent(target)}`, { replace: true });
      else if (!onboarded)
        push(`/onboarding?returnTo=${encodeURIComponent(target)}`, { replace: true });
      else push(target, { replace: true });
    },
    [push, queryClient],
  );
}

/** Auth providers are exposed only when their real callback flows are configured (spec page 55). */
export function configuredProviders(): ('google' | 'apple')[] {
  const raw = (import.meta.env.VITE_AUTH_PROVIDERS as string | undefined) ?? '';
  return raw
    .split(',')
    .map((value) => value.trim().toLowerCase())
    .filter((value): value is 'google' | 'apple' => value === 'google' || value === 'apple');
}
