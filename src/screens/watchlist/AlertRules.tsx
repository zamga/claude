import { useRef } from 'react';
import { useAppNavigation } from '@/app/navigation';
import { usePane } from '@/app/pane';
import { Button } from '@/components/Button';
import { LargeTitle, SectionHeader, TopBar, TopBarLabel } from '@/components/Header';
import { IconButton } from '@/components/IconButton';
import { Bell, Plus } from '@/components/icons';
import { Content, Disclaimer, ScreenBody } from '@/components/Layout';
import { List, Row } from '@/components/List';
import { Tag, Ticker } from '@/components/Market';
import { DemoTag, EmptyState } from '@/components/Status';
import { formatDateTime, pluralize } from '@/domain/format';
import { useAlerts } from '@/data/queries';
import type { AlertRule } from '@/data/types';
import { CHANNEL_LABEL, describeRule, RULE_STATE_LABEL } from '@/features/notifications';
import { QueryState } from '@/features/status';
import { useUserTimeZone } from '@/features/time';
import { useDocumentTitle } from '@/features/title';
import styles from './AlertRules.module.css';

const GROUPS: { title: string; states: AlertRule['state'][] }[] = [
  { title: 'Active', states: ['armed'] },
  { title: 'Paused', states: ['paused'] },
  { title: 'Completed', states: ['fired', 'expired'] },
];

function RuleRow({ rule }: { rule: AlertRule }) {
  const zone = useUserTimeZone();
  const pane = usePane();
  const to = `/alerts/${rule.id}/edit`;
  const description = describeRule(rule).replace(`${rule.symbol} `, '');
  const channels = rule.channels.map((channel) => CHANNEL_LABEL[channel]).join(' · ');
  const detail =
    rule.state === 'fired' && rule.lastFiredAt
      ? `Fired ${formatDateTime(rule.lastFiredAt, zone)}`
      : rule.waitingForReset
        ? 'Waiting for a new crossing'
        : channels;
  return (
    <Row
      to={to}
      selected={pane.detailPath === to}
      linkLabel={`${describeRule(rule)}. ${RULE_STATE_LABEL[rule.state]}. ${detail}`}
      title={
        <span className={styles.title}>
          <Ticker symbol={rule.symbol} className={styles.ticker} />
          <span>{description.charAt(0).toUpperCase() + description.slice(1)}</span>
        </span>
      }
      detail={detail}
      aside={
        <Tag
          tone={
            rule.state === 'armed' ? 'positive' : rule.state === 'paused' ? 'warning' : 'neutral'
          }
        >
          {RULE_STATE_LABEL[rule.state]}
        </Tag>
      }
    />
  );
}

export default function AlertRulesScreen() {
  const alerts = useAlerts();
  const { push } = useAppNavigation();
  const sentinel = useRef<HTMLDivElement>(null);
  useDocumentTitle('Alert rules');
  return (
    <ScreenBody tabBar>
      <TopBar
        back="/watchlist"
        leading={<TopBarLabel>Alerts</TopBarLabel>}
        compactTitle="Alert rules"
        sentinel={sentinel}
        trailing={
          <IconButton icon={Plus} label="Create an alert" onClick={() => push('/alerts/new')} />
        }
      />
      <Content>
        <LargeTitle
          title="Alert rules."
          meta={<DemoTag />}
          sentinelRef={sentinel}
          subtitle="What you are watching for, and how it reaches you."
        />
        <QueryState query={alerts} errorTitle="Your alert rules could not be loaded.">
          {(rules) =>
            rules.length === 0 ? (
              <EmptyState
                icon={Bell}
                title="No alert rules yet."
                actions={
                  <Button full onClick={() => push('/alerts/new')}>
                    Create an alert
                  </Button>
                }
              >
                Set a price threshold, an earnings reminder or a research update for any company.
              </EmptyState>
            ) : (
              GROUPS.map((group) => {
                const items = rules.filter((rule) => group.states.includes(rule.state));
                if (items.length === 0) return null;
                return (
                  <section key={group.title} aria-label={`${group.title} alerts`}>
                    <SectionHeader
                      title={group.title}
                      size="small"
                      aside={
                        <span className={styles.count}>{pluralize(items.length, 'rule')}</span>
                      }
                    />
                    <List label={`${group.title} alerts`}>
                      {items.map((rule) => (
                        <RuleRow key={rule.id} rule={rule} />
                      ))}
                    </List>
                  </section>
                );
              })
            )
          }
        </QueryState>
        <Disclaimer>
          Price alerts evaluate committed quotes in order and fire at most once per crossing.
          Pausing stops evaluation without a backlog; deleting a rule keeps the alerts it already
          sent.
        </Disclaimer>
      </Content>
    </ScreenBody>
  );
}
