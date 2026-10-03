import { forwardRef, type AnchorHTMLAttributes, type MouseEvent } from 'react';
import { Link } from 'react-router';
import { useAppNavigation } from '@/app/navigation';
import type { TabId } from '@/app/routeTable';
import { markAnchorSource } from '@/lib/viewTransition';

export interface AppLinkProps extends Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> {
  to: string;
  tab?: TabId;
  replace?: boolean;
  /** Name of a view-transition anchor to morph (e.g. the ticker), applied only to this link. */
  anchorFor?: string;
}

function isPlainClick(event: MouseEvent<HTMLAnchorElement>): boolean {
  return event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey;
}

/**
 * Real links (open in new tab, copy address) that use in-app navigation for plain clicks so
 * tab context, Back targets and detail transitions are preserved.
 */
export const AppLink = forwardRef<HTMLAnchorElement, AppLinkProps>(function AppLink(
  { to, tab, replace, anchorFor, onClick, children, ...rest },
  ref,
) {
  const { push } = useAppNavigation();
  return (
    <Link
      ref={ref}
      to={to}
      onClick={(event) => {
        onClick?.(event);
        if (event.defaultPrevented || !isPlainClick(event) || rest.target === '_blank') return;
        event.preventDefault();
        if (anchorFor) {
          const link = event.currentTarget;
          const scope = link.closest<HTMLElement>('[data-anchor-scope], li, article') ?? link;
          markAnchorSource(
            link.querySelector<HTMLElement>(`[data-anchor="${anchorFor}"]`) ??
              scope.querySelector<HTMLElement>(`[data-anchor="${anchorFor}"]`),
          );
        }
        push(to, { tab, replace });
      }}
      {...rest}
    >
      {children}
    </Link>
  );
});
