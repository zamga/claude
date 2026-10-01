# Design system

Plimsoll's interface is an Admiralty chart sheet: paper ground, hairline rules, a strict survey grid, and colour reserved for the chart itself. Tokens live in `src/styles/tokens.css` and are the only place a colour, size or duration is defined. Components consume them through CSS modules, so a theme or a brand change is a token change.

## 1. Tokens

### Colour

Two palettes follow real chart-display conventions: **Day chart** (paper) and **Night watch** (a dimmed bridge display that keeps night vision). Night watch is designed, not inverted: every step was chosen against its own surface. It applies with `prefers-color-scheme: dark` unless the visitor picked Day in the header, and `data-theme` on `<html>` overrides both.

| Token | Role | Day | Night |
|---|---|---|---|
| `--paper` | Page ground | `#f3f5f1` | `#071219` |
| `--paper-raised` | Cards, dialogs, inputs | `#fbfcf9` | `#0c1a23` |
| `--paper-sunken` | Wells, table stripes | `#e8ece8` | `#040c11` |
| `--ink` | Primary text, heavy rules | `#0d1b26` | `#dbe4e7` |
| `--ink-2` | Secondary text | `#33434e` | `#aebbc1` |
| `--ink-3` | Captions, axis labels | `#56656f` | `#8797a0` |
| `--rule` | Hairlines (decorative) | `#c8d0d1` | `#1d303b` |
| `--rule-strong` | Input borders, control outlines | `#7a8890` | `#56707d` |
| `--water-ink` | The market's words (always italic) | `#1c5a80` | `#86bfdf` |
| `--water-1` / `--water-2` | Shallows, deep-water fade | `#c9e2ec` / `#e1eef1` | `#0e2d3e` / `#0a2230` |
| `--water-line` | Waterline, sea-level rules | `#6fa3bf` | `#2f6684` |
| `--land-1` → `--land-3` | Hypsometric tints, low to high | `#efe3b9` → `#cbb26a` | `#2a2716` → `#5a4e2a` |
| `--land-ink` | Text on land | `#6f5a1f` | `#cdb877` |
| `--intertidal` / `--intertidal-ink` | Drying banks: inside your margin of safety | `#b8d2a5` / `#31531f` | `#1f3824` / `#9fd08c` |
| `--mark-land` / `--mark-water` | Data marks: histogram bars, slider markers | `#a86b12` / `#1f6fa8` | `#bf8426` / `#3a8ac0` |
| `--signal` | Chart magenta: your bearing, the coastline, primary actions, focus | `#b0126c` | `#f26ab8` |
| `--good` / `--caution` / `--danger` | Status only, always with a word | `#2f6b2a` / `#8a5a00` / `#9c2230` | `#8fd18a` / `#e7b85c` / `#ff8f96` |

Rules:

1. **Magenta is a verb.** `--signal` marks what you can act on or must notice: the bearing, the coastline, the focused control, the primary button. It never decorates.
2. **Italic is water.** Anything that belongs to the market (the price, what the price implies) is set in italic `--water-ink`. Anything about the company is upright. The rule holds in prose, labels, the chart and the poster.
3. **Status never travels alone.** `--good`, `--caution` and `--danger` always come with a label ("above the load line", "thin freeboard", "under water").
4. **Text wears text tokens.** Values and labels use ink tokens; a coloured mark beside them carries the identity.

#### Measured contrast (WCAG 2.2)

| Pair | Day | Night | Requirement |
|---|---|---|---|
| `--ink` on `--paper` | 15.9 : 1 | 14.7 : 1 | 4.5 : 1 text |
| `--ink-2` on `--paper` | 9.3 : 1 | 9.6 : 1 | 4.5 : 1 text |
| `--ink-3` on `--paper` | 5.5 : 1 | 6.3 : 1 | 4.5 : 1 text |
| `--water-ink` on `--paper` | 6.8 : 1 | 9.5 : 1 | 4.5 : 1 text |
| `--water-ink` on `--water-1` | 5.5 : 1 | 7.2 : 1 | 4.5 : 1 text |
| `--land-ink` on `--land-1` | 5.2 : 1 | 7.7 : 1 | 4.5 : 1 text |
| `--intertidal-ink` on `--intertidal` | 5.4 : 1 | 7.2 : 1 | 4.5 : 1 text |
| `--signal` on `--paper` | 6.1 : 1 | 6.8 : 1 | 4.5 : 1 text, 3 : 1 focus |
| `--signal-ink` on `--signal` | 6.7 : 1 | 7.0 : 1 | 4.5 : 1 text |
| `--rule-strong` on `--paper` | 3.3 : 1 | 3.6 : 1 | 3 : 1 non-text |

The data-mark pair was run through the colour-vision validator (OKLab ΔE ×100, adjacent pairs, Machado simulation): **Day** protan ΔE 20.7, tritan 21.6, normal 24.4; **Night** protan 21.2, tritan 22.5, normal 24.3. Both pass the lightness band, chroma floor and 3 : 1 contrast against their surface. Land and water also differ in lightness and in pattern (water is drawn with waterlines), so the chart reads in greyscale and in forced-colours mode.

### Typography

| Token | Face | Use |
|---|---|---|
| `--font-display` | Newsreader Display (opsz 60, wght 300–560) | Headlines, the reading's big values, glossary terms |
| `--font-text` | Newsreader Text (opsz 14, wght 380–560) | Lede, prose, method |
| `--font-sans` | Archivo (wght 300–800, wdth 62–100) | Interface, labels, tables, figures |

Scale (fluid between 320 px and 1,600 px viewports):

| Step | Size | Use |
|---|---|---|
| `--step--2` | 0.72 rem | Eyebrows, axis ticks |
| `--step--1` | 0.84 rem | Captions, table heads |
| `--step-0` | 1 rem | Interface text |
| `--step-1` | 1.13 → 1.32 rem | Lede, reading sentences |
| `--step-2` | 1.38 → 1.85 rem | Card titles, footer motto |
| `--step-3` | 1.8 → 2.75 rem | Section heads |
| `--step-4` | 2.4 → 4.4 rem | Page titles |
| `--step-5` | 3 → 7.6 rem | The hero headline |

Rules: headlines track tight (−0.035 em) at weight 360; numbers are tabular lining figures (`.num`); condensed draft-mark numerals (`.draft`, Archivo at 62% width) appear only where a hull would carry them: the gauge, the chart's price levels and the step numbers. Reading measure is 64 ch.

Fonts are self-hosted and built by `scripts/fonts.py`. Each face is split by `unicode-range`: the core file (ASCII plus the punctuation the interface prints) is the one preloaded, 114 KB for the three faces above the fold; accented Latin downloads only on a page that needs it. Metric-matched fallbacks (`size-adjust`, ascent and descent overrides) keep the swap from shifting the layout.

### Space, layout and shape

| Token | Value |
|---|---|
| `--space-3xs` … `--space-s` | 0.25, 0.5, 0.75, 1 rem |
| `--space-m` … `--space-2xl` | fluid: 1.25→1.6, 1.75→2.6, 2.5→4.5, 3.5→7.5 rem |
| `--gutter` | 1 → 2.5 rem page margin |
| `--page-max` | 92 rem |
| `--measure` | 64 ch |
| `--header-h` | 3.75 rem |
| `--radius-s` / `--radius-m` | 2 px / 4 px. Charts are square-cornered; only controls soften |

The grid is a 12-column survey grid. The hero splits 5 : 7 with the chart bleeding to the right edge; the chart bench splits chart and hull gauge; the method page runs a 13 rem table of contents beside the text. Sections are composed as spreads: a heavy rule opens each, hairlines divide inside it.

### Motion

| Token | Value | Use |
|---|---|---|
| `--ease-buoy` | `cubic-bezier(0.16, 1, 0.3, 1)` | Arrivals: things surface and settle |
| `--ease-tide` | `cubic-bezier(0.45, 0, 0.2, 1)` | Level changes: the sea, the gauge, company switches |
| `--ease-out` | `cubic-bezier(0.22, 1, 0.36, 1)` | Small state changes |
| `--dur-1` … `--dur-4` | 140, 260, 480, 900 ms | Hover, toggles, panels, sections |
| `--dur-tide` | 1,400 ms | Sea level and hull |

Nothing bounces or overshoots. Only `transform`, `opacity` and `clip-path` animate. Under `prefers-reduced-motion: reduce` every duration becomes 1 ms, the chart opens flat, the hero stops swaying and View Transitions are skipped; every reading is unchanged. The full choreography is in [STORYBOARD.md](STORYBOARD.md).

## 2. Components and states

Every interactive element has the same focus treatment: a 2 px `--signal` outline at 3 px offset on `:focus-visible`, never removed. Targets are at least 24 × 24 CSS px (WCAG 2.2, 2.5.8); primary controls are 40 px or more.

| Component | Where | States and behaviour |
|---|---|---|
| **Header** (`ui/Header`) | Every page | Sticky, translucent paper with backdrop blur. The current page's link carries `aria-current` and a magenta rule. The search button opens the command palette. The theme switch is a radiogroup: Auto, Day, Night. Below 60 rem search collapses to its icon; below 48 rem links and theme move into a menu sheet (`aria-expanded`, Escape closes). |
| **Command palette** (`ui/CommandPalette`) | ⌘K, Ctrl+K, `/`, the search button | Native modal `<dialog>` with a combobox and listbox (`aria-activedescendant`). Arrow keys move, Enter opens, Escape or a backdrop click closes, and focus returns to the opener. With the live API on, an unknown ticker becomes a live SEC survey option. |
| **Chart stage** (`chart/ChartStage`) | Hero, chart page, How to read | **Flat** (Canvas 2D) paints first and is the fallback and the reduced-motion view. **Relief** (WebGL) replaces it once the page is idle and the device can render it. Software GL, Save-Data, under 2 GB memory, no WebGL or a lost context all keep the flat chart. **Hover** shows the tooltip (growth, margin, value, gap to price). **Drag** moves the bearing with a grab cursor. **Focus** lets arrows move the bearing, Shift for bigger steps. An `aria-describedby` summary states extents, the market's story and your reading. |
| **Instrument** (`ui/Instrument`) | Chart page controls | A native range input plus a typed field. The track carries markers for *today* (grey) and *the market* (blue italic) with collision-aware labels. Typing keeps a draft that commits on Enter or blur; Escape restores; out-of-range values clamp. |
| **Story picker** | Chart page | `role="radiogroup"` of narratives. Checked fills magenta with `--signal-ink` text. Choosing one moves the bearing and the sliders; any manual change clears the check. |
| **Company chips** | Hero | Toggle buttons with `aria-pressed`. Pressed fills with ink, paper text. |
| **Reading** (`ui/Reading`) | Chart page, hero card | A `<dl>`: your value, freeboard, odds on dry land, *the market's story*. Standing is a word plus colour: above the load line, thin freeboard, under water. |
| **Hull gauge** (`ui/HullGauge`) | Chart bench | SVG hull with draft marks in dollars, the sea at the price, the load line at your margin of safety, the Monte Carlo 10–90% bracket. The sea moves on `--dur-tide`. |
| **Soundings** (`ui/Soundings`) | Chart page | Histogram of 4,000 revaluations. Bars are `--mark-land` or `--mark-water` by side of the price, either side of a labelled sea-level rule. Every non-empty bin is focusable and named, with its count and range on hover or focus. |
| **Tables** (`ui/Sensitivity`, `ui/ModelTable`) | Chart page | Real `<table>`s with captions, scoped headers, tabular figures. They scroll horizontally inside a focusable region on phones. |
| **Survey panel** (`ui/SurveyPanel`) | Chart page | Revenue and operating-margin columns from filings. Hover lifts a column to full opacity with its value; the same figures are listed as reported facts beside it. |
| **Company card** (`ui/CompanyCard`) | Atlas, home teaser | A thumbnail chart on a shared window, name, price, the market's growth. Hover scales the chart 1.03 over 900 ms (buoy) and turns the top rule magenta. The whole card is one link. |
| **Buttons** | Everywhere | Primary: ink fill, paper text, pill shape; hover turns it magenta with `--signal-ink` text (260 ms, out). Secondary: pill outline in `--rule-strong`, ink text; hover darkens the outline to ink on `--paper-raised`. Segmented toggles (relief or flat) fill with ink when checked and drop to 40% opacity when unavailable. |
| **Toast** | Copy link, chart image | `role="status"` live region, shown 2.6 s, never steals focus. |
| **Poster dialog** | Chart image | Native modal `<dialog>` with the 1,200 × 1,500 PNG, download, copy link and close. |
| **Loader** (`ui/Loader`) | Live SEC survey | The Plimsoll ring filling with water, `role="status"` with text. Static under reduced motion. |
| **Footer** (`ui/Footer`) | Every page | A chart neat line with a graduated border, the chart datum (risk-free rate and price date) and the fine print. |
| **404** | Unknown paths | *Here be dragons*: a sea serpent in seven contour lines, with links back to the atlas and to survey a company yourself. Focus moves to the heading. |

## 3. Responsive rules

Phones are their own layout, not a shrunken desktop.

| Breakpoint | Change |
|---|---|
| < 34 rem | Footer to one column. |
| < 48 rem (phone) | The chart page's cartouche and reading go to one column and the bench stacks: chart, hull gauge, log. Header links and theme move into the menu sheet. |
| < 60 rem (tablet and phone) | The hero stacks as headline, lede, chart with its reading card, then the company chips. Method's table of contents moves above the text. Footer goes to two columns. Search collapses to its icon. |
| < 75 rem | On the chart page the chart takes the full width; the hull gauge and the log share the row beneath it. |
| Any width | The atlas grid is intrinsic (`auto-fill`, 17 rem minimum), so it never needs a breakpoint. |

Touch replaces hover deliberately. On the flat chart a tap places the bearing and a drag moves it; on the relief one finger scrolls the page and two fingers turn and zoom the chart, so it never traps the scroll. Hover tooltips are for pointers only; on touch the reading updates in place instead.

## 4. Data visualisation rules

1. **Sequential within a domain.** Land runs light to dark with height (`--land-1` → `--land-3`); water fades from `--water-1` to paper with depth. There is no rainbow and no hue at the midpoint: the midpoint is the coastline, drawn as a line.
2. **One accent.** The coastline and the bearing share `--signal`; nothing else on a chart is magenta.
3. **Contours every 0.1 log units** (about 10% of value), index contours every 0.5, with spot soundings set like a real chart: italic Newsreader on water, upright Archivo on land.
4. **Never colour alone.** Water carries waterlines; standing carries a word; histogram bars sit either side of a labelled sea-level rule.
5. **Text alongside every chart.** Each chart has a written summary tied by `aria-describedby`; the forecast and the sensitivity are real tables; every sounding bin is focusable and named.
6. **One axis.** Growth runs across, margin runs up. Nothing is dual-axis.
