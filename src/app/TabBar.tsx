import { useInbox } from '@/data/queries';
import { FileText, ICON_STROKE, Star, TrendingUp, User, type LucideIcon } from '@/components/icons';
import { useAppNavigation } from './navigation';
import { TAB_LABELS, TAB_ROOTS, type TabId } from './routeTable';
import { useSession } from './session';
import styles from './Shell.module.css';

export const TAB_ICONS: Record<TabId, LucideIcon> = {
  picks: TrendingUp,
  watchlist: Star,
  research: FileText,
  profile: User,
};

const ORDER: TabId[] = ['picks', 'watchlist', 'research', 'profile'];

/** Four equal-width targets; exactly one is current (spec pages 3, 19, 30). */
export function TabBar({ current }: { current: TabId }) {
  const { switchTab } = useAppNavigation();
  const { signedIn } = useSession();
  const inbox = useInbox('all', signedIn);
  const unread = (inbox.data ?? []).some((item) => !item.readAt);
  return (
    <nav className={styles.tabBar} aria-label="Primary">
      {ORDER.map((tab) => {
        const Icon = TAB_ICONS[tab];
        const selected = tab === current;
        return (
          <a
            key={tab}
            href={TAB_ROOTS[tab]}
            className={styles.tab}
            aria-current={selected ? 'page' : undefined}
            onClick={(event) => {
              if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return;
              event.preventDefault();
              switchTab(tab);
            }}
          >
            <span className={styles.tabIcon}>
              <Icon
                size={22}
                strokeWidth={ICON_STROKE}
                aria-hidden
                fill={selected && tab === 'watchlist' ? 'currentColor' : 'none'}
              />
              {tab === 'watchlist' && unread && <span className={styles.tabDot} aria-hidden />}
            </span>
            <span className={styles.tabLabel}>
              {TAB_LABELS[tab]}
              {tab === 'watchlist' && unread && (
                <span className="visually-hidden">, unread alerts</span>
              )}
            </span>
          </a>
        );
      })}
    </nav>
  );
}
