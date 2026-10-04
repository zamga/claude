import { DEMO_SESSION_DATE } from '@/data/demo/clock';
import { DATA_MODE } from '@/data/transport';
import { useInbox } from '@/data/queries';
import { ICON_STROKE } from '@/components/icons';
import { useAppNavigation } from './navigation';
import { TAB_LABELS, type TabId } from './routeTable';
import { useSession } from './session';
import styles from './Shell.module.css';
import { TAB_ICONS, useTabHrefs } from './TabBar';

const ORDER: TabId[] = ['picks', 'watchlist', 'research', 'profile'];

/** 240 px navigation rail for wide screens (spec page 30). */
export function NavRail({ current }: { current: TabId }) {
  const { switchTab } = useAppNavigation();
  const { signedIn, me } = useSession();
  const inbox = useInbox('all', signedIn);
  const unread = (inbox.data ?? []).filter((item) => !item.readAt).length;
  const hrefs = useTabHrefs();
  return (
    <nav className={styles.rail} aria-label="Primary" data-surface="paper">
      <a
        href={hrefs.picks}
        className={styles.brand}
        onClick={(event) => {
          if (event.metaKey || event.ctrlKey || event.button !== 0) return;
          event.preventDefault();
          switchTab('picks');
        }}
      >
        Stock picks.
      </a>
      <ul className={styles.railList}>
        {ORDER.map((tab) => {
          const Icon = TAB_ICONS[tab];
          const selected = tab === current;
          return (
            <li key={tab}>
              <a
                href={hrefs[tab]}
                className={styles.railItem}
                aria-current={selected ? 'page' : undefined}
                onClick={(event) => {
                  if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0)
                    return;
                  event.preventDefault();
                  switchTab(tab);
                }}
              >
                <Icon size={20} strokeWidth={ICON_STROKE} aria-hidden />
                <span>{TAB_LABELS[tab]}</span>
                {tab === 'watchlist' && unread > 0 && (
                  <span className={styles.railCount}>
                    {unread}
                    <span className="visually-hidden"> unread alerts</span>
                  </span>
                )}
              </a>
            </li>
          );
        })}
      </ul>
      <div className={styles.railFoot}>
        {signedIn && me ? <p className={styles.railUser}>{me.displayName}</p> : null}
        {DATA_MODE === 'demo' && (
          <p className={styles.railNote}>
            Demo build · simulated session {DEMO_SESSION_DATE.split('-').reverse().join('.')} ·
            illustrative data, not advice.
          </p>
        )}
      </div>
    </nav>
  );
}
