import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router';
import { useAppNavigation } from '@/app/navigation';
import { Button } from '@/components/Button';
import { SelectField } from '@/components/Form';
import { Eyebrow, LargeTitle, SectionHeader, TopBar, TopBarLabel } from '@/components/Header';
import { IconButton } from '@/components/IconButton';
import { ICON_STROKE, Search, SlidersHorizontal, X } from '@/components/icons';
import { Content, ScreenBody } from '@/components/Layout';
import { List } from '@/components/List';
import { Sheet } from '@/components/Sheet';
import { DemoTag, EmptyState, InlineError, SkeletonRows } from '@/components/Status';
import { Segmented } from '@/components/Tabs';
import { errorMessage, isOfflineError } from '@/data/errors';
import { useSearch, useSectors } from '@/data/queries';
import type { Interest, MarketCap, Region, SearchQuery } from '@/data/types';
import { InstrumentRow } from '@/features/InstrumentRow';
import { useOffline } from '@/features/status';
import { useDocumentTitle } from '@/features/title';
import { useDebounced, useDelayedFlag } from '@/lib/hooks';
import { readJson, writeJson } from '@/lib/storage';
import styles from './Search.module.css';

type Sort = NonNullable<SearchQuery['sort']>;
interface Filters {
  region: Region | 'all';
  sector: string;
  marketCap: MarketCap | 'any';
  setup: Interest | 'any';
}

const RECENT_KEY = 'stockpicks.search.recent.v1';
const THEMES = [
  'Semiconductors',
  'AI infrastructure',
  'Software',
  'New listings',
  'Quality',
  'Energy',
];
const SORTS: { value: Sort; label: string }[] = [
  { value: 'relevance', label: 'Relevance' },
  { value: 'change', label: 'Daily change' },
  { value: 'name', label: 'Name' },
  { value: 'marketCap', label: 'Market cap' },
];
const DEFAULT_FILTERS: Filters = { region: 'all', sector: 'all', marketCap: 'any', setup: 'any' };

function filtersFrom(params: URLSearchParams): Filters {
  return {
    region: (params.get('region') as Region | null) ?? 'all',
    sector: params.get('sector') ?? 'all',
    marketCap: (params.get('cap') as MarketCap | null) ?? 'any',
    setup: (params.get('setup') as Interest | null) ?? 'any',
  };
}

function labelFor(key: keyof Filters, value: string): string {
  if (key === 'region') return value === 'US' ? 'United States' : 'Europe';
  if (key === 'marketCap') return `${value[0]!.toUpperCase()}${value.slice(1)} cap`;
  if (key === 'setup')
    return value === 'ipo' ? 'IPO setup' : `${value[0]!.toUpperCase()}${value.slice(1)} setup`;
  return value;
}

function FilterSheet({
  open,
  onClose,
  committed,
  q,
  sort,
  onApply,
}: {
  open: boolean;
  onClose: () => void;
  committed: Filters;
  q: string;
  sort: Sort;
  onApply: (filters: Filters) => void;
}) {
  const [draft, setDraft] = useState(committed);
  const [wasOpen, setWasOpen] = useState(open);
  const sectors = useSectors();
  // Each opening starts from the committed filters (adjusting state on a prop change, not in an effect).
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setDraft(committed);
  }
  const preview = useSearch(
    {
      q,
      sort,
      region: draft.region,
      sector: draft.sector,
      marketCap: draft.marketCap,
      setup: draft.setup,
    },
    open,
  );
  const count = preview.data?.length;
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Refine results"
      size="tall"
      footer={
        <>
          <Button full onClick={() => onApply(draft)} pending={preview.isFetching && count == null}>
            {count == null ? 'Show results' : `Show ${count} result${count === 1 ? '' : 's'}`}
          </Button>
          <Button full variant="text" onClick={() => setDraft(DEFAULT_FILTERS)}>
            Reset filters
          </Button>
        </>
      }
    >
      <div style={{ display: 'grid', gap: 20 }}>
        <div className={styles.sheetGroup}>
          <span className={styles.sheetLabel} id="f-market">
            Market
          </span>
          <Segmented
            label="Market"
            value={draft.region}
            onChange={(region) => setDraft({ ...draft, region })}
            items={[
              { value: 'all', label: 'All' },
              { value: 'US', label: 'US' },
              { value: 'EU', label: 'Europe' },
            ]}
          />
        </div>
        <SelectField
          label="Sector"
          value={draft.sector}
          onChange={(event) => setDraft({ ...draft, sector: event.target.value })}
          options={[
            { value: 'all', label: 'All sectors' },
            ...(sectors.data ?? []).map((sector) => ({ value: sector, label: sector })),
          ]}
        />
        <div className={styles.sheetGroup}>
          <span className={styles.sheetLabel}>Market cap</span>
          <Segmented
            label="Market cap"
            value={draft.marketCap}
            onChange={(marketCap) => setDraft({ ...draft, marketCap })}
            items={[
              { value: 'any', label: 'Any' },
              { value: 'large', label: 'Large' },
              { value: 'mid', label: 'Mid' },
              { value: 'small', label: 'Small' },
            ]}
          />
        </div>
        <div className={styles.sheetGroup}>
          <span className={styles.sheetLabel}>Setup</span>
          <Segmented
            label="Setup"
            variant="accent"
            value={draft.setup}
            onChange={(setup) => setDraft({ ...draft, setup })}
            items={[
              { value: 'any', label: 'Any' },
              { value: 'earnings', label: 'Earnings' },
              { value: 'ipo', label: 'IPO' },
              { value: 'quality', label: 'Quality' },
            ]}
          />
        </div>
        <p className="t-label t-muted">
          Changes apply when you choose Show results. Closing keeps your current filters.
        </p>
      </div>
    </Sheet>
  );
}

export default function SearchScreen() {
  const [params, setParams] = useSearchParams();
  const { back } = useAppNavigation();
  const offline = useOffline();
  const inputRef = useRef<HTMLInputElement>(null);
  const [text, setText] = useState(params.get('q') ?? '');
  const debounced = useDebounced(text, 250);
  const committed = useMemo(() => filtersFrom(params), [params]);
  const sort = (params.get('sort') as Sort | null) ?? 'relevance';
  const [sheetOpen, setSheetOpen] = useState(false);
  const [recent, setRecent] = useState<string[]>(
    () => readJson<string[]>('local', RECENT_KEY) ?? [],
  );
  useDocumentTitle('Find a pick');

  // Typing searches after 250 ms of quiet; the URL keeps the committed query for Back and refresh.
  useEffect(() => {
    const next = new URLSearchParams(params);
    if (debounced.trim()) next.set('q', debounced.trim());
    else next.delete('q');
    if (next.toString() !== params.toString()) setParams(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debounced]);

  const q = params.get('q') ?? '';
  const query: SearchQuery = {
    q,
    sort,
    region: committed.region,
    sector: committed.sector,
    marketCap: committed.marketCap,
    setup: committed.setup,
  };
  const results = useSearch(query);
  const slowLoading = useDelayedFlag(results.isFetching, 150);
  const activeFilters = (Object.keys(committed) as (keyof Filters)[]).filter(
    (key) => committed[key] !== DEFAULT_FILTERS[key],
  );

  const rememberSearch = (value: string) => {
    const clean = value.trim();
    if (!clean) return;
    const next = [
      clean,
      ...recent.filter((item) => item.toLowerCase() !== clean.toLowerCase()),
    ].slice(0, 6);
    setRecent(next);
    writeJson('local', RECENT_KEY, next);
  };

  const applyFilters = (filters: Filters) => {
    const next = new URLSearchParams(params);
    const set = (key: string, value: string, empty: string) =>
      value === empty ? next.delete(key) : next.set(key, value);
    set('region', filters.region, 'all');
    set('sector', filters.sector, 'all');
    set('cap', filters.marketCap, 'any');
    set('setup', filters.setup, 'any');
    setParams(next, { replace: true });
    setSheetOpen(false);
  };

  const removeFilter = (key: keyof Filters) =>
    applyFilters({ ...committed, [key]: DEFAULT_FILTERS[key] });
  const clearAll = () => {
    setText('');
    setParams({}, { replace: true });
    inputRef.current?.focus();
  };

  return (
    <ScreenBody tabBar>
      <TopBar
        leading={<TopBarLabel>Discover</TopBarLabel>}
        trailing={<IconButton icon={X} label="Close search" onClick={() => back('/')} />}
      />
      <Content>
        <LargeTitle title="Find a pick." meta={<DemoTag label="Demo data" />} />
        <form
          className={styles.searchRow}
          role="search"
          onSubmit={(event) => {
            event.preventDefault();
            rememberSearch(text);
            inputRef.current?.blur();
          }}
        >
          <div className={styles.searchField}>
            <Search className={styles.searchIcon} size={20} strokeWidth={ICON_STROKE} aria-hidden />
            <label htmlFor="search-input" className="visually-hidden">
              Search by company, ticker or research theme
            </label>
            <input
              id="search-input"
              ref={inputRef}
              className={styles.input}
              type="search"
              inputMode="search"
              enterKeyHint="search"
              autoComplete="off"
              autoCapitalize="none"
              spellCheck={false}
              placeholder="Company, ticker or theme"
              value={text}
              onChange={(event) => setText(event.target.value)}
              onBlur={() => rememberSearch(text)}
              aria-describedby="search-status"
            />
            {text && (
              <span className={styles.clear}>
                <IconButton icon={X} label="Clear search" size={18} onClick={clearAll} />
              </span>
            )}
          </div>
        </form>
        <div className={styles.chips}>
          {activeFilters.map((key) => (
            <span key={key} className={styles.chip}>
              {labelFor(key, committed[key])}
              <button
                type="button"
                className={styles.chipRemove}
                aria-label={`Remove filter ${labelFor(key, committed[key])}`}
                onClick={() => removeFilter(key)}
              >
                <X size={14} strokeWidth={ICON_STROKE} aria-hidden />
              </button>
            </span>
          ))}
          <Button
            variant="quiet"
            size="small"
            icon={SlidersHorizontal}
            iconPosition="start"
            onClick={() => setSheetOpen(true)}
          >
            {activeFilters.length ? `Filters · ${activeFilters.length}` : 'Filters'}
          </Button>
          {activeFilters.length > 0 && (
            <Button variant="text" size="small" onClick={() => applyFilters(DEFAULT_FILTERS)}>
              Reset
            </Button>
          )}
        </div>

        {!q && activeFilters.length === 0 && (
          <>
            {recent.length > 0 && (
              <>
                <SectionHeader
                  title="Recent searches"
                  size="small"
                  aside={
                    <Button
                      variant="text"
                      size="small"
                      onClick={() => {
                        setRecent([]);
                        writeJson('local', RECENT_KEY, null);
                      }}
                    >
                      Clear
                    </Button>
                  }
                />
                <div className={styles.chips} style={{ paddingTop: 0 }}>
                  {recent.map((item) => (
                    <button
                      key={item}
                      type="button"
                      className={styles.themeChip}
                      onClick={() => setText(item)}
                    >
                      {item}
                    </button>
                  ))}
                </div>
              </>
            )}
            <SectionHeader title="Research themes" size="small" />
            <div className={styles.chips} style={{ paddingTop: 0 }}>
              {THEMES.map((theme) => (
                <button
                  key={theme}
                  type="button"
                  className={styles.themeChip}
                  onClick={() => setText(theme)}
                >
                  {theme}
                </button>
              ))}
            </div>
          </>
        )}

        <div className={styles.toolbar}>
          <span className={styles.count} id="search-status" role="status" aria-live="polite">
            {results.data
              ? `${results.data.length} result${results.data.length === 1 ? '' : 's'}${q ? ` for “${q}”` : ''}${slowLoading ? ' · updating…' : ''}`
              : slowLoading
                ? 'Searching…'
                : ''}
          </span>
          <div className={styles.sort}>
            <SelectField
              label="Sort results"
              hideLabel
              value={sort}
              onChange={(event) => {
                const next = new URLSearchParams(params);
                if (event.target.value === 'relevance') next.delete('sort');
                else next.set('sort', event.target.value);
                setParams(next, { replace: true });
              }}
              options={SORTS}
            />
          </div>
        </div>

        {results.isError &&
          !results.data &&
          (isOfflineError(results.error) || offline ? (
            <EmptyState
              size="section"
              title="You’re offline."
              actions={
                <Button variant="quiet" onClick={() => void results.refetch()}>
                  Try again
                </Button>
              }
            >
              Search needs a connection. Your query is kept; recent searches stay available.
            </EmptyState>
          ) : (
            <InlineError
              message={errorMessage(results.error)}
              onRetry={() => void results.refetch()}
              retrying={results.isFetching}
            />
          ))}
        {results.isError && results.data && (
          <InlineError
            message={`${errorMessage(results.error)} Showing the previous results.`}
            onRetry={() => void results.refetch()}
          />
        )}
        {results.isPending && results.fetchStatus === 'paused' && (
          <EmptyState size="section" title="You’re offline.">
            Search needs a connection. Your query “{q}” is kept.
          </EmptyState>
        )}
        {results.isPending && results.fetchStatus === 'fetching' && slowLoading && (
          <SkeletonRows rows={4} />
        )}

        {results.data && results.data.length === 0 && (
          <EmptyState
            size="section"
            title="No companies match these filters."
            actions={
              <>
                {activeFilters.length > 0 && (
                  <Button full variant="secondary" onClick={() => applyFilters(DEFAULT_FILTERS)}>
                    Clear filters
                  </Button>
                )}
                <Button full variant="quiet" onClick={() => inputRef.current?.focus()}>
                  Edit search
                </Button>
              </>
            }
          >
            Try a ticker such as NVDA, a company name, or a theme like Semiconductors.
          </EmptyState>
        )}
        {results.data && results.data.length > 0 && (
          <div
            style={{
              opacity: results.isPlaceholderData ? 0.6 : 1,
              transition: 'opacity var(--dur-feedback) var(--ease-standard)',
            }}
          >
            <List label="Search results">
              {results.data.map((result) => (
                <InstrumentRow
                  key={result.instrument.id}
                  symbol={result.instrument.symbol}
                  name={result.instrument.shortName}
                  to={`/stocks/${result.instrument.symbol}`}
                  quote={result.quote}
                  sparkline={result.sparkline}
                  meta={
                    result.instrument.status === 'pending'
                      ? 'Pending listing'
                      : `${result.instrument.industry} · ${result.instrument.region === 'US' ? 'US' : 'Europe'}`
                  }
                />
              ))}
            </List>
            <Eyebrow tone="muted" className={styles.count}>
              <span style={{ display: 'block', padding: '12px var(--gutter)' }}>
                Covered universe of this demo build
              </span>
            </Eyebrow>
          </div>
        )}
      </Content>
      <FilterSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        committed={committed}
        q={q}
        sort={sort}
        onApply={applyFilters}
      />
    </ScreenBody>
  );
}
