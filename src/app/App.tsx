import { QueryClientProvider } from '@tanstack/react-query';
import { StrictMode, useEffect } from 'react';
import { createBrowserRouter, createHashRouter } from 'react-router';
import { RouterProvider } from 'react-router/dom';
import { ToastProvider } from '@/components/Toast';
import {
  queryClient,
  restorePublicCache,
  startCachePersistence,
  syncOnlineManager,
} from '@/data/queryClient';
import { useNotificationOpen } from '@/features/notifications';
import { AnnouncerProvider } from '@/lib/announcer';
import { DemoBridge } from './DemoBridge';
import { DisplayProvider } from './display';
import { preloadCoreScreens } from './routes';
import { Shell } from './Shell';

restorePublicCache();

function Background() {
  useNotificationOpen();
  useEffect(() => {
    const stopOnline = syncOnlineManager();
    const stopPersist = startCachePersistence();
    const hasIdle = typeof window.requestIdleCallback === 'function';
    const handle = hasIdle
      ? window.requestIdleCallback(preloadCoreScreens)
      : window.setTimeout(preloadCoreScreens, 600);
    return () => {
      stopOnline();
      stopPersist();
      if (hasIdle) window.cancelIdleCallback(handle);
      else window.clearTimeout(handle);
    };
  }, []);
  return null;
}

/**
 * One data router with a catch-all route: the shell renders the visible panes itself (so a
 * collection and a detail can show side by side), while the data router provides navigation
 * blocking for unsaved drafts. The static preview build (`npm run build:preview`) routes on the
 * URL hash, so it runs from any folder or embedded page without server rewrites.
 */
const createRouter =
  import.meta.env.VITE_ROUTER === 'hash' ? createHashRouter : createBrowserRouter;

const router = createRouter([
  {
    path: '*',
    element: (
      <>
        <Background />
        <DemoBridge />
        <Shell />
      </>
    ),
  },
]);

export function App() {
  return (
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <AnnouncerProvider>
          <DisplayProvider>
            <ToastProvider>
              <RouterProvider router={router} />
            </ToastProvider>
          </DisplayProvider>
        </AnnouncerProvider>
      </QueryClientProvider>
    </StrictMode>
  );
}
