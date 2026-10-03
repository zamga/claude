import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useSession } from '@/app/session';
import { useToast } from '@/components/Toast';
import { api } from '@/data/api';
import { errorMessage } from '@/data/errors';
import { qk, useSavedReports } from '@/data/queries';
import type { EvidenceKind, SavedReport } from '@/data/types';
import { haptics } from '@/lib/haptics';

export const EVIDENCE_LABEL: Record<EvidenceKind, string> = {
  reported: 'Reported fact',
  estimate: 'Estimate',
  management: 'Management statement',
  assumption: 'Model assumption',
  interpretation: 'Analyst interpretation',
};

export const EVIDENCE_TONE: Record<EvidenceKind, 'positive' | 'neutral' | 'accent' | 'outline'> = {
  reported: 'positive',
  estimate: 'outline',
  management: 'neutral',
  assumption: 'accent',
  interpretation: 'neutral',
};

/**
 * Saving research keeps the exact version saved (spec page 36). Optimistic with an Undo toast;
 * failures restore the previous state.
 */
export function useSavedReport(
  reportId: string | undefined,
  version: number | undefined,
  title: string,
) {
  const { signedIn, verified } = useSession();
  const saved = useSavedReports(signedIn);
  const queryClient = useQueryClient();
  const toast = useToast();
  const [intent, setIntent] = useState<{ kind: 'auth' } | { kind: 'verify' } | null>(null);
  const record = saved.data?.find((item) => item.reportId === reportId) ?? null;

  const mutation = useMutation({
    mutationFn: async (action: { save: boolean; version: number }) =>
      action.save
        ? api.savedReports.save(reportId!, action.version)
        : api.savedReports.remove(reportId!),
  });

  const toggle = async (undoable = true) => {
    if (!reportId || version == null) return;
    if (!signedIn) return setIntent({ kind: 'auth' });
    if (!verified) return setIntent({ kind: 'verify' });
    const snapshot = queryClient.getQueryData<SavedReport[]>(qk.savedReports);
    const save = !record;
    queryClient.setQueryData<SavedReport[]>(qk.savedReports, (current) =>
      save
        ? [
            { reportId, version, savedAt: new Date().toISOString(), readingOffset: 0 },
            ...(current ?? []),
          ]
        : (current ?? []).filter((item) => item.reportId !== reportId),
    );
    try {
      await mutation.mutateAsync({ save, version });
      haptics.success();
      if (undoable) {
        toast({
          message: save
            ? `Saved “${title}” (version ${version}) to Research`
            : `Removed “${title}” from saved research`,
          action: { label: 'Undo', onAction: () => void toggleFrom(save, version) },
        });
      }
    } catch (error) {
      queryClient.setQueryData(qk.savedReports, snapshot);
      haptics.error();
      toast({ message: `${errorMessage(error)} Your saved research is unchanged.`, tone: 'error' });
    } finally {
      void queryClient.invalidateQueries({ queryKey: qk.savedReports });
    }
  };

  const toggleFrom = async (wasSave: boolean, savedVersion: number) => {
    try {
      if (wasSave) await api.savedReports.remove(reportId!);
      else await api.savedReports.save(reportId!, savedVersion);
    } finally {
      void queryClient.invalidateQueries({ queryKey: qk.savedReports });
    }
  };

  return {
    record,
    saved: record != null,
    pending: mutation.isPending,
    toggle: () => toggle(),
    intent,
    clearIntent: () => setIntent(null),
  };
}
