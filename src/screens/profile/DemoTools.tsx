import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useState, useSyncExternalStore } from 'react';
import { Button } from '@/components/Button';
import { LargeTitle, SectionHeader, TopBar } from '@/components/Header';
import { Clock, LayoutTemplate, RefreshCw, Trash2, Wifi, WifiOff } from '@/components/icons';
import { Content, Disclaimer, ScreenBody } from '@/components/Layout';
import { KeyValue, KeyValueList, List, Row } from '@/components/List';
import { useConfirm } from '@/components/Sheet';
import { Notice } from '@/components/Status';
import { SwitchRow } from '@/components/Form';
import { Segmented } from '@/components/Tabs';
import { useToast } from '@/components/Toast';
import { formatClockWithZone, formatDuration } from '@/domain/format';
import { loadDemoServer, loadedDemoServer } from '@/data/api';
import type { FeedMode } from '@/data/demo/market';
import type { DemoServer, DemoState } from '@/data/demo/server';
import { clearPrivateClientState } from '@/data/queryClient';
import {
  DATA_MODE,
  getConditions,
  setConditions,
  subscribeConditions,
  type NetworkConditions,
} from '@/data/transport';
import { DemoMailbox } from '@/features/DemoMailbox';
import { notifyDemoClock, useDemoNow } from '@/features/time';
import { useDocumentTitle } from '@/features/title';
import shared from '../shared.module.css';

const FEEDS: { value: FeedMode; label: string; detail: string }[] = [
  { value: 'normal', label: 'Normal', detail: 'Demo quotes update with the clock.' },
  { value: 'delayed', label: 'Delayed', detail: 'Quotes run 15 minutes behind and say so.' },
  {
    value: 'interrupted',
    label: 'Interrupted',
    detail: 'Updates stop; quotes show when they were last received.',
  },
];

/**
 * Controls for the simulated world (demo build only): advance the market clock, degrade the
 * feed, and inject offline, slow and failed requests to see each recovery path.
 */
export default function DemoToolsScreen() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const now = useDemoNow();
  const { confirm, element } = useConfirm();
  const conditions = useSyncExternalStore(subscribeConditions, getConditions, getConditions);
  const [service, setService] = useState<DemoServer | null>(() => loadedDemoServer());
  const [state, setState] = useState<DemoState | null>(
    () => loadedDemoServer()?.demoState() ?? null,
  );
  useEffect(() => {
    if (service) return;
    void loadDemoServer().then((loaded) => {
      setService(loaded);
      setState(loaded.demoState());
    });
  }, [service]);
  useDocumentTitle('Demo tools');

  if (DATA_MODE !== 'demo') {
    return (
      <ScreenBody>
        <TopBar title="Demo tools" ruled />
        <Content>
          <Notice tone="neutral" title="Demo tools are only available in the demo build." />
        </Content>
      </ScreenBody>
    );
  }

  const refresh = () => {
    notifyDemoClock();
    void queryClient.invalidateQueries();
  };

  const advance = (steps: number) => {
    if (!service) return;
    const next = service.advanceClock(steps);
    setState(next);
    refresh();
    toast({ message: `Market clock ${formatClockWithZone(next.now, 'America/New_York')}` });
  };

  const setFeed = (mode: FeedMode) => {
    if (!service) return;
    setState(service.setFeed(mode));
    refresh();
  };

  const setNetwork = (patch: Partial<NetworkConditions>) => {
    setConditions(patch);
    if (patch.offline === false) void queryClient.refetchQueries({ type: 'active' });
  };

  const reset = async () => {
    const ok = await confirm({
      title: 'Reset the demo?',
      body: 'All demo accounts, lists, alerts, paper trades and messages in this browser return to the starting sample. You will be signed out.',
      confirmLabel: 'Reset demo data',
      destructive: true,
    });
    if (!ok) return;
    (service ?? (await loadDemoServer())).resetDemo();
    setConditions({ offline: false, slow: false, nextWrite: 'normal' });
    clearPrivateClientState(null);
    queryClient.clear();
    window.location.assign('/');
  };

  if (!state) {
    return (
      <ScreenBody>
        <TopBar title="Demo tools" ruled />
        <Content>
          <LargeTitle title="Bend the world." size="title" subtitle="Loading the demo service…" />
        </Content>
      </ScreenBody>
    );
  }

  const remaining = Math.max(0, state.maxOffsetMs - state.offsetMs);

  return (
    <ScreenBody>
      <TopBar title="Demo tools" ruled />
      <Content>
        <LargeTitle
          title="Bend the world."
          size="title"
          subtitle="Simulate time, data quality and network trouble to see every state honestly."
        />

        <section aria-labelledby="clock-heading">
          <SectionHeader title="Market clock" id="clock-heading" size="small" />
          <KeyValueList label="Market clock">
            <KeyValue label="Now" value={formatClockWithZone(now, 'America/New_York')} />
            <KeyValue
              label="US close"
              value={formatClockWithZone(state.usSessionCloses, 'America/New_York')}
            />
            <KeyValue
              label="Left in the demo day"
              value={remaining === 0 ? 'End of the demo session' : formatDuration(remaining / 1000)}
            />
          </KeyValueList>
          <div className={shared.inlineActions} style={{ padding: '0 var(--gutter)' }}>
            <Button
              size="small"
              variant="secondary"
              icon={Clock}
              iconPosition="start"
              disabledReason={remaining === 0 ? 'The demo session has ended.' : undefined}
              onClick={() => advance(1)}
            >
              +5 minutes
            </Button>
            <Button
              size="small"
              variant="secondary"
              disabledReason={remaining === 0 ? 'The demo session has ended.' : undefined}
              onClick={() => advance(6)}
            >
              +30 minutes
            </Button>
            <Button
              size="small"
              variant="secondary"
              disabledReason={remaining === 0 ? 'The demo session has ended.' : undefined}
              onClick={() => advance(Math.ceil(remaining / (5 * 60_000)))}
            >
              To the end
            </Button>
          </div>
          <p className={shared.footnote}>
            Moving the clock evaluates price alerts in order and sends earnings reminders that fall
            due. Time never moves on its own, so every visit sees the same session.
          </p>
        </section>

        <section aria-labelledby="feed-heading">
          <SectionHeader title="Data feed" id="feed-heading" size="small" />
          <div className={shared.block}>
            <Segmented
              label="Data feed"
              value={state.feed}
              onChange={setFeed}
              items={FEEDS.map((item) => ({ value: item.value, label: item.label }))}
            />
            <p className="t-label t-muted" style={{ marginTop: 8 }}>
              {FEEDS.find((item) => item.value === state.feed)?.detail}
            </p>
          </div>
        </section>

        <section aria-labelledby="network-heading">
          <SectionHeader title="Network" id="network-heading" size="small" />
          <div style={{ margin: '0 var(--gutter)' }}>
            <SwitchRow
              icon={
                conditions.offline ? (
                  <WifiOff size={18} aria-hidden />
                ) : (
                  <Wifi size={18} aria-hidden />
                )
              }
              label="Simulate offline"
              detail="Requests fail as if the connection dropped; saved copies are labelled."
              checked={conditions.offline}
              onChange={(next) => setNetwork({ offline: next })}
            />
            <SwitchRow
              label="Slow responses"
              detail="Adds 2.5 seconds to every request, to see loading states."
              checked={conditions.slow}
              onChange={(next) => setNetwork({ slow: next })}
            />
          </div>
          <div className={shared.block} style={{ marginTop: 12 }}>
            <p className="t-label" style={{ marginBottom: 8 }}>
              Next save
            </p>
            <Segmented<NetworkConditions['nextWrite']>
              label="Next save behaviour"
              value={conditions.nextWrite}
              onChange={(nextWrite) => setNetwork({ nextWrite })}
              items={[
                { value: 'normal', label: 'Normal' },
                { value: 'reject', label: 'Fail' },
                { value: 'lose-response', label: 'Lose reply' },
              ]}
            />
            <p className="t-label t-muted" style={{ marginTop: 8 }}>
              {conditions.nextWrite === 'reject'
                ? 'The next save fails before anything is stored.'
                : conditions.nextWrite === 'lose-response'
                  ? 'The next save is stored, but the reply is lost. Retrying is safe and does not duplicate it.'
                  : 'Saves behave normally.'}
            </p>
          </div>
        </section>

        <section aria-labelledby="more-heading">
          <SectionHeader title="More" id="more-heading" size="small" />
          <List label="More demo tools">
            <Row
              to="/demo/components"
              icon={LayoutTemplate}
              title="Component catalogue"
              detail="Every component, token and state"
            />
            <Row icon={RefreshCw} title="Refresh all data" onPress={refresh} />
            <Row
              icon={Trash2}
              title="Reset demo data"
              detail="Back to the starting sample"
              onPress={() => void reset()}
            />
          </List>
          <p className={shared.footnote}>
            Tip: open the app in a second tab to act as a second device. Changes there appear here.
          </p>
        </section>

        <div style={{ padding: '24px var(--gutter) 0' }}>
          <DemoMailbox />
        </div>
        <Disclaimer>
          Demo tools exist only in the demo build. A live build reads real data and has no simulated
          controls.
        </Disclaimer>
      </Content>
      {element}
    </ScreenBody>
  );
}
