# Creative direction

## The idea

**The price is sea level.** Every story you could tell about a company has a value. Lay those stories out as a landscape, with revenue growth across and operating margin up, and each point’s height is what that story is worth per share. Flood the landscape to today’s share price. Dry land is every story worth more than the price; water is every story worth less. The coastline is the market’s story, drawn as a line. Plant your own story on the chart and read your freeboard: how high you stand above the water.

The brand truth behind it is a real one. In 1876, after Samuel Plimsoll’s campaign against overloaded ships, Britain made a load line on every hull compulsory. Investors overload too, by paying for stories they never checked. Plimsoll paints the line.

## Three directions considered

| | A. Sea level (chosen) | B. Strata | C. The instrument |
|---|---|---|---|
| Idea | Value as terrain, price as sea level, the market as a coastline | Future cash flows as sediment, compressed by the discount rate into a core sample you drill | A precision device: valuation as dials and gauges, Braun meets Damodaran |
| Visual language | Admiralty chart: paper, buff land, blue shallows, green drying banks, one magenta signal, italic hydrography | Geological cross-sections, earth tones, extruded 3D strata | Off-white hardware, rendered 3D dials, orange indicator |
| Motion | Tidal: buoyant arrivals, slow level changes, the chart rising off the page | Compression: layers settle and squeeze as rates rise | Mechanical detents, needle swings, haptic clicks |
| Signature moment | Drag your bearing across the terrain while the coastline holds still; move the price and watch the sea rise | Pull a core sample and read the decades as layers | Turn the risk dial and watch every gauge respond |
| Build | High: WebGL terrain, contour shaders, reverse-DCF solvers | High: custom geometry per company, harder to read precisely | Medium: dials are familiar but generic, risk of skeuomorphic pastiche |
| Why not | — | Beautiful, but the time axis fights the two drivers that matter | Strong craft, weak idea: it explains the inputs, not the market |

**Recommendation: A.** It is the only direction whose picture *is* the analysis: the coastline is a reverse DCF, the height of your pin is the margin of safety, and the soundings are a Monte Carlo. Nothing is decoration.

## Clichés broken, deliberately

| Category cliché | What Plimsoll does instead |
|---|---|
| Dark terminal with neon tickers | A paper chart by day; a dimmed bridge display (“Night watch”) by night |
| Red/green up/down colour | Land and water, a real cartographic convention, validated for colour-blind readers |
| Bulls, bears and stock photos | A procedural landscape unique to each company, plus one engraved-style illustration of a real load line |
| A single fair value and a verdict | A value surface, a coastline, odds and a range |
| Ratings and scores | Freeboard, a measure you set yourself |

## Typography

- **Newsreader** (Production Type, OFL) in two pinned optical sizes: *Display* (opsz 60) for headlines, *Text* (opsz 14) for reading. Its italic carries the cartographic rule that runs through the whole product: **water features are named in italic**. In Plimsoll anything that belongs to the market (the price, what the price implies) is set in italic; anything about the company is upright.
- **Archivo** (Omnibus-Type, OFL) for interface, figures and tables, with tabular lining figures. Its width axis gives the condensed **draft-mark numerals** painted on hulls, used on the gauge and the step numbers.
- Self-hosted, subset to Latin and instanced to the needed axis ranges: ~159 KB for the three critical faces, metric-matched fallbacks to avoid layout shift.

## Colour

| Role | Day chart | Night watch |
|---|---|---|
| Paper | `#f3f5f1` | `#071219` |
| Ink | `#0d1b26` | `#dbe4e7` |
| Land (low → high) | `#efe3b9 → #cbb26a` | `#2a2716 → #5a4e2a` |
| Drying bank | `#b8d2a5` | `#1f3824` |
| Shallows | `#c9e2ec` | `#0e2d3e` |
| Signal (your bearing, actions) | `#b0126c` | `#f26ab8` |
| Data marks (land / water) | `#a86b12` / `#1f6fa8` | `#bf8426` / `#3a8ac0` |

Admiralty conventions decide the rest: deep water fades to paper, shallow water is tinted, drying banks are green, magenta is reserved for what you act on. Every text pair meets WCAG 2.2 AA in both themes; the data-mark pair passes the colour-vision validator (ΔE ≥ 20 under protan, deutan and tritan simulation).

## Motion principles

1. **Buoyant, never bouncy.** Arrivals use `cubic-bezier(0.16, 1, 0.3, 1)`; nothing overshoots.
2. **Tidal for levels.** Changes of level (the sea, the gauge, a company switch) use `cubic-bezier(0.45, 0, 0.2, 1)` over 700–1,400 ms.
3. **Motion explains.** The chart rises from a flat chart into relief: the 2D map you can read becomes the 3D landscape you can explore, the same picture in two dimensions.
4. **Render on demand.** The WebGL scene draws only when something changes; the hero sway pauses off screen and in background tabs.
5. **Reduced motion is a full experience.** The flat chart opens by default, the tide stops, and every reading is identical.

## Interaction principles

- The bearing is the one thing you push around. Drag it, click anywhere to place it, or use the arrow keys (Shift for bigger steps).
- Every slider shows **today** (grey) and **the market** (blue italic) on its track, so the distance between your story and theirs is always visible.
- One finger scrolls the page on phones; two fingers turn the chart. Touch never traps the page.
- The search is everywhere: ⌘K, Ctrl+K or `/`.
