import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router';
import { useAppNavigation } from '@/app/navigation';
import { Button } from '@/components/Button';
import { PriceChart } from '@/components/chart/PriceChart';
import { createInspectionStore } from '@/components/chart/inspectionStore';
import { Eyebrow, ScreenHeading, SectionHeader, TopBar } from '@/components/Header';
import { IconButton } from '@/components/IconButton';
import { ArrowRight, Pencil, Trash2, TriangleAlert, Undo2 } from '@/components/icons';
import { ActionBar, Content, Disclaimer, ScreenBody } from '@/components/Layout';
import { KeyValue, KeyValueList, List, Row } from '@/components/List';
import { Change, Tag } from '@/components/Market';
import { useConfirm } from '@/components/Sheet';
import { DataStatusLine, DemoTag, EmptyState, Notice, Skeleton } from '@/components/Status';
import { Segmented } from '@/components/Tabs';
import { TextArea } from '@/components/Form';
import { useToast } from '@/components/Toast';
import { formatDate, formatMoney, formatQuantity, formatSignedMoney } from '@/domain/format';
import { api } from '@/data/api';
import { errorMessage, isApiError } from '@/data/errors';
import { qk, useInstrument, usePosition, useSeries } from '@/data/queries';
import type {
  ChartRange,
  Instrument,
  JournalEntry,
  LedgerRecord,
  PositionDetail,
  ReviewTrigger,
} from '@/data/types';
import { newIdempotencyKey } from '@/data/transport';
import { describeRecord, effectiveRecords, nativeAverageEntry } from '@/features/portfolio';
import { QueryState, useOffline } from '@/features/status';
import { useUserTimeZone } from '@/features/time';
import { useDocumentTitle } from '@/features/title';
import { haptics } from '@/lib/haptics';
import { draftKey, readJson, writeJson } from '@/lib/storage';
import shared from '../shared.module.css';
import styles from './Portfolio.module.css';

const RANGES: ChartRange[] = ['1M', '3M', '1Y'];

type SyncState = 'draft' | 'saving' | 'saved' | 'unsynced';

/** Dated journal: a local draft until saved; failures stay visible as unsynced (spec page 33). */
function Journal({ instrument, entries }: { instrument: Instrument; entries: JournalEntry[] }) {
  const zone = useUserTimeZone();
  const queryClient = useQueryClient();
  const toast = useToast();
  const { confirm, element } = useConfirm();
  const storageKey = draftKey(`journal.${instrument.id}`);
  const [draft, setDraft] = useState(() => readJson<string>('local', storageKey) ?? '');
  const [state, setState] = useState<SyncState>(draft ? 'draft' : 'saved');
  const [error, setError] = useState<string | undefined>();
  const [open, setOpen] = useState(draft.length > 0);
  const key = useRef(newIdempotencyKey());
  const area = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    writeJson('local', storageKey, draft || null);
  }, [draft, storageKey]);
  useEffect(() => {
    const onOpen = () => {
      setOpen(true);
      requestAnimationFrame(() => area.current?.focus());
    };
    window.addEventListener('journal:compose', onOpen);
    return () => window.removeEventListener('journal:compose', onOpen);
  }, []);

  const save = async () => {
    setError(undefined);
    setState('saving');
    try {
      await api.portfolio.addNote(instrument.id, draft, key.current);
      haptics.success();
      key.current = newIdempotencyKey();
      setDraft('');
      setState('saved');
      setOpen(false);
      void queryClient.invalidateQueries({ queryKey: qk.position(instrument.id) });
      toast({ message: 'Note saved to your journal' });
    } catch (failure) {
      haptics.error();
      setState('unsynced');
      setError(
        isApiError(failure) ? (failure.fieldErrors.body ?? failure.message) : errorMessage(failure),
      );
    }
  };

  const remove = async (entry: JournalEntry) => {
    const ok = await confirm({
      title: 'Delete this note?',
      body: 'The note is removed from your journal. Trades and the review trigger are not affected.',
      confirmLabel: 'Delete note',
      destructive: true,
    });
    if (!ok) return;
    try {
      await api.portfolio.deleteNote(entry.id);
      void queryClient.invalidateQueries({ queryKey: qk.position(instrument.id) });
      toast({ message: 'Note deleted' });
    } catch (failure) {
      toast({
        message: `${errorMessage(failure)} The note is still in your journal.`,
        tone: 'error',
      });
    }
  };

  const status =
    state === 'saving'
      ? 'Saving…'
      : state === 'unsynced'
        ? 'Not saved yet. Your draft is kept on this device.'
        : draft
          ? 'Draft saved on this device'
          : '';

  return (
    <section aria-labelledby="journal-heading">
      <SectionHeader title="Investment journal" id="journal-heading" />
      {entries.length === 0 ? (
        <p className={shared.footnote}>
          No notes yet. Record why you opened this position, so you can review it later.
        </p>
      ) : (
        <ol className={styles.journal}>
          {entries.map((entry) => (
            <li key={entry.id} className={styles.entry}>
              <div className={styles.entryMeta}>
                <Eyebrow tone="muted">
                  {formatDate(Date.parse(entry.createdAt), zone)} /{' '}
                  {entry.kind === 'entry_reason' ? 'Original reasoning' : 'Note'}
                </Eyebrow>
                {entry.kind === 'note' && (
                  <IconButton
                    icon={Trash2}
                    size={18}
                    label={`Delete note from ${formatDate(Date.parse(entry.createdAt), zone)}`}
                    onClick={() => void remove(entry)}
                  />
                )}
              </div>
              <p className={styles.entryBody}>{entry.body}</p>
            </li>
          ))}
        </ol>
      )}
      {open ? (
        <div className={styles.composer}>
          <TextArea
            ref={area}
            label="New note"
            rows={4}
            value={draft}
            error={error}
            maxLength={2000}
            onChange={(event) => {
              setDraft(event.target.value);
              setState(event.target.value ? 'draft' : 'saved');
            }}
          />
          <div className={styles.composerActions}>
            <span className={styles.syncState} data-state={state} role="status">
              {status}
            </span>
            <span style={{ display: 'flex', gap: 8 }}>
              <Button size="small" variant="quiet" onClick={() => setOpen(false)}>
                {draft ? 'Keep draft' : 'Cancel'}
              </Button>
              <Button
                size="small"
                pending={state === 'saving'}
                disabledReason={draft.trim() ? undefined : 'Write a note first.'}
                onClick={() => void save()}
              >
                {state === 'unsynced' ? 'Try again' : 'Save note'}
              </Button>
            </span>
          </div>
        </div>
      ) : (
        <div className={shared.block} style={{ marginTop: 12 }}>
          <Button
            size="small"
            variant="secondary"
            icon={Pencil}
            iconPosition="start"
            onClick={() => setOpen(true)}
          >
            {draft ? 'Continue your draft' : 'Add a note'}
          </Button>
        </div>
      )}
      {element}
    </section>
  );
}

function ReviewTriggerEditor({
  instrumentId,
  trigger,
}: {
  instrumentId: string;
  trigger: ReviewTrigger | null;
}) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(trigger?.text ?? '');
  const [error, setError] = useState<string | undefined>();
  const [conflict, setConflict] = useState<ReviewTrigger | null>(null);
  const mutation = useMutation({
    mutationFn: () =>
      api.portfolio.setReviewTrigger(
        instrumentId,
        text,
        conflict?.version ?? trigger?.version ?? null,
      ),
  });

  const save = async () => {
    setError(undefined);
    try {
      await mutation.mutateAsync();
      haptics.success();
      setEditing(false);
      setConflict(null);
      void queryClient.invalidateQueries({ queryKey: qk.position(instrumentId) });
      toast({ message: 'Review trigger saved' });
    } catch (failure) {
      haptics.error();
      if (isApiError(failure) && failure.code === 'version_conflict')
        setConflict((failure.details.latest as ReviewTrigger | undefined) ?? null);
      else
        setError(
          isApiError(failure)
            ? (failure.fieldErrors.text ?? failure.message)
            : errorMessage(failure),
        );
    }
  };

  return (
    <section aria-labelledby="trigger-heading">
      <SectionHeader
        title="Review trigger"
        id="trigger-heading"
        aside={
          !editing ? (
            <Button
              size="small"
              variant="text"
              onClick={() => {
                setText(trigger?.text ?? '');
                setEditing(true);
              }}
            >
              {trigger ? 'Edit' : 'Add'}
            </Button>
          ) : undefined
        }
      />
      {editing ? (
        <div className={styles.composer}>
          {conflict && (
            <Notice tone="warning" title="Changed on another device.">
              Latest: “{conflict.text}”. Save again to replace it with yours.
            </Notice>
          )}
          <TextArea
            label="When should you reassess this idea?"
            rows={3}
            maxLength={280}
            value={text}
            error={error}
            onChange={(event) => setText(event.target.value)}
            hint="For example: reassess if guidance weakens. Up to 280 characters."
          />
          <div className={styles.composerActions}>
            <span />
            <span style={{ display: 'flex', gap: 8 }}>
              <Button
                size="small"
                variant="quiet"
                onClick={() => {
                  setEditing(false);
                  setConflict(null);
                  setError(undefined);
                }}
              >
                Cancel
              </Button>
              <Button size="small" pending={mutation.isPending} onClick={() => void save()}>
                Save trigger
              </Button>
            </span>
          </div>
        </div>
      ) : (
        <p className={styles.trigger}>
          {trigger?.text ??
            'No review trigger yet. Define the condition that would make you reassess this position.'}
        </p>
      )}
    </section>
  );
}

function LedgerHistory({ detail, instrument }: { detail: PositionDetail; instrument: Instrument }) {
  const zone = useUserTimeZone();
  const queryClient = useQueryClient();
  const toast = useToast();
  const { confirm, element } = useConfirm();
  const reversedIds = new Set(
    detail.ledger.filter((record) => record.type === 'reversal').map((record) => record.reversalOf),
  );
  const ordered = [...detail.ledger].sort(
    (a, b) => Date.parse(b.effectiveAt) - Date.parse(a.effectiveAt) || b.sequence - a.sequence,
  );

  const reverse = async (record: LedgerRecord) => {
    const ok = await confirm({
      title: 'Reverse this paper trade?',
      body: `${describeRecord(record, instrument.symbol)} on ${formatDate(Date.parse(record.effectiveAt), zone)}. A reversing entry is added; the original stays in the history.`,
      confirmLabel: 'Reverse trade',
      destructive: true,
    });
    if (!ok) return;
    try {
      await api.portfolio.reverse(record.id, newIdempotencyKey());
      haptics.success();
      void queryClient.invalidateQueries({ queryKey: ['private', 'position'] });
      void queryClient.invalidateQueries({ queryKey: ['private', 'portfolio'] });
      toast({ message: 'Trade reversed. The history keeps both entries.' });
    } catch (failure) {
      haptics.error();
      toast({ message: errorMessage(failure), tone: 'error' });
    }
  };

  if (ordered.length === 0) return null;
  return (
    <section aria-labelledby="history-heading">
      <SectionHeader title="Trade history" id="history-heading" size="small" />
      <List label="Trade history">
        {ordered.map((record) => {
          const reversed = reversedIds.has(record.id);
          const canReverse = (record.type === 'buy' || record.type === 'sell') && !reversed;
          return (
            <Row
              key={record.id}
              title={
                <span style={reversed ? { textDecoration: 'line-through' } : undefined}>
                  {describeRecord(record, instrument.symbol)}
                </span>
              }
              detail={`${formatDate(Date.parse(record.effectiveAt), zone)}${record.priceSource === 'manual' ? ' · manual price' : record.priceSource === 'observation' ? ' · quote at entry' : ''}${
                record.fee !== '0' ? ` · costs ${formatMoney(record.fee, record.currency)}` : ''
              }${reversed ? ' · reversed' : ''}`}
              action={
                canReverse ? (
                  <IconButton
                    icon={Undo2}
                    size={18}
                    label={`Reverse: ${describeRecord(record, instrument.symbol)}`}
                    onClick={() => void reverse(record)}
                  />
                ) : undefined
              }
              chevron={false}
              dense
            />
          );
        })}
      </List>
      {element}
    </section>
  );
}

function Position({ instrument }: { instrument: Instrument }) {
  const detail = usePosition(instrument.id);
  const [range, setRange] = useState<ChartRange>('3M');
  const series = useSeries(instrument.status === 'listed' ? instrument.id : undefined, range);
  const store = useMemo(() => createInspectionStore(), []);
  const zone = useUserTimeZone();
  const offline = useOffline();
  const { push } = useAppNavigation();
  useDocumentTitle(`${instrument.symbol} · Paper position`);

  return (
    <QueryState query={detail} errorTitle="This paper position could not be loaded.">
      {(data) => {
        const position = data.position;
        const held = Number(position.units) > 0;
        const entry = nativeAverageEntry(data.ledger);
        const hasHistory = effectiveRecords(data.ledger).length > 0;
        return (
          <>
            <Content>
              <div className={shared.eyebrowRow}>
                <Eyebrow tone="muted">{instrument.shortName} / Paper holding</Eyebrow>
                <DemoTag label="Demo data" />
              </div>
              <div className={shared.headline}>
                <ScreenHeading size="none" className={shared.bigTicker}>
                  <span data-anchor-target="ticker">{instrument.symbol}</span>
                </ScreenHeading>
              </div>
              {held ? (
                <div className={styles.valueBlock} style={{ marginTop: 8 }}>
                  <p className={styles.value}>
                    {position.value ? formatMoney(position.value, 'USD') : '—'}
                  </p>
                  <p className="t-label t-muted">
                    Current model value{instrument.currency !== 'USD' ? ' in USD' : ''}
                  </p>
                  {position.unrealized != null ? (
                    <p
                      className={styles.gain}
                      data-direction={Number(position.unrealized) >= 0 ? 'up' : 'down'}
                    >
                      {formatSignedMoney(position.unrealized, 'USD')}{' '}
                      <Change value={position.unrealizedPct} size="md" />
                    </p>
                  ) : (
                    <p className={styles.gainMuted}>Gain unavailable without a current quote</p>
                  )}
                </div>
              ) : (
                <EmptyState
                  size="section"
                  title={
                    hasHistory
                      ? 'This position is closed.'
                      : `No paper position in ${instrument.symbol}.`
                  }
                  actions={
                    <Button
                      full
                      onClick={() =>
                        push(`/paper/transactions/new?instrument=${instrument.symbol}`)
                      }
                    >
                      Record a paper trade
                    </Button>
                  }
                >
                  {hasHistory
                    ? 'Its trades, journal and realized result stay here.'
                    : 'Simulate a position to track the idea and your reasoning.'}
                </EmptyState>
              )}

              {instrument.status === 'listed' && (
                <>
                  <div className={shared.chartBlock}>
                    {series.data ? (
                      <PriceChart
                        series={series.data}
                        store={store}
                        label={`${instrument.symbol} price with your average entry, ${series.data.range}`}
                        height={200}
                        marker={
                          held && entry
                            ? {
                                value: Number(entry.toFixed(4)),
                                label: `Entry ${formatMoney(entry.toFixed(2), instrument.currency)}`,
                              }
                            : null
                        }
                        loading={series.isFetching && series.isPlaceholderData}
                      />
                    ) : (
                      <Skeleton height={200} />
                    )}
                  </div>
                  <div className={shared.rangeRow}>
                    <Segmented
                      label="Chart range"
                      variant="ghost"
                      value={range}
                      onChange={setRange}
                      items={RANGES.map((value) => ({ value, label: value }))}
                    />
                  </div>
                </>
              )}

              {held && (
                <KeyValueList label="Position">
                  <KeyValue label="Shares" value={formatQuantity(position.units)} />
                  <KeyValue
                    label="Average entry"
                    value={entry ? formatMoney(entry.toFixed(2), instrument.currency) : '—'}
                  />
                  <KeyValue
                    label="Sample price"
                    value={
                      <span style={{ display: 'grid', justifyItems: 'end' }}>
                        <span>
                          {position.price ? formatMoney(position.price, position.currency) : '—'}
                        </span>
                        <DataStatusLine
                          status={position.priceStatus}
                          asOf={position.priceAsOf}
                          timeZone={instrument.timeZone}
                        />
                      </span>
                    }
                  />
                  <KeyValue
                    label="Cost basis (USD)"
                    value={formatMoney(position.costBasis, 'USD')}
                  />
                  <KeyValue label="Realized" value={formatSignedMoney(position.realized, 'USD')} />
                  {position.firstBoughtAt && (
                    <KeyValue
                      label="Opened"
                      value={formatDate(Date.parse(position.firstBoughtAt), zone)}
                    />
                  )}
                </KeyValueList>
              )}
              {held && instrument.currency !== 'USD' && (
                <p className={shared.footnote}>
                  The portfolio is valued in USD. Average entry is in {instrument.currency}; cost
                  basis converts each trade at its own FX rate.
                </p>
              )}

              <Journal instrument={instrument} entries={data.journal} />
              <ReviewTriggerEditor
                key={data.reviewTrigger?.version ?? 0}
                instrumentId={instrument.id}
                trigger={data.reviewTrigger}
              />
              <LedgerHistory detail={data} instrument={instrument} />
              <Disclaimer>
                Paper position with sample prices. No order was placed; values exclude taxes and
                dividends. Cash available {formatMoney(data.cash, 'USD')}.
              </Disclaimer>
            </Content>
            <ActionBar note={offline ? 'Reconnect to update the position.' : undefined}>
              <Button
                full
                between
                icon={ArrowRight}
                disabledReason={
                  offline
                    ? 'Needs a connection.'
                    : instrument.status !== 'listed'
                      ? 'Paper positions need a listed, quoted company.'
                      : undefined
                }
                onClick={() => push(`/paper/transactions/new?instrument=${instrument.symbol}`)}
              >
                Update paper position
              </Button>
              <Button
                variant="text"
                size="small"
                onClick={() => window.dispatchEvent(new Event('journal:compose'))}
              >
                Add a note
              </Button>
            </ActionBar>
          </>
        );
      }}
    </QueryState>
  );
}

export default function PaperPositionScreen() {
  const { symbol } = useParams();
  const instrument = useInstrument(symbol);
  const { push } = useAppNavigation();
  return (
    <ScreenBody>
      <TopBar title="Model position" ruled trailing={<Tag tone="outline">Paper</Tag>} />
      {instrument.data ? (
        <Position instrument={instrument.data} />
      ) : instrument.isError ? (
        <Content>
          <EmptyState
            icon={TriangleAlert}
            title="This company is not available."
            actions={
              <Button full onClick={() => push('/portfolio', { replace: true })}>
                Open your paper portfolio
              </Button>
            }
          >
            The link may be wrong.
          </EmptyState>
        </Content>
      ) : (
        <div className={shared.block} style={{ display: 'grid', gap: 12, paddingTop: 16 }}>
          <Skeleton width="40%" height={14} />
          <Skeleton width="50%" height={56} />
          <Skeleton height={200} />
        </div>
      )}
    </ScreenBody>
  );
}
