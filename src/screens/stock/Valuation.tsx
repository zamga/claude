import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useSearchParams } from 'react-router';
import { useSession } from '@/app/session';
import { Button } from '@/components/Button';
import { Slider, TextField } from '@/components/Form';
import { Eyebrow, LargeTitle, SectionHeader, TopBar } from '@/components/Header';
import { ArrowRight, Info } from '@/components/icons';
import { ActionBar, Content, ScreenBody } from '@/components/Layout';
import { KeyValue, KeyValueList } from '@/components/List';
import { Price } from '@/components/Market';
import { Sheet } from '@/components/Sheet';
import { DemoTag, EmptyState, Notice } from '@/components/Status';
import { useToast } from '@/components/Toast';
import { isDecimalString } from '@/domain/decimal';
import { formatClockWithZone, formatDate, formatMoney, formatPercent } from '@/domain/format';
import {
  clampToStep,
  EXIT_MULTIPLE_RANGE,
  evaluateScenario,
  MODEL_VERSION,
  type ScenarioName,
} from '@/domain/valuation';
import { api } from '@/data/api';
import { errorMessage } from '@/data/errors';
import { qk, useInstrument, useScenarios, useValuation } from '@/data/queries';
import type { Instrument, SavedScenario, ValuationModel } from '@/data/types';
import { newIdempotencyKey } from '@/data/transport';
import { useUnsavedChangesGuard } from '@/features/guard';
import { QueryState, useOffline } from '@/features/status';
import { useUserTimeZone } from '@/features/time';
import { useDocumentTitle } from '@/features/title';
import { AccountPrompt } from '@/features/watchlist';
import styles from './Valuation.module.css';

const NAMES: ScenarioName[] = ['bear', 'base', 'bull'];
const LABEL: Record<ScenarioName, string> = { bear: 'Bear', base: 'Base', bull: 'Bull' };

interface Draft {
  revenueGrowthPct: string;
  operatingMarginPct: string;
  exitPe: string;
}

function useFlash(value: string | null): boolean {
  const [flash, setFlash] = useState(false);
  const previous = useRef(value);
  useEffect(() => {
    if (previous.current === value) return;
    previous.current = value;
    setFlash(true);
    const timer = setTimeout(() => setFlash(false), 140);
    return () => clearTimeout(timer);
  }, [value]);
  return flash;
}

function ScenarioRow({
  name,
  value,
  vs,
  checked,
  onSelect,
}: {
  name: ScenarioName;
  value: string;
  vs: string | null;
  checked: boolean;
  onSelect: () => void;
}) {
  const flashValue = useFlash(value);
  return (
    <div
      role="radio"
      aria-checked={checked}
      tabIndex={checked ? 0 : -1}
      className={styles.scenarioRow}
      onClick={onSelect}
      onKeyDown={(event) => {
        if (event.key === ' ' || event.key === 'Enter') {
          event.preventDefault();
          onSelect();
        }
      }}
    >
      <span className={styles.name}>{LABEL[name]}</span>
      <span className={styles.cell} data-flash={flashValue}>
        {value}
      </span>
      <span className={styles.cell} data-flash={flashValue}>
        {vs ?? '—'}
      </span>
    </div>
  );
}

function ValuationView({ instrument, model }: { instrument: Instrument; model: ValuationModel }) {
  const [params, setParams] = useSearchParams();
  const selected = (params.get('scenario') as ScenarioName | null) ?? 'base';
  const zone = useUserTimeZone();
  const offline = useOffline();
  const { signedIn, verified } = useSession();
  const saved = useScenarios(instrument.id, signedIn);
  const toast = useToast();
  const queryClient = useQueryClient();
  const [intent, setIntent] = useState<{ kind: 'auth' } | { kind: 'verify' } | null>(null);
  const [assumptionsOpen, setAssumptionsOpen] = useState(false);
  const saveKey = useRef(newIdempotencyKey());
  useDocumentTitle(`${instrument.symbol} · Valuation`);

  const savedFor = (name: ScenarioName): SavedScenario | undefined =>
    saved.data?.find((item) => item.scenario === name && item.modelVersion === model.modelVersion);
  const initial = (name: ScenarioName): Draft => {
    const stored = savedFor(name);
    return stored ? { ...stored.assumptions } : { ...model.scenarios[name] };
  };
  const [drafts, setDrafts] = useState<Record<ScenarioName, Draft>>(() => ({
    bear: initial('bear'),
    base: initial('base'),
    bull: initial('bull'),
  }));
  const [adoptedSaved, setAdoptedSaved] = useState(false);
  // Saved assumptions replace the model defaults once, when they first arrive.
  if (!adoptedSaved && saved.data) {
    setAdoptedSaved(true);
    if (saved.data.length > 0)
      setDrafts({ bear: initial('bear'), base: initial('base'), bull: initial('bull') });
  }

  const base = {
    ...model.base,
    currency: model.currency,
    referencePrice: model.referencePrice,
    referenceAt: Date.parse(model.referenceAt),
  };
  const results = useMemo(
    () =>
      Object.fromEntries(
        NAMES.map((name) => {
          const draft = drafts[name];
          const valid = [draft.revenueGrowthPct, draft.operatingMarginPct, draft.exitPe].every(
            (value) => value.trim() === '' || isDecimalString(value),
          );
          return [
            name,
            valid
              ? evaluateScenario(base, {
                  revenueGrowthPct: draft.revenueGrowthPct || null,
                  operatingMarginPct: draft.operatingMarginPct || null,
                  exitPe: draft.exitPe || null,
                })
              : { ok: false as const, reason: 'Enter numbers only (for example 24 or 24.5).' },
          ];
        }),
      ) as Record<ScenarioName, ReturnType<typeof evaluateScenario>>,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [drafts, model],
  );

  const draft = drafts[selected];
  const reference = savedFor(selected) ?? null;
  const dirty = NAMES.some(
    (name) => JSON.stringify(drafts[name]) !== JSON.stringify(initial(name)),
  );
  const guard = useUnsavedChangesGuard(dirty, 'Your scenario edits have not been saved.');
  const update = (patch: Partial<Draft>) =>
    setDrafts((current) => ({ ...current, [selected]: { ...current[selected], ...patch } }));
  const result = results[selected];

  const saveMutation = useMutation({
    mutationFn: () =>
      api.scenarios.save(
        {
          instrumentId: instrument.id,
          modelVersion: model.modelVersion,
          scenario: selected,
          assumptions: draft,
          referencePrice: model.referencePrice,
          referenceAt: model.referenceAt,
        },
        saveKey.current,
      ),
    onSuccess: (savedScenario) => {
      saveKey.current = newIdempotencyKey();
      void queryClient.invalidateQueries({ queryKey: qk.scenarios(instrument.id) });
      toast({
        message: `${LABEL[selected]} scenario saved with reference price ${formatMoney(savedScenario.referencePrice, model.currency)}`,
      });
    },
  });

  const multiple = Number(draft.exitPe);
  const sliderValue = Number.isFinite(multiple)
    ? clampToStep(multiple, EXIT_MULTIPLE_RANGE)
    : EXIT_MULTIPLE_RANGE.min;
  const referenceAt = Date.parse(model.referenceAt);

  return (
    <ScreenBody>
      <TopBar title="Valuation" ruled />
      <Content>
        <LargeTitle
          eyebrow={`${instrument.symbol} / ${instrument.shortName}`}
          eyebrowTone="default"
          meta={<DemoTag label="Demo data" />}
          title={
            <>
              Price vs.
              <br />
              expectations.
            </>
          }
          subtitle={`Illustrative 12-month scenarios · model ${model.modelVersion} · base date ${formatDate(Date.parse(model.baseDate), zone)}`}
          subtitleSize="note"
        />
        <div className={styles.reference}>
          <Price value={model.referencePrice} currency={model.currency} size="hero" />
          <p className="t-label t-muted">
            Reference price at {formatClockWithZone(referenceAt, instrument.timeZone)},{' '}
            {formatDate(referenceAt, instrument.timeZone)} · values in {model.currency} per share
          </p>
        </div>

        <div className={styles.scenarios}>
          <div className={styles.scenarioHead} aria-hidden>
            <span>Scenario</span>
            <span>Value</span>
            <span>Vs. price</span>
          </div>
          <div role="radiogroup" aria-label="Scenario">
            {NAMES.map((name) => {
              const outcome = results[name];
              return (
                <ScenarioRow
                  key={name}
                  name={name}
                  checked={name === selected}
                  onSelect={() =>
                    setParams(name === 'base' ? {} : { scenario: name }, { replace: true })
                  }
                  value={
                    outcome.ok
                      ? formatMoney(outcome.valuePerShare.round(0).toFixed(0), model.currency, 0)
                      : '—'
                  }
                  vs={
                    outcome.ok ? formatPercent(outcome.vsReferencePct.round(0).toFixed(0), 0) : null
                  }
                />
              );
            })}
          </div>
          <p className="t-note t-muted" style={{ marginTop: 6 }}>
            Rounded sample values. Not a price target or a recommendation.
          </p>
        </div>

        {reference && (
          <div className={styles.savedNote}>
            <Notice tone="neutral" title={`Your saved ${LABEL[selected].toLowerCase()} scenario`}>
              Saved {formatDate(Date.parse(reference.savedAt), zone)} against{' '}
              {formatMoney(reference.referencePrice, model.currency)} at{' '}
              {formatClockWithZone(Date.parse(reference.referenceAt), instrument.timeZone)},{' '}
              {formatDate(Date.parse(reference.referenceAt), instrument.timeZone)}.
            </Notice>
          </div>
        )}

        <SectionHeader title={`${LABEL[selected]}-case assumptions`} />
        <p className="t-label t-muted" style={{ padding: '0 var(--gutter) 12px' }}>
          {model.scenarios[selected].narrative}
        </p>
        <div className={styles.inputs}>
          <TextField
            label="Revenue growth (%)"
            inputMode="decimal"
            value={draft.revenueGrowthPct}
            onChange={(event) => update({ revenueGrowthPct: event.target.value })}
          />
          <TextField
            label="Operating margin (%)"
            inputMode="decimal"
            value={draft.operatingMarginPct}
            onChange={(event) => update({ operatingMarginPct: event.target.value })}
          />
          <TextField
            label="Exit P/E (×)"
            inputMode="decimal"
            value={draft.exitPe}
            onChange={(event) => update({ exitPe: event.target.value })}
          />
        </div>

        {result.ok ? (
          <div className={styles.derived}>
            <KeyValueList label="Derived figures">
              <KeyValue
                label="Next-year revenue"
                value={`${formatMoney(result.revenueB.toFixed(1), model.currency, 1)}B`}
              />
              <KeyValue
                label="Operating income"
                value={`${formatMoney(result.operatingIncomeB.toFixed(1), model.currency, 1)}B`}
              />
              <KeyValue
                label={`Net income (after ${model.base.taxRatePct}% tax)`}
                value={`${formatMoney(result.netIncomeB.toFixed(1), model.currency, 1)}B`}
              />
              <KeyValue
                label={`EPS (${model.base.dilutedSharesB}B diluted shares)`}
                value={formatMoney(result.eps.toFixed(2), model.currency)}
              />
              <KeyValue
                label="Value per share (EPS × exit P/E)"
                value={formatMoney(result.valuePerShare.toFixed(2), model.currency)}
              />
            </KeyValueList>
          </div>
        ) : (
          <Notice tone="warning" icon={Info} role="status" title="No value for these inputs.">
            {result.reason}
          </Notice>
        )}

        <SectionHeader title="Sensitivity" />
        <div className={styles.sensitivity}>
          <Slider
            label="Exit multiple"
            min={EXIT_MULTIPLE_RANGE.min}
            max={EXIT_MULTIPLE_RANGE.max}
            step={EXIT_MULTIPLE_RANGE.step}
            value={sliderValue}
            format={(value) => `${value}×`}
            onChange={(value) => update({ exitPe: String(value) })}
            scale={[`${EXIT_MULTIPLE_RANGE.min}×`, `${EXIT_MULTIPLE_RANGE.max}×`]}
            hint={`Step ${EXIT_MULTIPLE_RANGE.step}×. Arrow keys move one step.`}
          />
        </div>
        <div className={styles.actions}>
          <Button
            variant="quiet"
            size="small"
            onClick={() => setDrafts((current) => ({ ...current, [selected]: initial(selected) }))}
          >
            {reference ? 'Reset to saved scenario' : 'Reset to published case'}
          </Button>
          {reference && (
            <Button
              variant="quiet"
              size="small"
              onClick={() =>
                setDrafts((current) => ({
                  ...current,
                  [selected]: { ...model.scenarios[selected] },
                }))
              }
            >
              Use published case
            </Button>
          )}
          <Button
            variant="quiet"
            size="small"
            icon={ArrowRight}
            onClick={() => setAssumptionsOpen(true)}
          >
            View model assumptions
          </Button>
        </div>
        {saveMutation.isError && (
          <Notice tone="error" role="alert" title={errorMessage(saveMutation.error)}>
            Your edits are still here.
          </Notice>
        )}
      </Content>
      <ActionBar>
        <Button
          full
          pending={saveMutation.isPending}
          disabledReason={
            offline
              ? 'Saving needs a connection.'
              : !result.ok
                ? 'Complete the assumptions to save.'
                : undefined
          }
          onClick={() => {
            if (!signedIn) return setIntent({ kind: 'auth' });
            if (!verified) return setIntent({ kind: 'verify' });
            saveMutation.mutate();
          }}
        >
          Save {LABEL[selected].toLowerCase()} scenario
        </Button>
      </ActionBar>
      <Sheet
        open={assumptionsOpen}
        onClose={() => setAssumptionsOpen(false)}
        title="Model assumptions"
        size="tall"
      >
        <div style={{ display: 'grid', gap: 16 }} className="t-body-sm">
          <p>
            Model {MODEL_VERSION}: a declared price-to-earnings model. Earnings are derived before
            the multiple is applied; an operating margin is never multiplied directly by a P/E.
          </p>
          <KeyValueList label="Base inputs">
            <KeyValue
              label="Revenue, trailing 12 months"
              value={`${formatMoney(model.base.baseRevenueB, model.currency, 1)}B`}
            />
            <KeyValue label="Diluted shares" value={`${model.base.dilutedSharesB}B`} />
            <KeyValue label="Effective tax rate" value={`${model.base.taxRatePct}%`} />
            <KeyValue label="Units" value={model.units} />
            <KeyValue label="Author" value={model.author} />
          </KeyValueList>
          <ol style={{ display: 'grid', gap: 6, paddingLeft: 18, listStyle: 'decimal' }}>
            <li>Next-year revenue = base revenue × (1 + revenue growth)</li>
            <li>Operating income = revenue × operating margin</li>
            <li>Net income = operating income × (1 − tax rate)</li>
            <li>EPS = net income ÷ diluted shares</li>
            <li>Value per share = EPS × exit P/E</li>
          </ol>
          <p className="t-label t-muted">
            Illustrative inputs from sample sources. Missing or contradictory inputs produce an
            explanation instead of a value.
          </p>
        </div>
      </Sheet>
      <AccountPrompt
        intent={intent}
        onClose={() => setIntent(null)}
        what="Create a free account or sign in to save scenarios with their reference date."
      />
      {guard}
    </ScreenBody>
  );
}

export default function ValuationScreen() {
  const { symbol = '' } = useParams();
  const instrument = useInstrument(symbol);
  return (
    <QueryState query={instrument}>{(data) => <ValuationLoader instrument={data} />}</QueryState>
  );
}

function ValuationLoader({ instrument }: { instrument: Instrument }) {
  const model = useValuation(instrument.id);
  return (
    <QueryState
      query={model}
      notFound={
        <ScreenBody>
          <TopBar title="Valuation" ruled />
          <EmptyState title="No valuation model is published for this company." size="section">
            <Eyebrow tone="muted">{instrument.symbol}</Eyebrow>
            <span style={{ display: 'block', marginTop: 8 }}>
              Scenario models appear with selected research notes.
            </span>
          </EmptyState>
        </ScreenBody>
      }
    >
      {(data) => <ValuationView instrument={instrument} model={data} />}
    </QueryState>
  );
}
