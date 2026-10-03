import { useMemo, useState } from 'react';
import { Button } from '@/components/Button';
import { PriceChart } from '@/components/chart/PriceChart';
import { createInspectionStore } from '@/components/chart/inspectionStore';
import { Eyebrow, LargeTitle, SectionHeader, TopBar } from '@/components/Header';
import { IconButton } from '@/components/IconButton';
import { Bell, Bookmark, Plus, Search, TriangleAlert } from '@/components/icons';
import { Content, Disclaimer, ScreenBody } from '@/components/Layout';
import { KeyValue, KeyValueList, List, Row } from '@/components/List';
import { Change, Price, RankBadge, Tag, Ticker } from '@/components/Market';
import { Sheet, useConfirm } from '@/components/Sheet';
import { Sparkline } from '@/components/Sparkline';
import {
  DataStatusLine,
  DemoTag,
  EmptyState,
  InlineError,
  Notice,
  Skeleton,
} from '@/components/Status';
import { CheckRow, SelectField, Slider, SwitchRow, TextField } from '@/components/Form';
import { Segmented, UnderlineTabs } from '@/components/Tabs';
import { useToast } from '@/components/Toast';
import type { Series } from '@/data/types';
import { useDocumentTitle } from '@/features/title';
import shared from '../shared.module.css';
import styles from './Catalogue.module.css';

const T0 = Date.UTC(2026, 9, 21, 13, 30);

function sampleSeries(): Series {
  const samples = Array.from({ length: 79 }, (_, index) => {
    const t = T0 + index * 5 * 60_000;
    const v = index === 30 || index === 31 ? null : 140 + Math.sin(index / 7) * 1.8 + index * 0.035;
    return { t, v: v == null ? null : Math.round(v * 100) / 100 };
  });
  return {
    instrumentId: 'catalogue',
    range: '1D',
    interval: '5m',
    axis: 'time',
    samples,
    window: { start: T0, end: T0 + 390 * 60_000 },
    reference: { value: '139.55', label: 'vs previous close', kind: 'previousClose' },
    currency: 'USD',
    asOf: new Date(T0 + 78 * 5 * 60_000).toISOString(),
    status: 'demo',
    source: 'Catalogue fixture with a deliberate gap',
    adjustment: 'split-adjusted',
    timeZone: 'America/New_York',
  };
}

const SWATCHES = [
  '--bg',
  '--fg',
  '--fg-muted',
  '--rule',
  '--accent-fill',
  '--accent-fg',
  '--positive',
  '--negative',
  '--warning-fill',
  '--bg-tint',
];

/** The component catalogue (spec page 58): every shared component and state on one page. */
export default function CatalogueScreen() {
  const toast = useToast();
  const { confirm, element } = useConfirm();
  const store = useMemo(() => createInspectionStore(), []);
  const series = useMemo(() => sampleSeries(), []);
  const [tab, setTab] = useState<'one' | 'two' | 'three'>('one');
  const [segment, setSegment] = useState<'days' | 'weeks' | 'months'>('weeks');
  const [checked, setChecked] = useState(true);
  const [switchOn, setSwitchOn] = useState(true);
  const [slider, setSlider] = useState(28);
  const [sheet, setSheet] = useState(false);
  useDocumentTitle('Component catalogue');

  return (
    <ScreenBody>
      <TopBar title="Component catalogue" ruled trailing={<DemoTag />} />
      <Content>
        <LargeTitle
          eyebrow="Design system"
          title="Components."
          size="title"
          subtitle="Shared tokens, components and states. The same pieces build every screen."
        />

        <SectionHeader title="Typography" size="small" />
        <div className={styles.stack}>
          <p className="t-display">Display 44</p>
          <p className="t-title">Title 32</p>
          <p className="t-quote num">$142.80</p>
          <p className="t-section">Section 22</p>
          <p className="t-ticker">NVDA</p>
          <p className="t-body">Body 16 — Inter for reading and data.</p>
          <p className="t-body-sm">Body small 15</p>
          <p className="t-label">Label 14</p>
          <p className="t-eyebrow">Eyebrow 12</p>
        </div>

        <SectionHeader title="Colour tokens" size="small" />
        <div className={styles.swatches}>
          {SWATCHES.map((token) => (
            <div key={token} className={styles.swatch}>
              <span className={styles.chip} style={{ background: `var(${token})` }} />
              <code>{token}</code>
            </div>
          ))}
        </div>

        <SectionHeader title="Buttons" size="small" />
        <div className={styles.grid}>
          <Button>Primary</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="accent">Accent</Button>
          <Button variant="quiet">Quiet</Button>
          <Button variant="danger">Danger</Button>
          <Button pending>Pending</Button>
          <Button disabledReason="Explains why it is unavailable.">Unavailable</Button>
          <Button variant="text">Text button</Button>
        </div>
        <div className={styles.row}>
          <IconButton icon={Search} label="Search" />
          <IconButton icon={Bookmark} label="Saved" active />
          <IconButton icon={Bell} label="Unread alerts" badge />
          <IconButton icon={Plus} label="Busy" busy />
        </div>

        <SectionHeader title="Market data" size="small" />
        <div className={styles.stack}>
          <div className={styles.row}>
            <RankBadge rank={1} />
            <Ticker symbol="NVDA" />
            <Price value="142.80" currency="USD" />
            <Change value="2.34" />
            <Change value="-0.48" />
            <Change value={null} />
          </div>
          <div className={styles.row}>
            <Tag tone="positive">Positive</Tag>
            <Tag tone="negative">Negative</Tag>
            <Tag tone="neutral">Neutral</Tag>
            <Tag tone="accent">Accent</Tag>
            <Tag tone="warning">Warning</Tag>
            <Tag tone="outline">Outline</Tag>
            <DemoTag />
          </div>
          <Sparkline
            samples={series.samples}
            reference={139.55}
            window={series.window}
            width={160}
            height={36}
          />
          {(['demo', 'delayed', 'stale', 'unavailable'] as const).map((status) => (
            <DataStatusLine
              key={status}
              status={status}
              asOf={series.asOf}
              timeZone="America/New_York"
              delaySeconds={900}
              unavailableReason={status === 'unavailable' ? 'Not listed yet' : null}
            />
          ))}
          <DataStatusLine
            status="demo"
            asOf={series.asOf}
            timeZone="America/New_York"
            cachedAt={T0 + 60 * 60_000}
            userTimeZone="Europe/Ljubljana"
          />
        </div>

        <SectionHeader title="Price chart" size="small" />
        <div className={shared.chartBlock}>
          <PriceChart
            series={series}
            store={store}
            label="Catalogue sample chart"
            height={200}
            marker={{ value: 140.5, label: 'Entry $140.50' }}
          />
        </div>

        <SectionHeader title="Navigation" size="small" />
        <UnderlineTabs
          label="Sample tabs"
          value={tab}
          onChange={setTab}
          items={[
            { value: 'one', label: 'Latest', count: 8 },
            { value: 'two', label: 'Sectors' },
            { value: 'three', label: 'Saved' },
          ]}
        />
        <div className={styles.stack}>
          <Segmented
            label="Horizon"
            variant="accent"
            value={segment}
            onChange={setSegment}
            items={[
              { value: 'days', label: 'Days' },
              { value: 'weeks', label: 'Weeks' },
              { value: 'months', label: 'Months' },
            ]}
          />
        </div>
        <List label="Sample rows">
          <Row to="/stocks/NVDA" title="Row with destination" detail="The whole row is one link" />
          <Row
            title="Row with a separate action"
            detail="Actions keep their own hit target"
            action={<IconButton icon={Bell} label="Create an alert" />}
            chevron={false}
          />
          <Row title="Selected row" selected chevron={false} />
        </List>
        <KeyValueList label="Key values">
          <KeyValue label="Shares" value="20" />
          <KeyValue label="Unavailable" value="—" muted />
        </KeyValueList>

        <SectionHeader title="Forms" size="small" />
        <div className={`${shared.form} ${shared.formNarrow}`}>
          <TextField
            label="Text field"
            hint="Hints sit between the label and the field."
            placeholder="Type here"
          />
          <TextField
            label="With error"
            defaultValue="12.345"
            error="Prices move in steps of 0.01."
            prefix="$"
          />
          <SelectField
            label="Select"
            options={[
              { value: 'a', label: 'Option A' },
              { value: 'b', label: 'Option B' },
            ]}
          />
          <CheckRow
            label="Checkbox row"
            detail="With a detail line"
            checked={checked}
            onChange={setChecked}
          />
          <SwitchRow
            label="Switch row"
            detail="Role switch with the label outside the control"
            checked={switchOn}
            onChange={setSwitchOn}
          />
          <Slider
            label="Exit multiple"
            min={18}
            max={40}
            step={1}
            value={slider}
            unit="×"
            onChange={setSlider}
            scale={['18×', '40×']}
          />
        </div>

        <SectionHeader title="Feedback" size="small" />
        <div className={styles.stack}>
          <Notice tone="neutral" title="Neutral notice">
            Supporting text explains what to do next.
          </Notice>
          <Notice tone="warning" icon={TriangleAlert} title="Warning notice" />
          <InlineError
            message="Something failed locally."
            onRetry={() => toast({ message: 'Retry pressed' })}
            requestId="req_sample"
          />
          <div className={styles.row}>
            <Button
              size="small"
              onClick={() =>
                toast({
                  message: 'Saved NVDA to High conviction',
                  action: { label: 'Undo', onAction: () => undefined },
                })
              }
            >
              Show toast
            </Button>
            <Button size="small" variant="secondary" onClick={() => setSheet(true)}>
              Open sheet
            </Button>
            <Button
              size="small"
              variant="quiet"
              onClick={() =>
                void confirm({
                  title: 'Confirm dialog',
                  body: 'Destructive actions name their consequence.',
                  confirmLabel: 'Delete',
                  destructive: true,
                })
              }
            >
              Confirm dialog
            </Button>
          </div>
          <Skeleton height={14} width="60%" />
          <Skeleton height={44} />
        </div>
        <EmptyState
          icon={Bookmark}
          size="section"
          title="Empty state"
          actions={
            <Button full variant="secondary">
              Next useful action
            </Button>
          }
        >
          Empty states explain the situation and offer the next step.
        </EmptyState>
        <Eyebrow as="p" className={styles.note}>
          End of catalogue
        </Eyebrow>
        <Disclaimer>
          Catalogue fixtures are illustrative and never mixed with screen data.
        </Disclaimer>
      </Content>
      <Sheet
        open={sheet}
        onClose={() => setSheet(false)}
        title="Sample sheet"
        footer={
          <Button full onClick={() => setSheet(false)}>
            Done
          </Button>
        }
      >
        <p className="t-body">
          Sheets trap focus, close on Escape or a downward drag, and return focus to the control
          that opened them.
        </p>
      </Sheet>
      {element}
    </ScreenBody>
  );
}
