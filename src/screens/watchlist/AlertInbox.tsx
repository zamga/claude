import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRef } from 'react';
import { useSearchParams } from 'react-router';
import { useAppNavigation } from '@/app/navigation';
import { Button } from '@/components/Button';
import { Eyebrow, LargeTitle, TopBar, TopBarLabel } from '@/components/Header';
import { IconButton } from '@/components/IconButton';
import {
  Bell,
  Calendar,
  CheckCheck,
  FileText,
  ICON_STROKE,
  ListChecks,
  Newspaper,
  Settings,
  Sparkles,
  TrendingUp,
  type LucideIcon,
} from '@/components/icons';
import { Content, Disclaimer, ScreenBody } from '@/components/Layout';
import { List, Row } from '@/components/List';
import { DemoTag, EmptyState } from '@/components/Status';
import { UnderlineTabs } from '@/components/Tabs';
import { useToast } from '@/components/Toast';
import { formatClock, relativeDayLabel, zoneLabel } from '@/domain/format';
import { sameLocalDay } from '@/domain/time';
import { api } from '@/data/api';
import { errorMessage } from '@/data/errors';
import { useInbox } from '@/data/queries';
import type { InboxItem } from '@/data/types';
import { DELIVERY_LABEL, inboxTargetPath } from '@/features/notifications';
import { QueryState, useOffline } from '@/features/status';
import { useDemoNow, useUserTimeZone } from '@/features/time';
import { useDocumentTitle } from '@/features/title';
import styles from './AlertInbox.module.css';

type Category = 'all' | 'prices' | 'earnings';

const ICONS: Record<InboxItem['category'], LucideIcon> = {
  price: TrendingUp,
  earnings: Calendar,
  research: FileText,
  ipo: Sparkles,
  briefing: Newspaper,
};

const KIND: Record<InboxItem['category'], string> = {
  price: 'Price alert',
  earnings: 'Earnings reminder',
  research: 'Research update',
  ipo: 'IPO update',
  briefing: 'Daily briefing',
};

function InboxRow({ item, onOpen }: { item: InboxItem; onOpen: (item: InboxItem) => void }) {
  const zone = useUserTimeZone();
  const now = useDemoNow();
  const occurred = Date.parse(item.occurredAt);
  const delivered = item.deliveredAt ? Date.parse(item.deliveredAt) : null;
  const delayed = delivered != null && delivered - occurred > 60_000;
  const Icon = ICONS[item.category];
  const unread = item.readAt == null;
  const at = (instant: number) =>
    `${sameLocalDay(instant, now, zone) ? '' : `${relativeDayLabel(instant, now, zone)} `}${formatClock(instant, zone)} ${zoneLabel(instant, zone)}`;
  const generated = at(occurred);
  const issues = item.deliveries.filter(
    (delivery) =>
      delivery.channel !== 'inbox' &&
      delivery.status !== 'accepted' &&
      delivery.status !== 'shown_on_device',
  );
  return (
    <Row
      onPress={() => onOpen(item)}
      linkLabel={`${unread ? 'Unread. ' : ''}${item.title}. ${item.body} ${KIND[item.category]}, ${generated}.`}
      align="start"
      leading={
        <span className={styles.lead}>
          <span className={styles.dot} data-unread={unread} aria-hidden />
          <Icon size={20} strokeWidth={ICON_STROKE} aria-hidden />
        </span>
      }
    >
      <span className={styles.title} data-unread={unread}>
        {item.title}
      </span>
      <span className={styles.body}>{item.body}</span>
      <span className={styles.meta}>
        {delayed && delivered != null
          ? `Generated ${generated} · delivered ${at(delivered)}${item.deferredByQuietHours ? ' after quiet hours' : ''}`
          : generated}
        {' · '}
        {item.demo
          ? `Sample ${KIND[item.category].replace(/^[A-Z][a-z]/, (letters) => letters.toLowerCase())}`
          : KIND[item.category]}
      </span>
      {issues.length > 0 && (
        <span className={styles.delivery}>
          {issues
            .map(
              (delivery) =>
                `${delivery.channel === 'push' ? 'Push' : 'Email'}: ${DELIVERY_LABEL[delivery.status].toLowerCase()}`,
            )
            .join(' · ')}
        </span>
      )}
    </Row>
  );
}

export default function AlertInboxScreen() {
  const [params, setParams] = useSearchParams();
  const category = (params.get('category') as Category | null) ?? 'all';
  const inbox = useInbox(category);
  const all = useInbox('all');
  const queryClient = useQueryClient();
  const toast = useToast();
  const offline = useOffline();
  const zone = useUserTimeZone();
  const now = useDemoNow();
  const { push } = useAppNavigation();
  const sentinel = useRef<HTMLDivElement>(null);
  useDocumentTitle('Your alerts');

  const unread = (all.data ?? []).filter((item) => !item.readAt).length;

  const setRead = (ids: string[] | 'all') => {
    const at = new Date().toISOString();
    for (const key of ['all', 'prices', 'earnings', 'research'] as const) {
      queryClient.setQueryData<InboxItem[]>(['private', 'inbox', key], (current) =>
        current?.map((item) =>
          ids === 'all' || ids.includes(item.id) ? { ...item, readAt: item.readAt ?? at } : item,
        ),
      );
    }
  };

  const markAll = useMutation({
    mutationFn: () => api.notifications.markRead('all'),
    onMutate: () => setRead('all'),
    onError: (error) =>
      toast({ message: `${errorMessage(error)} Items stay unread.`, tone: 'error' }),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['private', 'inbox'] }),
  });

  const open = (item: InboxItem) => {
    // Opening reads the item only; the rule behind it never changes (spec page 34).
    if (!item.readAt) {
      setRead([item.id]);
      void api.notifications
        .markRead([item.id])
        .catch(() => undefined)
        .finally(() => queryClient.invalidateQueries({ queryKey: ['private', 'inbox'] }));
    }
    push(inboxTargetPath(item));
  };

  return (
    <ScreenBody tabBar>
      <TopBar
        back="/watchlist"
        leading={<TopBarLabel>Updates</TopBarLabel>}
        compactTitle="Your alerts"
        sentinel={sentinel}
        trailing={
          <>
            <IconButton icon={ListChecks} label="Alert rules" onClick={() => push('/alerts')} />
            <IconButton
              icon={Settings}
              label="Alert settings"
              onClick={() => push('/settings/notifications')}
            />
          </>
        }
      />
      <Content>
        <LargeTitle title="Your alerts." meta={<DemoTag />} sentinelRef={sentinel} />
        <UnderlineTabs
          label="Alert type"
          size="lg"
          value={category}
          controls="inbox-list"
          onChange={(value) =>
            setParams(value === 'all' ? {} : { category: value }, { replace: true })
          }
          items={[
            { value: 'all', label: 'All' },
            { value: 'prices', label: 'Prices' },
            { value: 'earnings', label: 'Earnings' },
          ]}
        />
        <div
          id="inbox-list"
          role="tabpanel"
          aria-label={`${category === 'all' ? 'All' : category === 'prices' ? 'Price' : 'Earnings'} alerts`}
        >
          <QueryState query={inbox} errorTitle="Your alerts could not be loaded.">
            {(items) => {
              if (items.length === 0) {
                return (
                  <EmptyState
                    icon={Bell}
                    size="section"
                    title={
                      category === 'all'
                        ? 'No alerts yet.'
                        : category === 'prices'
                          ? 'No price alerts.'
                          : 'No earnings reminders.'
                    }
                    actions={
                      <Button
                        full
                        variant="secondary"
                        onClick={() =>
                          push(`/alerts/new${category === 'earnings' ? '?type=earnings' : ''}`)
                        }
                      >
                        Create an alert
                      </Button>
                    }
                  >
                    Alerts you create appear here with the time they were generated and how they
                    were delivered.
                  </EmptyState>
                );
              }
              const groups: { label: string; items: InboxItem[] }[] = [];
              for (const item of items) {
                const at = Date.parse(item.occurredAt);
                const label = sameLocalDay(at, now, zone) ? 'Today' : 'Earlier';
                const group = groups.find((candidate) => candidate.label === label);
                if (group) group.items.push(item);
                else groups.push({ label, items: [item] });
              }
              return groups.map((group) => (
                <section key={group.label} aria-label={group.label} className={styles.group}>
                  <Eyebrow tone="muted" as="div" className={styles.groupLabel}>
                    {group.label}
                  </Eyebrow>
                  <List label={group.label}>
                    {group.items.map((item) => (
                      <InboxRow key={item.id} item={item} onOpen={open} />
                    ))}
                  </List>
                </section>
              ));
            }}
          </QueryState>
        </div>
        <List label="Inbox actions">
          <Row
            icon={CheckCheck}
            title="Mark all as read"
            detail={unread === 0 ? 'Everything is read' : `${unread} unread`}
            onPress={unread === 0 || offline ? undefined : () => markAll.mutate()}
            chevron={unread > 0 && !offline}
          />
        </List>
        <Disclaimer>
          Times show when an alert was generated in your time zone ({zone}). If quiet hours or a
          connection delayed delivery, both times are shown. Sample alerts from a simulated session.
        </Disclaimer>
      </Content>
    </ScreenBody>
  );
}
