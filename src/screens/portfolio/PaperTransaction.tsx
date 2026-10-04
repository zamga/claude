import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useRef, useState, type FormEvent } from 'react';
import { useSearchParams } from 'react-router';
import { useAppNavigation } from '@/app/navigation';
import { Button } from '@/components/Button';
import { LargeTitle, TopBar } from '@/components/Header';
import { RefreshCw, Search, TriangleAlert } from '@/components/icons';
import { ActionBar, Content, ScreenBody } from '@/components/Layout';
import { KeyValue, KeyValueList, List, Row } from '@/components/List';
import { Tag, Ticker } from '@/components/Market';
import { Sheet } from '@/components/Sheet';
import { Notice, Skeleton } from '@/components/Status';
import { Segmented } from '@/components/Tabs';
import { TextField } from '@/components/Form';
import { useToast } from '@/components/Toast';
import { formatMoney, formatQuantity, formatSignedMoney } from '@/domain/format';
import { previewTransaction } from '@/domain/ledger';
import { api } from '@/data/api';
import { errorMessage, isApiError } from '@/data/errors';
import { qk, useInstrument, usePosition, useQuote, useSearch } from '@/data/queries';
import type { TransactionInput } from '@/data/types';
import { newIdempotencyKey } from '@/data/transport';
import { useUnsavedChangesGuard } from '@/features/guard';
import { previewState } from '@/features/portfolio';
import { useOffline } from '@/features/status';
import { useDocumentTitle } from '@/features/title';
import { useDebounced } from '@/lib/hooks';
import { haptics } from '@/lib/haptics';
import shared from '../shared.module.css';
import styles from './Portfolio.module.css';

type Side = 'buy' | 'sell';
type Errors = Partial<Record<'quantity' | 'unitPrice' | 'fee' | 'form', string>>;

function InstrumentChooser({
  open,
  onClose,
  onChoose,
}: {
  open: boolean;
  onClose: () => void;
  onChoose: (symbol: string) => void;
}) {
  const [q, setQ] = useState('');
  const debounced = useDebounced(q, 250);
  const results = useSearch({ q: debounced, sort: 'relevance' }, open);
  return (
    <Sheet open={open} onClose={onClose} title="Choose a company" size="tall">
      <TextField
        label="Search"
        type="search"
        value={q}
        placeholder="Company or ticker"
        autoComplete="off"
        onChange={(event) => setQ(event.target.value)}
        trailing={<Search size={18} aria-hidden />}
      />
      <div style={{ marginTop: 12, marginInline: 'calc(-1 * var(--gutter))' }}>
        {results.data ? (
          <List label="Companies">
            {results.data
              .filter((result) => result.instrument.status === 'listed')
              .slice(0, 20)
              .map((result) => (
                <Row
                  key={result.instrument.id}
                  onPress={() => onChoose(result.instrument.symbol)}
                  title={<Ticker symbol={result.instrument.symbol} />}
                  detail={result.instrument.shortName}
                  dense
                />
              ))}
          </List>
        ) : (
          <div style={{ padding: '16px var(--gutter)' }}>
            <Skeleton height={44} />
          </div>
        )}
      </div>
    </Sheet>
  );
}

/**
 * Validated paper trade (spec pages 26, 33, 44): live preview, idempotent submission and a
 * confirmation that states the saved quantity and reference price.
 */
export default function PaperTransactionScreen() {
  const [params, setParams] = useSearchParams();
  const symbol = params.get('instrument');
  const instrument = useInstrument(symbol ?? undefined);
  const id = instrument.data?.status === 'listed' ? instrument.data.id : undefined;
  const detail = usePosition(id);
  const quote = useQuote(id);
  const fx = useQuery({
    queryKey: ['fx', id ?? ''],
    queryFn: () => api.portfolio.fxRate(id!),
    enabled: Boolean(id),
    staleTime: 60_000,
  });
  const queryClient = useQueryClient();
  const toast = useToast();
  const offline = useOffline();
  const { back } = useAppNavigation();
  const [chosenSide, setSide] = useState<Side>(params.get('side') === 'sell' ? 'sell' : 'buy');
  const [quantity, setQuantity] = useState('');
  const [price, setPrice] = useState<string | null>(null);
  const [fee, setFee] = useState('');
  const [errors, setErrors] = useState<Errors>({});
  const [formError, setFormError] = useState<{ message: string; lost?: boolean } | null>(null);
  const [chooser, setChooser] = useState(false);
  const [saved, setSaved] = useState(false);
  const keyRef = useRef<{ key: string; print: string } | null>(null);
  const quantityRef = useRef<HTMLInputElement>(null);
  useDocumentTitle(
    instrument.data ? `Update ${instrument.data.symbol} paper position` : 'Update paper position',
  );

  const quotePrice = quote.data?.price ?? null;
  const unitPrice = price ?? quotePrice ?? '';
  const priceSource: TransactionInput['priceSource'] =
    price == null && quotePrice != null ? 'observation' : 'manual';
  const held = detail.data ? Number(detail.data.position.units) : 0;
  // Selling needs units; without them the trade is a buy.
  const side: Side = chosenSide === 'sell' && detail.data && held === 0 ? 'buy' : chosenSide;

  const preview = useMemo(() => {
    if (!detail.data || !instrument.data || !fx.data) return null;
    return previewTransaction(previewState(detail.data), {
      side,
      instrumentId: instrument.data.id,
      quantity,
      unitPrice,
      fee,
      currency: instrument.data.currency,
      fxRate: fx.data,
    });
  }, [detail.data, instrument.data, fx.data, side, quantity, unitPrice, fee]);

  const dirty = quantity.trim() !== '' || price != null || fee.trim() !== '';
  const guard = useUnsavedChangesGuard(dirty && !saved, 'This paper trade has not been saved.');

  const mutation = useMutation({
    mutationFn: ({ input, key }: { input: TransactionInput; key: string }) =>
      api.portfolio.transact(input, key),
  });

  const submit = async (event?: FormEvent) => {
    event?.preventDefault();
    setFormError(null);
    if (!instrument.data || !preview) return;
    const nextErrors: Errors = { ...preview.errors };
    if (nextErrors.form === 'insufficient_cash') {
      nextErrors.form = `Not enough simulated cash: this needs ${formatMoney(preview.cashEffect!.abs().toFixed(2), 'USD')}, available ${formatMoney(detail.data!.cash, 'USD')}.`;
    }
    setErrors(nextErrors);
    if (nextErrors.quantity || nextErrors.form) return quantityRef.current?.focus();
    if (nextErrors.unitPrice || nextErrors.fee) return;
    const input: TransactionInput = {
      side,
      instrumentId: instrument.data.id,
      quantity: quantity.trim(),
      unitPrice: unitPrice.trim(),
      fee: fee.trim() || '0',
      priceSource,
    };
    const print = JSON.stringify(input);
    if (!keyRef.current || keyRef.current.print !== print)
      keyRef.current = { key: newIdempotencyKey(), print };
    try {
      const result = await mutation.mutateAsync({ input, key: keyRef.current.key });
      haptics.success();
      setSaved(true);
      queryClient.setQueryData(qk.position(instrument.data.id), result);
      void queryClient.invalidateQueries({ queryKey: ['private', 'portfolio'] });
      toast({
        message: `Saved: ${side === 'buy' ? 'bought' : 'sold'} ${formatQuantity(input.quantity)} ${instrument.data.symbol} at ${formatMoney(input.unitPrice, instrument.data.currency)} (paper). You now hold ${formatQuantity(result.position.units)}.`,
        durationMs: 6000,
      });
      back(`/portfolio/${instrument.data.symbol}`);
    } catch (failure) {
      haptics.error();
      if (isApiError(failure) && failure.code === 'timeout') {
        setFormError({ message: failure.message, lost: true });
      } else if (
        isApiError(failure) &&
        failure.code === 'validation' &&
        Object.keys(failure.fieldErrors).length
      ) {
        setErrors({
          ...(failure.fieldErrors as Errors),
          form: failure.message !== 'Check the highlighted fields.' ? failure.message : undefined,
        });
      } else {
        setFormError({ message: errorMessage(failure) });
      }
    }
  };

  const company = instrument.data;
  return (
    <ScreenBody>
      <TopBar title="Paper trade" ruled trailing={<Tag tone="outline">Paper</Tag>} />
      <Content>
        <LargeTitle
          title="Record a paper trade."
          size="title"
          subtitle="A simulation to track an idea. No order is placed and no money moves."
        />
        <form
          id="paper-trade"
          className={`${shared.form} ${shared.formNarrow}`}
          onSubmit={submit}
          noValidate
        >
          {formError && (
            <Notice
              tone="error"
              icon={TriangleAlert}
              role="alert"
              title={formError.message}
              actions={
                formError.lost ? (
                  <Button
                    size="small"
                    variant="quiet"
                    icon={RefreshCw}
                    iconPosition="start"
                    onClick={() => void submit()}
                  >
                    Check and try again
                  </Button>
                ) : undefined
              }
            >
              {formError.lost
                ? 'Trying again is safe: the same request cannot record the trade twice.'
                : 'Your entries are still here.'}
            </Notice>
          )}
          <div>
            <p className={styles.previewTitle} style={{ marginBottom: 8 }}>
              Company
            </p>
            {company ? (
              <Row
                as="div"
                title={<Ticker symbol={company.symbol} />}
                detail={`${company.shortName}${held ? ` · you hold ${formatQuantity(detail.data!.position.units)}` : ''}`}
                onPress={
                  symbol && params.get('locked') === '1' ? undefined : () => setChooser(true)
                }
                linkLabel={`${company.symbol}. Change company`}
              />
            ) : symbol && instrument.isPending ? (
              <Skeleton height={56} />
            ) : (
              <Button
                variant="secondary"
                full
                icon={Search}
                iconPosition="start"
                onClick={() => setChooser(true)}
              >
                Choose a company
              </Button>
            )}
            {company && company.status !== 'listed' && (
              <Notice tone="neutral" title="Not quoted yet.">
                Paper positions need a listed company with a quote.
              </Notice>
            )}
          </div>

          {company && id && (
            <>
              <Segmented
                label="Trade side"
                variant="accent"
                value={side}
                onChange={(value) => {
                  setSide(value);
                  setErrors({});
                }}
                items={[
                  { value: 'buy', label: 'Buy' },
                  { value: 'sell', label: 'Sell', disabled: held === 0 },
                ]}
              />
              {held === 0 && (
                <p className={styles.sourceNote}>
                  Sell becomes available once you hold {company.symbol}.
                </p>
              )}
              <TextField
                ref={quantityRef}
                label="Quantity"
                inputMode="decimal"
                autoComplete="off"
                placeholder="0"
                hint={
                  side === 'sell'
                    ? `You hold ${formatQuantity(detail.data?.position.units ?? '0')}.`
                    : 'Up to 6 decimal places.'
                }
                value={quantity}
                error={errors.quantity}
                onChange={(event) => {
                  setQuantity(event.target.value);
                  setErrors((current) => ({ ...current, quantity: undefined, form: undefined }));
                }}
              />
              <div>
                <TextField
                  label="Reference price"
                  prefix={company.currency === 'EUR' ? '€' : '$'}
                  inputMode="decimal"
                  autoComplete="off"
                  value={unitPrice}
                  error={errors.unitPrice}
                  onChange={(event) => {
                    setPrice(event.target.value);
                    setErrors((current) => ({ ...current, unitPrice: undefined }));
                  }}
                />
                <p className={styles.sourceNote} data-manual={priceSource === 'manual'}>
                  {priceSource === 'observation'
                    ? 'Current sample quote. Editing it records a manual price.'
                    : 'Manual price: recorded as entered, not the current quote.'}{' '}
                  {price != null && quotePrice && (
                    <button type="button" className="link" onClick={() => setPrice(null)}>
                      Use the current quote
                    </button>
                  )}
                </p>
              </div>
              <TextField
                label="Costs (optional)"
                prefix={company.currency === 'EUR' ? '€' : '$'}
                inputMode="decimal"
                autoComplete="off"
                placeholder="0.00"
                hint="Commissions or fees you want the simulation to include."
                value={fee}
                error={errors.fee}
                onChange={(event) => {
                  setFee(event.target.value);
                  setErrors((current) => ({ ...current, fee: undefined }));
                }}
              />
              {errors.form && (
                <Notice tone="error" icon={TriangleAlert} role="alert" title={errors.form} />
              )}
              <section
                className={styles.preview}
                aria-labelledby="preview-heading"
                aria-live="polite"
              >
                <h2 className={styles.previewTitle} id="preview-heading">
                  Preview
                </h2>
                {preview &&
                !preview.errors.quantity &&
                !preview.errors.unitPrice &&
                !preview.errors.fee &&
                preview.cashEffect ? (
                  <KeyValueList label="Preview" topRule={false}>
                    <KeyValue
                      label={side === 'buy' ? 'Cash used' : 'Cash received'}
                      value={formatSignedMoney(preview.cashEffect.toFixed(2), 'USD')}
                    />
                    {preview.resultingUnits && (
                      <KeyValue
                        label="Shares after"
                        value={formatQuantity(preview.resultingUnits.toFixed())}
                      />
                    )}
                    {preview.resultingCash && (
                      <KeyValue
                        label="Cash after"
                        value={formatMoney(preview.resultingCash.toFixed(2), 'USD')}
                      />
                    )}
                    {preview.realized && (
                      <KeyValue
                        label="Realized"
                        value={formatSignedMoney(preview.realized.toFixed(2), 'USD')}
                      />
                    )}
                    {company.currency !== 'USD' && (
                      <KeyValue label="FX used" value={`1 ${company.currency} = ${fx.data} USD`} />
                    )}
                  </KeyValueList>
                ) : (
                  <p className={styles.sourceNote}>
                    Enter a quantity to see the effect on cash and shares.
                  </p>
                )}
              </section>
            </>
          )}
        </form>
      </Content>
      <ActionBar note={offline ? 'Reconnect to save. Your entries stay here.' : undefined}>
        <Button
          type="submit"
          form="paper-trade"
          full
          pending={mutation.isPending}
          disabledReason={
            offline
              ? 'Saving needs a connection.'
              : !id
                ? 'Choose a listed company first.'
                : !fx.data
                  ? 'Waiting for an FX rate.'
                  : undefined
          }
        >
          {side === 'buy' ? 'Save paper buy' : 'Save paper sale'}
        </Button>
      </ActionBar>
      <InstrumentChooser
        open={chooser}
        onClose={() => setChooser(false)}
        onChoose={(next) => {
          setChooser(false);
          setPrice(null);
          setQuantity('');
          setErrors({});
          setParams({ instrument: next }, { replace: true });
        }}
      />
      {guard}
    </ScreenBody>
  );
}
