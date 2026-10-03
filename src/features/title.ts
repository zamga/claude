import { useEffect } from 'react';
import { usePane } from '@/app/pane';

/** Screen-specific document title; collection panes beside a detail leave the title alone. */
export function useDocumentTitle(title: string | null | undefined): void {
  const pane = usePane();
  useEffect(() => {
    if (!title || pane.role === 'collection') return;
    document.title = `${title} · Stock Picks`;
  }, [title, pane.role]);
}
