# Scroll storyboard and motion specification

All timings in milliseconds. Easings: **buoy** `cubic-bezier(0.16, 1, 0.3, 1)`, **tide** `cubic-bezier(0.45, 0, 0.2, 1)`, **out** `cubic-bezier(0.22, 1, 0.36, 1)`. With `prefers-reduced-motion: reduce` every duration collapses to 1 ms, the hero does not sway, and charts open flat.

## Home

| # | Section | Layout | Content | Motion (trigger → animation, duration, easing) |
|---|---|---|---|---|
| 1 | Hero | 5/7 split; chart bleeds right. Phone: headline, chart, card, search | “The price is *sea level.*” Lede, search, six company chips. Live chart of NVIDIA with a reading card | Load → waterline draws under the headline (scaleX 0→1, 1,400, buoy, 200 delay). Chart visible → flat chart lifts into relief (heights 0→1 and camera 1°→56°, 1,900, buoy). Idle → slow sway (azimuth ±9°, period 48 s) until touched or off screen. Chip → terrain cross-fades to the new company (1,100, tide); card text swaps |
| 2 | How to read | Sticky chart left, four steps right. Phone: sticky chart on top | 1 Every point is a story · 2 The price is sea level · 3 The coastline is the market’s story · 4 Your bearing and its freeboard | Step crosses viewport centre → chart redraws with that step’s layers (sea off → sea on → coastline stressed → bearing and soundings); active step number turns magenta (480, out) |
| 3 | Why “Plimsoll” | Illustration left, text right | The 1876 load line; investors overload too | Water bobs ±6 px (6,000, tide, alternate); waves roll (9,000, linear); glints drift (5,000, tide) |
| 4 | Atlas teaser | Responsive grid of chart cards | Six charts on one shared window | Card enters → rises 28 px (scroll-linked, entry 0–60%). Hover → chart scales 1.03 (900, buoy); top rule turns magenta (260, out) |
| 5 | Left ashore / On board | Two columns | What the category does that we refuse; what we carry | Columns rise 28 px (scroll-linked) |
| 6 | Survey your own | Mark, text, button | Private companies, employers, startups | Button fill to magenta on hover (260, out) |
| 7 | Footer | Neat line with graduated border | Chart datum, risk-free rate, fine print | — |

## Chart page

| # | Block | Content | Motion |
|---|---|---|---|
| 1 | Cartouche | Company name, what it does, sea level (editable price), survey date | Page enters through a View Transition: old page eases up 1.5% (480, tide), new page floods in from the bottom (clip-path, 620, buoy) |
| 2 | Reading | Your value · Freeboard · Odds on dry land · *The market’s story*; two plain sentences | Values update in place; the panel dims to 85% while the soundings recompute |
| 3 | Bench | Chart (relief or flat), hull gauge, log of assumptions | Drag bearing → staff follows the terrain every frame. New price → sea rises or falls (700, tide) on the chart and the hull (1,400, tide). Story → bearing jumps; slider thumbs glide (native). Theme → palette swaps without re-rendering geometry |
| 4 | Soundings | Histogram of 4,000 revaluations with sea level, load line, your value | Hover/focus a bin → column dims, tooltip shows count and range |
| 5 | Sensitivity | Cost of capital × growth after year 10 | — |
| 6 | Survey | Revenue and margin columns; reported facts | Hover → column lifts to full opacity with its value |
| 7 | The model | Year-by-year table; bridge to value per share | — |
| 8 | Sources | Filings, notes | — |

## Signature moment

On any chart, move the **sea level**: type a new price and the sea rises or falls across the terrain while the coastline redraws. People see, in one gesture, that a price is a story and that the story moves with the price.

## Details

- **Loader:** the Plimsoll ring fills with water (2,400, tide, loop) while a live survey runs.
- **Cursor:** crosshair over the chart, a grab hand over the bearing; a tooltip with growth, margin, value and the gap to the price.
- **404:** *Here be dragons*, with a sea serpent drawn in seven contour lines (3,200, buoy).
- **Footer:** the neat line of a chart border, graduated every 12 px.
