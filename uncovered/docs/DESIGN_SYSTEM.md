# Uncovered: design system

The system follows one idea, **the Certificate**: every report is treated as a printed security, with an engraved seal, a serial number, microtext rules and a footnote on every figure. Tokens live in `src/styles/tokens.css`; base styles in `src/styles/base.css`; every component styles itself with a CSS module that reads the tokens.

## Tokens

### Colour

Every colour is a custom property defined on bare `:root` (daylight), redefined for UV under `@media (prefers-color-scheme: dark) :root:not([data-theme='light'])` and again under `:root[data-theme='dark']`, so the system theme, the in-page UV switch and a host-set `data-theme` all resolve the same way. Print always uses the daylight values on white.

| Token                                 | Daylight                          | UV                                | Role                                                           |
| ------------------------------------- | --------------------------------- | --------------------------------- | -------------------------------------------------------------- |
| `--paper`                             | `#fbfbf8`                         | `#0d0c14`                         | Page ground                                                    |
| `--paper-2`                           | `#f2f3ee`                         | `#14121e`                         | Alternate section ground, formula panels                       |
| `--sheet`                             | `#ffffff`                         | `#16141f`                         | Report pages, cards, inputs                                    |
| `--ink`                               | `#101613`                         | `#eceaf4`                         | Text, rules, primary buttons                                   |
| `--ink-2`                             | `#3a433e`                         | `#bdb9cf`                         | Body copy                                                      |
| `--ink-3`                             | `#5c6661`                         | `#9692ad`                         | Secondary text; AA on every ground                             |
| `--rule` / `--rule-2`                 | `#dde2dd` / `#b4bdb7`             | `#272438` / `#413c58`             | Hairlines; stronger hairlines and bar stand-ins                |
| `--intaglio`                          | `#155e46`                         | `#63e4b8`                         | The engraving: seals, links, brand, the fair-value result      |
| `--ovi-a` → `--ovi-b`                 | `#14a386` → `#6b4bd6`             | `#63e4b8` → `#b79bff`             | Optically variable pair: seal sheen and primary action only    |
| `--grade-filed`                       | `#155e46`                         | `#63e4b8`                         | Evidence grade: audited statements and regulatory filings      |
| `--grade-reported`                    | `#8a5a00`                         | `#e6b85c`                         | Evidence grade: company releases, unaudited results, the press |
| `--grade-estimated`                   | `#5b4bb8`                         | `#b79bff`                         | Evidence grade: the model's own figures                        |
| `--method-dcf` / `-ddm` / `-multiple` | `#13805a` / `#6b4bd6` / `#b0560c` | `#2aa37f` / `#8c6af0` / `#c8762a` | Valuation methods (categorical)                                |
| `--focus`                             | `#6b4bd6`                         | `#b79bff`                         | Focus rings                                                    |

The three method colours are a categorical set, checked with the data-visualisation palette validator in both themes (lightness band, chroma floor, colour-blind separation over all pairs, normal-vision separation, contrast against the sheet). Daylight: worst colour-blind ΔE 9.0, normal-vision ΔE 20.8. UV: worst colour-blind ΔE 10.6, normal-vision ΔE 20.6. Every chart that uses them also labels each mark directly, so colour is never the only cue.

Evidence grades are reserved: they colour footnote numbers, source cards and the dotted underline of model figures, and nothing else.

### Type

| Token                | Value                                                                        | Use                                                            |
| -------------------- | ---------------------------------------------------------------------------- | -------------------------------------------------------------- |
| `--font-display`     | Bodoni Moda Variable (optical size 6–96), fallback Bodoni 72, Didot, Georgia | Headlines, company names, large numbers, formulas              |
| `--font-sans`        | Hanken Grotesk Variable, fallback Helvetica Neue, Arial                      | Everything else; figures are tabular by default                |
| `--t-micro`          | 6.5px                                                                        | Microtext rules (decorative, hidden from assistive technology) |
| `--t-2xs` … `--t-l`  | 11px … clamp(17px, 1rem + 0.3vw, 20px)                                       | Labels, captions, body                                         |
| `--t-xl` … `--t-3xl` | clamp(22px → 30px) … clamp(40px → 84px)                                      | Section and display headings                                   |
| `--t-hero`           | clamp(50px, 0.9rem + 8.4vw, 156px), capped at 12.5svh in the hero            | The front-page headline                                        |

Rules: Bodoni uses automatic optical sizing (forcing a large optical size at small sizes breaks its hairlines). Headings use `text-wrap: balance`; body uses `text-wrap: pretty`. Labels are capitals tracked 0.12–0.14em. Prose keeps a measure of 36–38em in the reader.

### Space and layout

`--s-1` … `--s-6` step 4px to 32px; `--s-7` … `--s-9` are fluid section spacings. `--page` is 90rem with a fluid `--gutter` of 16px to 48px. `--header-h` is 4rem; `--safe-top` carries the phone's status-bar inset into every sticky offset.

Page-like components (the report cover, the page thumbnails, the "how it works" sheet) are container-query containers and size everything inside them in `cqi`, so the same page scales from a thumbnail to the full report like print. A component's own padding is never set in its own container units; the container is always its parent or an outer element.

### Motion

| Token                 | Value                                                               |
| --------------------- | ------------------------------------------------------------------- |
| `--ease-engrave`      | `cubic-bezier(0.65, 0, 0.35, 1)`: drawing lines, growing bars       |
| `--ease-set`          | `cubic-bezier(0.2, 0.8, 0.2, 1)`: setting type, list items arriving |
| `--ease-out`          | `cubic-bezier(0.16, 1, 0.3, 1)`: everything else                    |
| `--dur-1` … `--dur-4` | 150, 280, 560, 900ms; all 1ms under reduced motion                  |

Every animation is a CSS keyframe gated by `prefers-reduced-motion: no-preference`, and every animated element rests in its final state, so a still frame (a thumbnail, a print, a reader who prefers less motion) is always complete. Full choreography is in `docs/STORYBOARD.md`.

## Components

| Component                           | File                            | Notes                                                                                                                                                                                                                                                                                                                                     |
| ----------------------------------- | ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Seal                                | `src/seal/Seal.tsx`             | Guilloche rosette generated from the company's name (`sealSpec`: lace, weave, rosette layers; FNV-1a seed, sfc32 generator). Canvas engraving, microtext ring and monogram in SVG. Draws only when it comes into view. The sheen is a conic gradient blended `lighten` (daylight) or `darken` (UV) over the ink, with no pixel read-back. |
| Cover                               | `src/report/Cover.tsx`          | The report's first page at A4 proportions (minimum height, so long names grow it). A pending cover shows redaction bars, never invented text. Tilts towards the pointer on desktop.                                                                                                                                                       |
| Serial                              | `src/ui/Serial.tsx`             | Numbering-machine digits on reels; read as one label by assistive technology.                                                                                                                                                                                                                                                             |
| Microtext                           | `src/ui/Microtext.tsx`          | Repeated capitals as rules; one variant appears only under UV.                                                                                                                                                                                                                                                                            |
| Cited / Ref                         | `src/report/Footnotes.tsx`      | Renders `[^id]` markers as numbered, grade-coloured footnotes bound to the word before them, and `{{key}}` tokens as model figures. Interactive, or static inside decorative copies.                                                                                                                                                      |
| SourceCard, GradeLegend, SourceList | `src/report/reader/Sources.tsx` | The evidence: number, grade, title, publisher, date, the quoted sentence, the address.                                                                                                                                                                                                                                                    |
| Exhibit                             | `src/report/reader/Figures.tsx` | Numbered caption above, note below, ink rule on top: the house style for every figure and table.                                                                                                                                                                                                                                          |
| FootballField                       | `src/report/FootballField.tsx`  | One € axis; method bars with base ticks and direct labels; fair-value band and bar; price and 52-week-high markers labelled away from each other; a hidden table for assistive technology.                                                                                                                                                |
| Sensitivity                         | `src/report/Sensitivity.tsx`    | 5×5 grid of DCF values, shaded by distance from the price in the method colours (diverging: above price, below price).                                                                                                                                                                                                                    |
| Masthead, Footer                    | `src/ui/`                       | Sticky masthead with the UV switch and the primary action; menu sheet on phones.                                                                                                                                                                                                                                                          |

## States

- **Focus**: a 2px `--focus` outline with an offset on every interactive element, including scrollable tables (which are focusable regions) and the file drop zone.
- **Hover**: links take `--intaglio`; primary buttons sweep the optically variable gradient across from the left; page thumbnails lift 8px and tilt 4°.
- **Current**: contents links use `aria-current="location"`, shown by an engraved rule and full ink.
- **Invalid**: fields take the reported-grade colour with a message that says what to enter; the first invalid field receives focus.
- **Model figures**: dotted underline in the estimated-grade colour.

## Responsive rules

| Width    | Changes                                                                                                                                                                                                                        |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| ≥ 80rem  | Reader in three columns: contents, report, source rail                                                                                                                                                                         |
| 64–80rem | Contents become a sticky bar of chips; source rail stays                                                                                                                                                                       |
| < 64rem  | One column. Each "how it works" act carries its own sheet; footnotes unfold their source under the paragraph instead of in a rail; the pending cover on the request page gives way to a seal engraved inside the company field |
| < 40rem  | Forms stack; the coverage table becomes labelled blocks (with explicit table roles); actions go full width                                                                                                                     |

Touch replaces hover deliberately: a tapped footnote unfolds its source in place, with a button to close it.

## Accessibility

WCAG 2.2 AA, checked with axe on every page in both themes on desktop and phone (`e2e/a11y.spec.ts`): skip link, landmarks, one `h1` per page that receives focus after navigation, visible focus everywhere, every footnote announced as "Source n: publisher, title", charts with text descriptions and hidden tables, decorative seals and microtext hidden from assistive technology, colour never the only cue, and a reduced-motion experience where everything is already in place.
