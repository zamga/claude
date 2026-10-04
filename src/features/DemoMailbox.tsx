import { useAppNavigation } from '@/app/navigation';
import { Button } from '@/components/Button';
import { Mail } from '@/components/icons';
import { formatClockWithZone } from '@/domain/format';
import { useMailbox } from '@/data/queries';
import { DATA_MODE } from '@/data/transport';
import { deviceTimeZone } from './time';
import styles from './DemoMailbox.module.css';

/**
 * The demo build sends no real email. Messages the service would send are shown here so
 * verification and reset links can be followed; a live build delivers them by email instead.
 */
export function DemoMailbox({
  to,
  kinds,
}: {
  to?: string | null;
  kinds?: ('verify' | 'reset' | 'alert')[];
}) {
  const mailbox = useMailbox();
  const { push } = useAppNavigation();
  if (DATA_MODE !== 'demo') return null;
  const messages = (mailbox.data ?? [])
    .filter((message) => !to || message.to.toLowerCase() === to.toLowerCase())
    .filter((message) => {
      if (!kinds) return true;
      const path = message.action?.path ?? '';
      return (
        (kinds.includes('verify') && path.startsWith('/auth/verify')) ||
        (kinds.includes('reset') && path.startsWith('/auth/reset')) ||
        (kinds.includes('alert') && path.startsWith('/watchlist'))
      );
    })
    .slice(0, 3);
  return (
    <section className={styles.box} aria-labelledby="demo-mailbox">
      <h2 className={styles.title} id="demo-mailbox">
        <Mail size={16} aria-hidden /> Demo mailbox
      </h2>
      <p className={styles.note}>
        No real email is sent in this demo. Messages the service would send appear here.
      </p>
      {messages.length === 0 ? (
        <p className={styles.empty}>No messages yet.</p>
      ) : (
        <ul className={styles.list}>
          {messages.map((message) => (
            <li key={message.id} className={styles.message}>
              <span className={styles.subject}>{message.subject}</span>
              <span className={styles.meta}>
                To {message.to} ·{' '}
                {formatClockWithZone(Date.parse(message.sentAt), deviceTimeZone())}
              </span>
              <span className={styles.text}>{message.body}</span>
              {message.action && (
                <Button size="small" variant="secondary" onClick={() => push(message.action!.path)}>
                  {message.action.label}
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
