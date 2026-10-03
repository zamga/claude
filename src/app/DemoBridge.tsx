import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { api, loadDemoServer, loadedDemoServer } from '@/data/api';
import { DB_KEY, SESSION_KEY } from '@/data/demo/db';
import {
  clearPrivateClientState,
  configurePrivatePersistence,
  restorePrivateCache,
} from '@/data/queryClient';
import { qk, usePreferences } from '@/data/queries';
import { DATA_MODE } from '@/data/transport';
import { inboxTargetPath } from '@/features/notifications';
import { useSession } from './session';

/**
 * Glue between the in-browser demo service and the client cache:
 * - another tab writing the demo database behaves like a second device (refetch everything);
 * - demo push deliveries are shown through the service worker when this device allowed them.
 */
export function DemoBridge() {
  const queryClient = useQueryClient();
  const { me, signedIn } = useSession();
  const preferences = usePreferences(signedIn);

  useEffect(() => {
    if (DATA_MODE !== 'demo') return;
    const onStorage = (event: StorageEvent) => {
      if (event.key === DB_KEY) {
        loadedDemoServer()?.reload();
        void queryClient.invalidateQueries();
      }
      if (event.key === SESSION_KEY) {
        // Another tab signed in or out: follow it, and never show one account's data to another.
        const before = (queryClient.getQueryData(qk.me) as { id: string } | null | undefined)?.id;
        void queryClient
          .fetchQuery({
            queryKey: qk.me,
            queryFn: ({ signal }) => api.me.get(signal),
            staleTime: 0,
          })
          .then((me) => {
            if (!me) clearPrivateClientState(before ?? null);
            else if (me.id !== before) void queryClient.resetQueries({ queryKey: ['private'] });
          })
          .catch(() => undefined);
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [queryClient]);

  // Private offline copy only with the explicit device setting, partitioned by account.
  const keepOffline = preferences.data?.display.keepPrivateOffline ?? false;
  useEffect(() => {
    configurePrivatePersistence(me?.id ?? null, keepOffline);
    if (me?.id && keepOffline) restorePrivateCache(me.id);
  }, [me?.id, keepOffline]);

  // Demo push channel: show queued deliveries as device notifications.
  useEffect(() => {
    if (DATA_MODE !== 'demo' || !signedIn) return;
    const deliver = async () => {
      if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
      const items = (await loadDemoServer()).takeQueuedPush();
      if (items.length === 0) return;
      const registration = await navigator.serviceWorker?.getRegistration();
      for (const item of items) {
        const url = inboxTargetPath(item);
        const options = {
          body: `${item.body} (Demo)`,
          tag: item.eventKey,
          data: { url: `${url}${url.includes('?') ? '&' : '?'}from=notification&item=${item.id}` },
        };
        if (registration) await registration.showNotification(item.title, options);
        else new Notification(item.title, options);
      }
      void queryClient.invalidateQueries({ queryKey: ['private', 'inbox'] });
    };
    const timer = setInterval(() => void deliver(), 4000);
    void deliver();
    return () => clearInterval(timer);
  }, [signedIn, queryClient]);

  return null;
}
