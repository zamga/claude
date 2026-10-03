import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useCallback, useState } from 'react';
import { useSession } from '@/app/session';
import { useToast } from '@/components/Toast';
import { api } from '@/data/api';
import { errorMessage, isApiError } from '@/data/errors';
import { qk, usePreferences } from '@/data/queries';
import type { Preferences } from '@/data/types';
import { haptics } from '@/lib/haptics';

export type PreferencesPatch = Partial<Omit<Preferences, 'version' | 'updatedAt'>>;

/**
 * A complete preference draft that is saved in one request (spec page 34). Version conflicts
 * from another device are shown with both choices; nothing is overwritten silently.
 */
export function usePreferencesForm<D>(
  toDraft: (preferences: Preferences) => D,
  toPatch: (draft: D) => PreferencesPatch,
  savedMessage: string,
) {
  const { signedIn } = useSession();
  const preferences = usePreferences(signedIn);
  const queryClient = useQueryClient();
  const toast = useToast();
  const [draft, setDraftState] = useState<D | null>(null);
  const [conflict, setConflict] = useState<Preferences | null>(null);
  const [error, setError] = useState<string | null>(null);
  const base = preferences.data ? toDraft(preferences.data) : null;
  const value = draft ?? base;
  const dirty = draft != null && base != null && JSON.stringify(draft) !== JSON.stringify(base);

  const mutation = useMutation({
    mutationFn: ({ patch, version }: { patch: PreferencesPatch; version: number }) =>
      api.me.updatePreferences(patch, version),
  });

  const setDraft = useCallback(
    (patch: Partial<D>) => setDraftState((current) => ({ ...((current ?? base) as D), ...patch })),
    [base],
  );

  const save = useCallback(
    async (version?: number) => {
      if (!value || !preferences.data) return false;
      setError(null);
      try {
        const saved = await mutation.mutateAsync({
          patch: toPatch(value),
          version: version ?? conflict?.version ?? preferences.data.version,
        });
        queryClient.setQueryData(qk.preferences, saved);
        setDraftState(null);
        setConflict(null);
        haptics.success();
        toast({ message: savedMessage });
        return true;
      } catch (failure) {
        haptics.error();
        if (isApiError(failure) && failure.code === 'version_conflict') {
          setConflict((failure.details.latest as Preferences | undefined) ?? null);
        } else {
          setError(errorMessage(failure));
        }
        return false;
      }
    },
    [value, preferences.data, mutation, toPatch, conflict, queryClient, toast, savedMessage],
  );

  const takeLatest = useCallback(() => {
    if (conflict) queryClient.setQueryData(qk.preferences, conflict);
    setDraftState(null);
    setConflict(null);
  }, [conflict, queryClient]);

  return {
    preferences,
    value,
    setDraft,
    reset: () => setDraftState(null),
    dirty,
    save,
    saving: mutation.isPending,
    conflict,
    keepMine: () => void save(conflict?.version),
    takeLatest,
    error,
  };
}

/** Documented defaults accepted by "Skip for now" (spec page 30). */
export const DEFAULT_RESEARCH: Pick<Preferences['research'], 'interests' | 'horizon' | 'markets'> =
  {
    interests: ['earnings', 'ipo', 'quality'],
    horizon: 'weeks',
    markets: ['US', 'EU'],
  };

export const INTEREST_OPTIONS = [
  {
    value: 'earnings',
    label: 'Earnings momentum',
    detail: 'Companies whose results and guidance are changing expectations.',
  },
  {
    value: 'ipo',
    label: 'New listings',
    detail: 'Upcoming IPOs and companies in their first months of trading.',
  },
  {
    value: 'quality',
    label: 'Long-term quality',
    detail: 'Durable businesses with strong balance sheets and cash conversion.',
  },
] as const;

export const MARKET_OPTIONS = [
  { value: 'US', label: 'United States', detail: 'NYSE and Nasdaq listings, quoted in USD.' },
  { value: 'EU', label: 'Europe', detail: 'Major European exchanges, quoted in EUR.' },
] as const;

export const TIME_ZONES = [
  'Europe/Ljubljana',
  'Europe/London',
  'Europe/Paris',
  'Europe/Berlin',
  'Europe/Amsterdam',
  'America/New_York',
  'America/Chicago',
  'America/Los_Angeles',
  'Asia/Tokyo',
  'Asia/Singapore',
  'Australia/Sydney',
  'UTC',
];

export function timeZoneOptions(
  current: string,
  device: string,
): { value: string; label: string }[] {
  const zones = [...new Set([current, device, ...TIME_ZONES])];
  return zones.map((zone) => ({
    value: zone,
    label: `${zone.replace(/_/g, ' ')}${zone === device ? ' (this device)' : ''}`,
  }));
}
