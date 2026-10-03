import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { useParams, useSearchParams } from 'react-router';
import { useAppNavigation } from '@/app/navigation';
import { useSession } from '@/app/session';
import { AppLink } from '@/components/AppLink';
import { Button } from '@/components/Button';
import { LargeTitle, SectionHeader, TopBar } from '@/components/Header';
import {
  Bell,
  ChevronRight,
  ICON_STROKE,
  Inbox,
  Mail,
  Pause,
  Play,
  RefreshCw,
  Search,
  Smartphone,
  Trash2,
  TriangleAlert,
} from '@/components/icons';
import { ActionBar, Content, ScreenBody } from '@/components/Layout';
import { List, Row } from '@/components/List';
import { Change, Price, Tag, Ticker } from '@/components/Market';
import { Sheet, useConfirm } from '@/components/Sheet';
import { DemoTag, EmptyState, Notice, Skeleton } from '@/components/Status';
import { SelectField, SwitchRow, TextField } from '@/components/Form';
import { Segmented } from '@/components/Tabs';
import { useToast } from '@/components/Toast';
import type { Comparator, RepeatMode } from '@/domain/alerts';
import { validateThreshold } from '@/domain/alerts';
import { computeChange } from '@/domain/change';
import { formatDateTime, formatMoney } from '@/domain/format';
import { api, deviceLabel } from '@/data/api';
import { errorMessage, isApiError } from '@/data/errors';
import {
  qk,
  useAlert,
  useInstrument,
  useInstrumentEvents,
  usePreferences,
  useQuote,
  useReports,
  useSearch,
} from '@/data/queries';
import type {
  AlertRule,
  AlertRuleInput,
  AlertType,
  ChannelName,
  EarningsEvent,
  Instrument,
  Preferences,
} from '@/data/types';
import { newIdempotencyKey } from '@/data/transport';
import { dayLabel, releaseTimingText } from '@/features/earnings';
import { useUnsavedChangesGuard } from '@/features/guard';
import {
  describeRule,
  PERMISSION_TEXT,
  RULE_STATE_LABEL,
  usePushPermission,
} from '@/features/notifications';
import { useOffline } from '@/features/status';
import { useUserTimeZone } from '@/features/time';
import { useDocumentTitle } from '@/features/title';
import { useDebounced } from '@/lib/hooks';
import { haptics } from '@/lib/haptics';
import { draftKey, readJson, writeJson } from '@/lib/storage';
import shared from '../shared.module.css';
import styles from './AlertEditor.module.css';

interface Draft {
  symbol: string | null;
  type: AlertType;
  comparator: Comparator;
  threshold: string;
  repeat: RepeatMode;
  push: boolean;
  email: boolean;
  earningsId: string | null;
}

type FieldErrors = Partial<
  Record<'threshold' | 'comparator' | 'earningsId' | 'channels' | 'instrument', string>
>;

const TYPES: { value: AlertType; label: string }[] = [
  { value: 'price', label: 'Price' },
  { value: 'earnings', label: 'Earnings' },
  { value: 'thesis', label: 'Thesis' },
];

const NEW_DRAFT = draftKey('alert.new');

function channelsOf(draft: Draft): ChannelName[] {
  return [
    'inbox',
    ...(draft.push ? (['push'] as const) : []),
    ...(draft.email ? (['email'] as const) : []),
  ];
}

function toInput(
  draft: Draft,
  instrument: Instrument,
  reportId: string | undefined,
): AlertRuleInput {
  return {
    instrumentId: instrument.id,
    type: draft.type,
    comparator: draft.type === 'price' ? draft.comparator : undefined,
    threshold: draft.type === 'price' ? draft.threshold.trim() : undefined,
    earningsId: draft.type === 'earnings' ? (draft.earningsId ?? undefined) : undefined,
    reportId: draft.type === 'thesis' ? reportId : undefined,
    repeat: draft.type === 'price' ? draft.repeat : 'once',
    channels: channelsOf(draft),
  };
}

/** Company chooser for alerts: search, with earnings-only results for reminders. */
function CompanyPicker({
  open,
  onClose,
  onChoose,
  earningsOnly,
}: {
  open: boolean;
  onClose: () => void;
  onChoose: (symbol: string) => void;
  earningsOnly: boolean;
}) {
  const [q, setQ] = useState('');
  const debounced = useDebounced(q, 250);
  const results = useSearch(
    { q: debounced, setup: earningsOnly ? 'earnings' : 'any', sort: 'relevance' },
    open,
  );
  return (
    <Sheet open={open} onClose={onClose} title="Choose a company" size="tall">
      <TextField
        label="Search"
        type="search"
        value={q}
        placeholder="Company, ticker or theme"
        autoComplete="off"
        enterKeyHint="search"
        onChange={(event) => setQ(event.target.value)}
        trailing={<Search size={18} strokeWidth={ICON_STROKE} aria-hidden />}
      />
      {earningsOnly && (
        <p className="t-label t-muted" style={{ marginTop: 8 }}>
          Showing companies with a scheduled release.
        </p>
      )}
      <div style={{ marginTop: 12, marginInline: 'calc(-1 * var(--gutter))' }}>
        {results.data ? (
          results.data.length === 0 ? (
            <p className="t-body-sm t-muted" style={{ padding: '16px var(--gutter)' }}>
              No companies match “{debounced}”.
            </p>
          ) : (
            <List label="Companies">
              {results.data.slice(0, 20).map((result) => (
                <Row
                  key={result.instrument.id}
                  onPress={() => onChoose(result.instrument.symbol)}
                  title={<Ticker symbol={result.instrument.symbol} />}
                  detail={`${result.instrument.shortName}${result.instrument.status === 'pending' ? ' · not yet listed' : ''}`}
                  linkLabel={`${result.instrument.symbol}, ${result.instrument.shortName}`}
                  dense
                />
              ))}
            </List>
          )
        ) : (
          <div style={{ padding: '16px var(--gutter)' }}>
            <Skeleton height={44} />
          </div>
        )}
      </div>
    </Sheet>
  );
}

function CompanyCard({
  instrument,
  onChange,
  locked,
}: {
  instrument: Instrument | null;
  onChange: () => void;
  locked: boolean;
}) {
  const quote = useQuote(instrument?.status === 'listed' ? instrument.id : undefined);
  const change = quote.data ? computeChange(quote.data.price, quote.data.previousClose) : null;
  const content = instrument ? (
    <>
      <span className={styles.companyId}>
        <Ticker symbol={instrument.symbol} className={styles.companyTicker} />
        <span className={styles.companyName}>{instrument.shortName}</span>
      </span>
      <span className={styles.companyQuote}>
        {instrument.status === 'listed' ? (
          <>
            <Price value={quote.data?.price ?? null} currency={instrument.currency} size="md" />
            {change?.percent && <Change value={change.percent} />}
          </>
        ) : (
          <span className="t-label t-muted">Not yet listed</span>
        )}
      </span>
    </>
  ) : (
    <span className={styles.companyEmpty}>Choose a company</span>
  );
  if (locked) return <div className={styles.company}>{content}</div>;
  return (
    <button
      type="button"
      className={styles.company}
      onClick={onChange}
      aria-label={
        instrument
          ? `${instrument.symbol}, ${instrument.shortName}. Change company`
          : 'Choose a company'
      }
    >
      {content}
      <ChevronRight
        size={18}
        strokeWidth={ICON_STROKE}
        aria-hidden
        className={styles.companyChevron}
      />
    </button>
  );
}

/** The form body shared by create and edit (spec pages 34, 38). */
function AlertFields({
  draft,
  setDraft,
  instrument,
  errors,
  setErrors,
  mode,
  thresholdRef,
}: {
  draft: Draft;
  setDraft: (patch: Partial<Draft>) => void;
  instrument: Instrument | null;
  errors: FieldErrors;
  setErrors: (next: FieldErrors) => void;
  mode: 'create' | 'edit';
  thresholdRef: React.RefObject<HTMLInputElement | null>;
}) {
  const { signedIn, me } = useSession();
  const preferences = usePreferences(signedIn);
  const userZone = useUserTimeZone();
  const quote = useQuote(instrument?.status === 'listed' ? instrument.id : undefined);
  const events = useInstrumentEvents(draft.type === 'earnings' ? instrument?.id : undefined);
  const [permission, requestPermission] = usePushPermission();
  const scheduled = (events.data ?? []).filter((event) => event.status === 'scheduled');
  const accountPush = preferences.data?.notifications.channels.push ?? true;
  const accountEmail = preferences.data?.notifications.channels.email ?? true;

  useEffect(() => {
    // Default to the next scheduled release once the company's events arrive.
    if (draft.type === 'earnings' && !draft.earningsId && scheduled[0])
      setDraft({ earningsId: scheduled[0].id });
  }, [draft.type, draft.earningsId, scheduled, setDraft]);

  const togglePush = async (next: boolean) => {
    setDraft({ push: next });
    if (next && permission === 'default') {
      const result = await requestPermission();
      if (result === 'granted')
        void api.notifications.registerDevice(deviceLabel()).catch(() => undefined);
    } else if (next && permission === 'granted') {
      void api.notifications.registerDevice(deviceLabel()).catch(() => undefined);
    }
  };

  const pushDetail = !accountPush ? (
    <>
      Push is off in{' '}
      <AppLink to="/settings/notifications" className="link">
        Alert settings
      </AppLink>
      ; this alert will use your inbox until you turn it on.
    </>
  ) : (
    PERMISSION_TEXT[permission]
  );

  const emailDetail = !me?.verified
    ? 'Verify your email address to receive alerts by email.'
    : !accountEmail
      ? 'Email is off in Alert settings; this alert will use your inbox until you turn it on.'
      : `Sent to ${me.email}.`;

  return (
    <>
      {mode === 'create' ? (
        <section aria-labelledby="type-heading">
          <h2 className={styles.label} id="type-heading">
            Alert type
          </h2>
          <Segmented
            label="Alert type"
            variant="accent"
            className={styles.types}
            value={draft.type}
            onChange={(type) => {
              setDraft({ type });
              setErrors({});
            }}
            items={TYPES}
          />
        </section>
      ) : null}

      {draft.type === 'price' && (
        <>
          {instrument && instrument.status !== 'listed' && (
            <Notice tone="neutral" title="Price alerts start after listing.">
              {instrument.symbol} is not quoted yet. Choose Thesis to follow research and listing
              updates instead.
            </Notice>
          )}
          <SelectField
            label="Condition"
            value={draft.comparator}
            error={errors.comparator}
            onChange={(event) => setDraft({ comparator: event.target.value as Comparator })}
            options={[
              { value: 'cross_above', label: 'Price rises above' },
              { value: 'cross_below', label: 'Price falls below' },
            ]}
          />
          <TextField
            ref={thresholdRef}
            label="Threshold price"
            size="large"
            prefix={instrument?.currency === 'EUR' ? '€' : '$'}
            inputMode="decimal"
            autoComplete="off"
            enterKeyHint="done"
            placeholder="0.00"
            value={draft.threshold}
            error={errors.threshold}
            hint={
              quote.data?.price
                ? `Current price ${formatMoney(quote.data.price, quote.data.currency)}. Prices move in steps of ${instrument?.tickSize ?? '0.01'}.`
                : undefined
            }
            onChange={(event) => {
              setDraft({ threshold: event.target.value });
              if (errors.threshold) setErrors({ ...errors, threshold: undefined });
            }}
            onBlur={() => {
              if (!instrument || draft.threshold.trim() === '') return;
              const result = validateThreshold(draft.threshold, instrument);
              if (!result.ok) setErrors({ ...errors, threshold: result.message });
            }}
          />
          <SelectField
            label="Repeat"
            value={draft.repeat}
            onChange={(event) => setDraft({ repeat: event.target.value as RepeatMode })}
            options={[
              { value: 'once', label: 'Once' },
              { value: 'repeating', label: 'Every crossing (5-minute cooldown)' },
            ]}
            hint={
              draft.repeat === 'once'
                ? 'Fires the first time the price crosses, then completes.'
                : 'Fires on each new crossing after the price returns and a 5-minute cooldown passes.'
            }
          />
        </>
      )}

      {draft.type === 'earnings' && (
        <>
          {events.isPending && instrument ? (
            <Skeleton height={56} />
          ) : scheduled.length === 0 ? (
            <Notice tone="neutral" title="No scheduled release.">
              {instrument
                ? `${instrument.symbol} has no upcoming earnings in the calendar yet.`
                : 'Choose a company with a scheduled release.'}
            </Notice>
          ) : (
            <SelectField
              label="Release"
              value={draft.earningsId ?? ''}
              error={errors.earningsId}
              disabled={mode === 'edit'}
              onChange={(event) => setDraft({ earningsId: event.target.value })}
              options={scheduled.map((event) => ({
                value: event.id,
                label: `${event.fiscalPeriod} · ${dayLabel(event.date, event.timeZone)} · ${releaseTimingText(event)}`,
              }))}
            />
          )}
          <p className={styles.explain}>
            The reminder arrives 24 hours before a confirmed release. When only the date is known,
            it arrives at 08:00 your time ({userZone}) on that day and says the time is unconfirmed.
          </p>
        </>
      )}

      {draft.type === 'thesis' && (
        <p className={styles.explain}>
          {instrument?.status === 'pending'
            ? `Get notified when research on ${instrument.symbol} is published or revised, including changes to its listing terms.`
            : `Get notified when the research note on ${instrument?.symbol ?? 'this company'} is revised or withdrawn, with a summary of what changed.`}
        </p>
      )}

      <section aria-labelledby="deliver-heading" className={styles.deliver}>
        <h2 className={styles.label} id="deliver-heading">
          Deliver to
        </h2>
        <div className={styles.channels}>
          <SwitchRow
            icon={<Inbox size={18} strokeWidth={ICON_STROKE} aria-hidden />}
            label="Alert inbox"
            detail="Always on, so every alert is kept."
            checked
            disabled
            onChange={() => undefined}
          />
          <SwitchRow
            icon={<Smartphone size={18} strokeWidth={ICON_STROKE} aria-hidden />}
            label="Push notification"
            detail={pushDetail}
            checked={draft.push}
            onChange={(next) => void togglePush(next)}
          />
          <SwitchRow
            icon={<Mail size={18} strokeWidth={ICON_STROKE} aria-hidden />}
            label="Email"
            detail={emailDetail}
            checked={draft.email}
            onChange={(next) => setDraft({ email: next })}
          />
        </div>
        {errors.channels && <p className={styles.error}>{errors.channels}</p>}
        <p className={styles.explain}>
          Alerts depend on quote availability. If the feed is delayed or interrupted, price alerts
          wait for fresh quotes and never fire on stale prices.
        </p>
      </section>
    </>
  );
}

function useThesisReport(instrumentId: string | undefined) {
  const reports = useReports({ instrumentId });
  return reports.data?.find(
    (report) =>
      report.status === 'published' && (report.kind === 'thesis' || report.kind === 'ipo'),
  )?.id;
}

function applyFieldErrors(failure: unknown, setErrors: (errors: FieldErrors) => void): boolean {
  if (
    isApiError(failure) &&
    failure.code === 'validation' &&
    Object.keys(failure.fieldErrors).length > 0
  ) {
    setErrors(failure.fieldErrors as FieldErrors);
    return true;
  }
  return false;
}

export function CreateAlertScreen() {
  const [params] = useSearchParams();
  const initialSymbol = params.get('instrument');
  const initialType =
    (['price', 'earnings', 'thesis'] as const).find((value) => value === params.get('type')) ??
    'price';
  const draftId = `${initialSymbol ?? ''}|${initialType}|${params.get('event') ?? ''}`;
  const { signedIn, verified } = useSession();
  const queryClient = useQueryClient();
  const toast = useToast();
  const offline = useOffline();
  const { push, back } = useAppNavigation();
  const [permission] = usePushPermission();

  const [draft, setDraftState] = useState<Draft>(() => {
    const saved = readJson<{ id: string; draft: Draft }>('session', NEW_DRAFT);
    if (saved && saved.id === draftId) return saved.draft;
    // Push defaults on only where the account allows it and this device already granted permission.
    const accountPush =
      queryClient.getQueryData<Preferences>(qk.preferences)?.notifications.channels.push ?? false;
    return {
      symbol: initialSymbol,
      type: initialType,
      comparator: 'cross_above',
      threshold: '',
      repeat: 'once',
      push: permission === 'granted' && accountPush,
      email: false,
      earningsId: params.get('event'),
    };
  });
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<{
    message: string;
    lost?: boolean;
    existingId?: string;
    unverified?: boolean;
  } | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [confirming, setConfirming] = useState<{
    input: AlertRuleInput;
    message: string | null;
  } | null>(null);
  const [created, setCreated] = useState(false);
  const thresholdRef = useRef<HTMLInputElement>(null);
  const keyRef = useRef<{ key: string; print: string } | null>(null);
  const lastInput = useRef<AlertRuleInput | null>(null);

  const instrument = useInstrument(draft.symbol ?? undefined);
  const reportId = useThesisReport(instrument.data?.id);
  useDocumentTitle(
    instrument.data ? `New ${draft.type} alert for ${instrument.data.symbol}` : 'New alert',
  );

  const setDraft = useMemo(
    () => (patch: Partial<Draft>) => setDraftState((current) => ({ ...current, ...patch })),
    [],
  );
  useEffect(() => writeJson('session', NEW_DRAFT, { id: draftId, draft }), [draft, draftId]);

  const dirty =
    draft.threshold.trim() !== '' || draft.symbol !== initialSymbol || draft.type !== initialType;
  const guard = useUnsavedChangesGuard(dirty && !created, 'This alert has not been created.');

  const preview = useMutation({ mutationFn: (input: AlertRuleInput) => api.alerts.preview(input) });
  const create = useMutation({
    mutationFn: ({ input, key }: { input: AlertRuleInput; key: string }) =>
      api.alerts.create(input, key),
  });

  const review = async (event?: FormEvent) => {
    event?.preventDefault();
    setFormError(null);
    if (!instrument.data) {
      setErrors({ instrument: 'Choose a company.' });
      setPickerOpen(true);
      return;
    }
    const nextErrors: FieldErrors = {};
    if (draft.type === 'price') {
      const result = validateThreshold(draft.threshold, instrument.data);
      if (!result.ok) nextErrors.threshold = result.message;
    }
    if (draft.type === 'earnings' && !draft.earningsId) nextErrors.earningsId = 'Choose a release.';
    setErrors(nextErrors);
    if (nextErrors.threshold) {
      thresholdRef.current?.focus();
      return;
    }
    if (Object.keys(nextErrors).length) return;
    const input = toInput(draft, instrument.data, reportId);
    try {
      const result = await preview.mutateAsync(input);
      setConfirming({ input, message: result.message });
    } catch (failure) {
      haptics.error();
      if (applyFieldErrors(failure, setErrors)) return;
      if (isApiError(failure) && failure.code === 'duplicate') {
        setFormError({
          message: failure.message,
          existingId: failure.details.existingId as string | undefined,
        });
      } else if (isApiError(failure) && failure.code === 'unverified') {
        setFormError({ message: failure.message, unverified: true });
      } else {
        setFormError({ message: errorMessage(failure) });
      }
    }
  };

  /**
   * Persist exactly the reviewed rule. The idempotency key is tied to the input, so retrying after
   * a lost reply returns the stored rule instead of creating a second one.
   */
  const persist = async (input: AlertRuleInput) => {
    const print = JSON.stringify(input);
    if (!keyRef.current || keyRef.current.print !== print)
      keyRef.current = { key: newIdempotencyKey(), print };
    lastInput.current = input;
    setFormError(null);
    try {
      const rule = await create.mutateAsync({ input, key: keyRef.current.key });
      haptics.success();
      setCreated(true);
      setConfirming(null);
      writeJson('session', NEW_DRAFT, null);
      queryClient.setQueryData<AlertRule[]>(qk.alerts, (current) => [
        rule,
        ...(current ?? []).filter((item) => item.id !== rule.id),
      ]);
      void queryClient.invalidateQueries({ queryKey: qk.alerts });
      void queryClient.invalidateQueries({ queryKey: ['private', 'inbox'] });
      toast({
        message: `Alert created: ${describeRule(rule)}`,
        action: { label: 'View', onAction: () => push('/alerts') },
      });
      back('/alerts');
    } catch (failure) {
      haptics.error();
      setConfirming(null);
      if (isApiError(failure) && failure.code === 'timeout') {
        setFormError({ message: failure.message, lost: true });
      } else if (isApiError(failure) && failure.code === 'duplicate') {
        setFormError({
          message: failure.message,
          existingId: failure.details.existingId as string | undefined,
        });
      } else if (!applyFieldErrors(failure, setErrors)) {
        setFormError({ message: errorMessage(failure) });
      }
    }
  };

  const confirm = () => (confirming ? persist(confirming.input) : Promise.resolve());

  const summary = useMemo(() => {
    if (!confirming || !instrument.data) return '';
    const company = instrument.data;
    const normalized = confirming.input.threshold
      ? validateThreshold(confirming.input.threshold, company)
      : null;
    const base = describeRule({
      type: confirming.input.type,
      comparator: confirming.input.comparator ?? null,
      threshold: normalized?.ok ? normalized.value : null,
      currency: company.currency,
      repeat: confirming.input.repeat,
      symbol: company.symbol,
    });
    if (confirming.input.type === 'earnings') {
      const event = queryClient
        .getQueryData<EarningsEvent[]>(qk.events(company.id))
        ?.find((item) => item.id === confirming.input.earningsId);
      return event
        ? `${base} for ${event.fiscalPeriod}, ${dayLabel(event.date, event.timeZone)} (${releaseTimingText(event)})`
        : base;
    }
    return base;
  }, [confirming, instrument.data, queryClient]);

  return (
    <ScreenBody>
      <TopBar title="New alert" ruled trailing={<DemoTag />} />
      <Content>
        <LargeTitle title="Stay informed." size="title" />
        <form
          id="alert-form"
          className={`${shared.form} ${shared.formNarrow}`}
          onSubmit={review}
          noValidate
        >
          {!verified && signedIn && (
            <Notice
              tone="warning"
              title="Verify your email to create alerts."
              actions={
                <Button
                  size="small"
                  variant="quiet"
                  onClick={() => push('/auth/verify?returnTo=%2Falerts%2Fnew')}
                >
                  Verify email
                </Button>
              }
            >
              You can fill in the alert now; it is kept on this device until you save it.
            </Notice>
          )}
          {formError && (
            <Notice
              tone="error"
              icon={TriangleAlert}
              role="alert"
              title={formError.message}
              actions={
                formError.existingId ? (
                  <Button
                    size="small"
                    variant="quiet"
                    onClick={() => push(`/alerts/${formError.existingId}/edit`)}
                  >
                    Open the existing alert
                  </Button>
                ) : formError.lost ? (
                  <Button
                    size="small"
                    variant="quiet"
                    icon={RefreshCw}
                    iconPosition="start"
                    pending={create.isPending}
                    onClick={() => void (lastInput.current ? persist(lastInput.current) : review())}
                  >
                    Check and try again
                  </Button>
                ) : formError.unverified ? (
                  <Button
                    size="small"
                    variant="quiet"
                    onClick={() => push('/auth/verify?returnTo=%2Falerts%2Fnew')}
                  >
                    Verify email
                  </Button>
                ) : undefined
              }
            >
              {formError.lost
                ? 'Trying again is safe: the same request cannot create a second alert.'
                : 'Your alert settings are still here.'}
            </Notice>
          )}
          <div>
            <h2 className={styles.label}>Company</h2>
            <CompanyCard
              instrument={instrument.data ?? null}
              onChange={() => setPickerOpen(true)}
              locked={false}
            />
            {errors.instrument && <p className={styles.error}>{errors.instrument}</p>}
          </div>
          <AlertFields
            draft={draft}
            setDraft={setDraft}
            instrument={instrument.data ?? null}
            errors={errors}
            setErrors={setErrors}
            mode="create"
            thresholdRef={thresholdRef}
          />
        </form>
      </Content>
      <ActionBar note={offline ? 'Reconnect to create alerts. Your draft is kept.' : undefined}>
        <Button
          type="submit"
          form="alert-form"
          full
          icon={Bell}
          iconPosition="start"
          pending={preview.isPending || create.isPending}
          disabledReason={
            offline
              ? 'Creating an alert needs a connection.'
              : !verified && signedIn
                ? 'Verify your email first.'
                : undefined
          }
        >
          Create alert
        </Button>
      </ActionBar>
      <Sheet
        open={confirming != null}
        onClose={() => setConfirming(null)}
        title="Confirm this alert"
        size="auto"
        footer={
          <>
            <Button full onClick={() => void confirm()} pending={create.isPending}>
              Create alert
            </Button>
            <Button full variant="quiet" onClick={() => setConfirming(null)}>
              Edit
            </Button>
          </>
        }
      >
        {confirming && (
          <div className={styles.confirm}>
            <p className={styles.confirmRule}>{summary}</p>
            {confirming.message && (
              <Notice tone="neutral" role="status">
                {confirming.message}
              </Notice>
            )}
            <p className="t-label t-muted">
              Delivered to{' '}
              {confirming.input.channels
                .map((channel) => (channel === 'inbox' ? 'your inbox' : channel))
                .join(', ')
                .replace(/, ([^,]*)$/, ' and $1')}
              .
            </p>
          </div>
        )}
      </Sheet>
      <CompanyPicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        earningsOnly={draft.type === 'earnings'}
        onChoose={(symbol) => {
          setDraft({ symbol, earningsId: null });
          setErrors({});
          setPickerOpen(false);
        }}
      />
      {guard}
    </ScreenBody>
  );
}

function ruleStatus(rule: AlertRule, timeZone: string): string {
  if (rule.state === 'paused')
    return 'Paused. It does not fire and keeps no backlog; resuming starts from the current price.';
  if (rule.state === 'fired')
    return `Completed ${rule.lastFiredAt ? formatDateTime(rule.lastFiredAt, timeZone) : ''}. One-time alerts stop after firing.`;
  if (rule.state === 'expired') return 'Expired. The event has passed.';
  if (rule.type === 'price' && rule.waitingForReset) {
    return rule.comparator === 'cross_above'
      ? 'Active. The price is already above the threshold, so it waits for a new crossing from below.'
      : 'Active. The price is already below the threshold, so it waits for a new crossing from above.';
  }
  if (rule.type === 'price' && rule.lastFiredAt)
    return `Active. Last fired ${formatDateTime(rule.lastFiredAt, timeZone)}.`;
  return 'Active.';
}

export function EditAlertScreen() {
  const { ruleId } = useParams();
  const query = useAlert(ruleId);
  const { push } = useAppNavigation();
  if (query.isPending) {
    return (
      <ScreenBody>
        <TopBar title="Edit alert" ruled />
        <div className={shared.block} style={{ display: 'grid', gap: 12, paddingTop: 16 }}>
          <Skeleton height={40} width="60%" />
          <Skeleton height={64} />
          <Skeleton height={200} />
        </div>
      </ScreenBody>
    );
  }
  if (!query.data) {
    return (
      <ScreenBody>
        <TopBar title="Edit alert" ruled />
        <Content>
          <EmptyState
            title="This alert no longer exists."
            actions={
              <Button full onClick={() => push('/alerts', { replace: true })}>
                See your alert rules
              </Button>
            }
          >
            It may have been deleted on another device. Alerts it already sent stay in your inbox.
          </EmptyState>
        </Content>
      </ScreenBody>
    );
  }
  return <EditAlertForm key={`${query.data.id}:${query.data.version}`} rule={query.data} />;
}

function EditAlertForm({ rule }: { rule: AlertRule }) {
  const instrument = useInstrument(rule.instrumentId);
  const queryClient = useQueryClient();
  const toast = useToast();
  const offline = useOffline();
  const userZone = useUserTimeZone();
  const { push } = useAppNavigation();
  const { confirm, element: confirmElement } = useConfirm();
  const initial: Draft = {
    symbol: rule.symbol,
    type: rule.type,
    comparator: rule.comparator ?? 'cross_above',
    threshold: rule.threshold ?? '',
    repeat: rule.repeat,
    push: rule.channels.includes('push'),
    email: rule.channels.includes('email'),
    earningsId: rule.earningsId,
  };
  const [draft, setDraftState] = useState<Draft>(initial);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [conflict, setConflict] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const thresholdRef = useRef<HTMLInputElement>(null);
  const setDraft = useMemo(
    () => (patch: Partial<Draft>) => setDraftState((current) => ({ ...current, ...patch })),
    [],
  );
  useDocumentTitle(`Edit alert · ${rule.symbol}`);

  const dirty = JSON.stringify(draft) !== JSON.stringify(initial);
  const guard = useUnsavedChangesGuard(
    dirty && !leaving,
    'Your changes to this alert have not been saved.',
  );

  const update = useMutation({
    mutationFn: (patch: Partial<AlertRuleInput>) => api.alerts.update(rule.id, patch, rule.version),
  });
  const pause = useMutation({
    mutationFn: (paused: boolean) => api.alerts.setPaused(rule.id, paused, rule.version),
  });

  const store = (saved: AlertRule) => {
    queryClient.setQueryData(qk.alert(saved.id), saved);
    queryClient.setQueryData<AlertRule[]>(qk.alerts, (current) =>
      current?.map((item) => (item.id === saved.id ? saved : item)),
    );
    void queryClient.invalidateQueries({ queryKey: qk.alerts });
  };

  const handleFailure = (failure: unknown) => {
    haptics.error();
    if (isApiError(failure) && failure.code === 'version_conflict') setConflict(true);
    else if (!applyFieldErrors(failure, setErrors)) setFormError(errorMessage(failure));
  };

  const save = async (event: FormEvent) => {
    event.preventDefault();
    setFormError(null);
    if (!instrument.data) return;
    if (draft.type === 'price') {
      const result = validateThreshold(draft.threshold, instrument.data);
      if (!result.ok) {
        setErrors({ threshold: result.message });
        thresholdRef.current?.focus();
        return;
      }
    }
    const input = toInput(draft, instrument.data, rule.reportId ?? undefined);
    try {
      const saved = await update.mutateAsync({
        comparator: input.comparator,
        threshold: input.threshold,
        repeat: input.repeat,
        channels: input.channels,
      });
      haptics.success();
      setLeaving(true);
      store(saved);
      toast({
        message: `Saved: ${describeRule(saved)}${saved.type === 'price' ? '. The condition starts from the current price.' : ''}`,
      });
    } catch (failure) {
      handleFailure(failure);
    }
  };

  const togglePause = async () => {
    try {
      const saved = await pause.mutateAsync(rule.state !== 'paused');
      haptics.success();
      setLeaving(true);
      store(saved);
      toast({
        message:
          saved.state === 'paused'
            ? `Paused ${describeRule(saved)}`
            : `Resumed ${describeRule(saved)}`,
      });
    } catch (failure) {
      handleFailure(failure);
    }
  };

  const remove = async () => {
    const ok = await confirm({
      title: 'Delete this alert?',
      body: `${describeRule(rule)} stops being checked. Alerts it already sent stay in your inbox.`,
      confirmLabel: 'Delete alert',
      destructive: true,
    });
    if (!ok) return;
    try {
      await api.alerts.remove(rule.id);
      haptics.success();
      setLeaving(true);
      queryClient.setQueryData<AlertRule[]>(qk.alerts, (current) =>
        current?.filter((item) => item.id !== rule.id),
      );
      queryClient.removeQueries({ queryKey: qk.alert(rule.id) });
      toast({ message: `Deleted ${describeRule(rule)}` });
      push('/alerts', { replace: true });
    } catch (failure) {
      handleFailure(failure);
    }
  };

  return (
    <ScreenBody>
      <TopBar title="Edit alert" ruled />
      <Content>
        <LargeTitle title={describeRule(rule)} size="title" />
        <div className={styles.status}>
          <Tag
            tone={
              rule.state === 'armed' ? 'positive' : rule.state === 'paused' ? 'warning' : 'neutral'
            }
          >
            {RULE_STATE_LABEL[rule.state]}
          </Tag>
          <p className="t-label t-muted">{ruleStatus(rule, userZone)}</p>
        </div>
        <form
          id="alert-edit"
          className={`${shared.form} ${shared.formNarrow}`}
          onSubmit={save}
          noValidate
        >
          {conflict && (
            <Notice
              tone="warning"
              icon={RefreshCw}
              role="alert"
              title="This alert changed on another device."
              actions={
                <Button
                  size="small"
                  variant="quiet"
                  onClick={() =>
                    void queryClient.invalidateQueries({ queryKey: qk.alert(rule.id) })
                  }
                >
                  Load the latest version
                </Button>
              }
            >
              Nothing was overwritten. Load the latest version, then apply your change again.
            </Notice>
          )}
          {formError && <Notice tone="error" icon={TriangleAlert} role="alert" title={formError} />}
          <div>
            <h2 className={styles.label}>Company</h2>
            <CompanyCard instrument={instrument.data ?? null} onChange={() => undefined} locked />
          </div>
          <AlertFields
            draft={draft}
            setDraft={setDraft}
            instrument={instrument.data ?? null}
            errors={errors}
            setErrors={setErrors}
            mode="edit"
            thresholdRef={thresholdRef}
          />
        </form>
        <SectionHeader title="Manage" size="small" />
        <div className={styles.manage}>
          {(rule.state === 'armed' || rule.state === 'paused') && (
            <Button
              variant="secondary"
              full
              icon={rule.state === 'paused' ? Play : Pause}
              iconPosition="start"
              pending={pause.isPending}
              disabledReason={offline ? 'Needs a connection.' : undefined}
              onClick={() => void togglePause()}
            >
              {rule.state === 'paused' ? 'Resume alert' : 'Pause alert'}
            </Button>
          )}
          <Button
            variant="danger"
            full
            icon={Trash2}
            iconPosition="start"
            disabledReason={offline ? 'Needs a connection.' : undefined}
            onClick={() => void remove()}
          >
            Delete alert
          </Button>
        </div>
      </Content>
      <ActionBar note={offline ? 'Reconnect to save changes.' : undefined}>
        <Button
          type="submit"
          form="alert-edit"
          full
          pending={update.isPending}
          disabledReason={
            !dirty
              ? 'Change a setting to save it.'
              : offline
                ? 'Saving needs a connection.'
                : undefined
          }
        >
          Save changes
        </Button>
      </ActionBar>
      {guard}
      {confirmElement}
    </ScreenBody>
  );
}
