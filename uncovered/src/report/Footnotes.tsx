import { createContext, useContext, type ReactNode } from 'react';
import type { Source } from './types';

/*
 * Prose with markdown-style footnotes ("€2,041.0m[^r25]") and model bindings
 * ("a margin of {{implied.margin}}"). Each marker becomes a numbered superscript
 * linking to its source; numbering follows the order of the report's sources,
 * so a number means the same source everywhere. Each binding is filled from the
 * valuation engine and marked as the model's own figure.
 */

interface FootnoteContext {
  number: (id: string) => number;
  source: (id: string) => Source | undefined;
  /** Called with the source a reader points at, and the passage it was cited in. */
  onFocusSource?: (id: string | null, origin?: string) => void;
  prefix: string;
  /** False inside decorative, aria-hidden copies: markers render without links. */
  interactive: boolean;
  /** Where a followed footnote's target lands in the viewport; false to stay put. */
  scrollBlock: ScrollLogicalPosition | false;
  values: Record<string, string>;
  /** The address a note links to when opened on its own, e.g. in a new tab. */
  hrefFor: (id: string) => string;
}

const Ctx = createContext<FootnoteContext | null>(null);

/** The passage a footnote is cited from, so its source can be shown beside it. */
const Origin = createContext<string | undefined>(undefined);
export const CiteOrigin = Origin.Provider;

export function FootnoteProvider({
  sources,
  children,
  onFocusSource,
  prefix = 'src',
  interactive = true,
  scrollBlock = 'center',
  values = {},
  hrefFor,
}: {
  sources: Source[];
  children: ReactNode;
  onFocusSource?: (id: string | null, origin?: string) => void;
  prefix?: string;
  interactive?: boolean;
  scrollBlock?: ScrollLogicalPosition | false;
  values?: Record<string, string>;
  hrefFor?: (id: string) => string;
}) {
  const index = new Map(sources.map((s, i) => [s.id, i + 1]));
  const byId = new Map(sources.map((s) => [s.id, s]));
  return (
    <Ctx.Provider
      value={{
        number: (id) => index.get(id) ?? 0,
        source: (id) => byId.get(id),
        onFocusSource,
        prefix,
        interactive,
        scrollBlock,
        values,
        hrefFor: hrefFor ?? ((id) => `#${prefix}-${id}`),
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

const MARKER = /\[\^([\w-]+)\]/g;
const PART = /\[\^([\w-]+)\]|\{\{([\w.-]+)\}\}/g;

/** The source ids a text cites, in order of first appearance. */
export function citations(...texts: string[]): string[] {
  const seen = new Set<string>();
  for (const text of texts) for (const m of text.matchAll(MARKER)) seen.add(m[1]!);
  return [...seen];
}

/** The text with markers removed and bindings filled, for titles and plain-text uses. */
export function plain(text: string, values: Record<string, string> = {}): string {
  return text.replace(PART, (_, _id: string | undefined, key: string | undefined) => (key ? (values[key] ?? '—') : ''));
}

/**
 * Render text with footnote markers as superscript links and bindings as model
 * figures. Each marker is bound to the word before it, so a note number never
 * wraps onto a line by itself.
 */
export function Cited({ text, className }: { text: string; className?: string }) {
  const ctx = useContext(Ctx);
  if (!ctx) return <span className={className}>{plain(text)}</span>;
  const parts: ReactNode[] = [];
  let last = 0;
  for (const m of text.matchAll(PART)) {
    const at = m.index ?? 0;
    const before = text.slice(last, at);
    last = at + m[0].length;
    const key = m[2];
    if (key !== undefined) {
      if (before) parts.push(before);
      parts.push(
        <span key={`${key}-${at}`} className="bound" data-bound={key}>
          {ctx.values[key] ?? '—'}
        </span>,
      );
      continue;
    }
    const id = m[1]!;
    const split = before.search(/\S+$/);
    if (split > 0) parts.push(before.slice(0, split));
    else if (split < 0 && before) parts.push(before);
    parts.push(
      <span key={`${id}-${at}`} className="fn-bind">
        {split >= 0 ? before.slice(split) : null}
        <Ref id={id} />
      </span>,
    );
  }
  if (last < text.length) parts.push(text.slice(last));
  return <span className={className}>{parts}</span>;
}

export function Ref({ id }: { id: string }) {
  const ctx = useContext(Ctx);
  const origin = useContext(Origin);
  if (!ctx) return null;
  const n = ctx.number(id);
  const s = ctx.source(id);
  if (!n || !s) return null;
  if (!ctx.interactive)
    return (
      <sup className="fn" data-grade={s.grade}>
        <span>{n}</span>
      </sup>
    );
  return (
    <sup className="fn" data-grade={s.grade}>
      <a
        href={ctx.hrefFor(id)}
        aria-label={`Source ${n}: ${s.publisher}, ${s.title}`}
        onMouseEnter={() => ctx.onFocusSource?.(id, origin)}
        onFocus={() => ctx.onFocusSource?.(id, origin)}
        onMouseLeave={() => ctx.onFocusSource?.(null)}
        onBlur={() => ctx.onFocusSource?.(null)}
        onClick={(e) => {
          e.preventDefault();
          ctx.onFocusSource?.(id, origin);
          if (ctx.scrollBlock === false) return;
          const block = ctx.scrollBlock;
          const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
          // After the click has rendered the passage's source, bring it into view.
          requestAnimationFrame(() =>
            document
              .getElementById(`${ctx.prefix}-${id}`)
              ?.scrollIntoView({ block, behavior: reduce ? 'auto' : 'smooth' }),
          );
        }}
      >
        {n}
      </a>
    </sup>
  );
}

export function useFootnotes() {
  return useContext(Ctx);
}
