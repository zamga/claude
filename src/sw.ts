/// <reference lib="webworker" />
import {
  cleanupOutdatedCaches,
  createHandlerBoundToURL,
  precacheAndRoute,
} from 'workbox-precaching';
import { NavigationRoute, registerRoute } from 'workbox-routing';

/**
 * Service worker (spec page 57): precached app shell for offline starts, an explicit update step
 * (the old version keeps running until the page asks to switch), and notification routing that
 * opens the exact event behind a notification. Private API responses are never cached here.
 */
declare const self: ServiceWorkerGlobalScope;

precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();
registerRoute(
  new NavigationRoute(createHandlerBoundToURL('/index.html'), { denylist: [/^\/api\//] }),
);

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') void self.skipWaiting();
});

function safeUrl(value: unknown): string {
  return typeof value === 'string' && value.startsWith('/') && !value.startsWith('//')
    ? value
    : '/';
}

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = safeUrl((event.notification.data as { url?: unknown } | null)?.url);
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      for (const client of windows) {
        if ('focus' in client) {
          await client.focus();
          if ('navigate' in client) await client.navigate(url);
          return;
        }
      }
      await self.clients.openWindow(url);
    })(),
  );
});

// Server push (live builds): payload { title, body, url, tag }. Background delivery needs a server.
self.addEventListener('push', (event) => {
  let payload: { title?: string; body?: string; url?: string; tag?: string } = {};
  try {
    payload = event.data ? (event.data.json() as typeof payload) : {};
  } catch {
    payload = { title: 'Stock Picks', body: event.data?.text() ?? '' };
  }
  event.waitUntil(
    self.registration.showNotification(payload.title ?? 'Stock Picks', {
      body: payload.body ?? '',
      tag: payload.tag,
      data: { url: safeUrl(payload.url) },
    }),
  );
});
