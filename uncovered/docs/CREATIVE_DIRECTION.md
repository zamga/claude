# Uncovered: creative direction

## The brief, restated

A research desk for any company, public or private, Ljubljana or London. You name a company; Uncovered researches it and writes the initiation-of-coverage report a bank's equity research desk would publish: investment thesis, business and industry, financial analysis, forecasts, valuation and risks, with every figure traced to its source.

**Audience.** M&A advisers and corporate-finance boutiques, private equity and family offices, lenders and credit analysts, corporate development teams, journalists, and investors in small listed companies. Most of all, anyone who needs a serious first look at a company that no analyst has ever covered.

**What visitors must feel, remember and do.** Feel: rigour and speed, the confidence of a top-tier research note. Remember: _every company gets coverage, and every number has a source_. Do: type a company's name and initiate coverage.

## The truth behind the idea

Slovenia's business register holds about 294,000 entities. Research desks cover a handful of listed names. The rest have never had a single page of analysis: their suppliers, lenders, buyers and employees decide without one. Coverage is not a data problem (filings are public, in Slovenia through AJPES); it is a labour problem. A bank spends two to six weeks writing an initiation. Uncovered writes one in minutes, and shows its working.

## The idea: Held to the light

A banknote earns trust with security features anyone can check: hold it to the light and a watermark appears, tilt it and the foil changes colour, put it under a UV lamp and hidden ink glows. Uncovered makes the same promise about research (every claim can be checked), so the site lets you check it the same way. The report is a physical object you inspect, and light is the interface.

- **Hold it to the light.** Move over the cover and a lamp shines through it from behind: the company's seal appears as a watermark, the security thread as a dark line, the fibres in the paper. The room dims around the sheet while you look.
- **Switch on the UV lamp** (the UV theme). The room goes dark and the lamp shines from the front: fluorescent fibres glow, and so does the invisible ink printed on every cover, which carries the source of each figure.
- **Tilt it.** The foil under the seal shifts colour with the angle: the pointer on a desk, the phone's own tilt in the hand.
- **Every company is engraved.** Its seal from its name; its value landscape from its own model. There is no stock photography. A photograph, when one is used, goes through the same engraving.

The first version's language stays: a seal for every company, a numbered cover, a footnote on every figure, daylight and UV.

### Why the idea moved on

The first version (The Certificate) set the language correctly but quietly: a page with one flat card. Juries reward one idea made physical. The 2025 Awwwards Site of the Year, [Lando Norris by OFF+BRAND](https://designrush.com/best-designs/websites/lando-norris-website-design), turned its subject's own graphic language (the helmet) into cursor-reactive shapes and an archive of helmets; developer winners such as Igloo Inc and Iventions use WebGL for atmosphere rather than spectacle. Uncovered's own graphic language is security printing, so its security features become the interactions, and its seals become an archive.

## Three directions considered

|                  | A. Held to the light (chosen)                                                             | B. The Press                                                                | C. The Archive                                                                     |
| ---------------- | ----------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| Idea             | A report you can verify like a banknote: every security feature is a way to check a claim | Watch the report being made like money is printed: engraved, inked, pressed | Fly through the register of 294,000 companies and pull one file                    |
| Visual language  | Security paper, transmitted light, foil, fluorescent ink; Bodoni Moda and Hanken Grotesk  | Copper, ink black and paper; macro renders of the plate                     | Endless shelves of files in fog; instanced 3D                                      |
| Motion           | Light moves, paper rests; engrave, then ink                                               | The press: engraving, inking, wiping, pressing, driven by scroll            | Camera flights                                                                     |
| Signature moment | Pass the lamp over the cover: the watermark and the sources appear                        | Type a name and its copper plate is engraved and printed onto the cover     | Search flies to one drawer among 294,000                                           |
| Build            | Medium-high: one WebGL paper shader, DOM text above it, masks for the reveal              | High: a lit 3D plate and an ink simulation                                  | High: heavy on phones                                                              |
| Why not          | —                                                                                         | Celebrates the making, not the checking, which is what Uncovered sells      | A familiar trope ("the data universe"); says nothing about the quality of a report |

**Recommendation: A.** It is the product's promise acted out: you check a claim by looking closer, the way you check a banknote. It runs on one small shader over real HTML, so text stays crisp, accessible and indexable, and it degrades to the printed page.

## Clichés broken, deliberately

| The category does                            | Uncovered does                                                                      |
| -------------------------------------------- | ----------------------------------------------------------------------------------- |
| Dark "terminal" screens, neon tickers        | Daylight security paper; the dark theme is an inspection lamp, not a trading floor  |
| Navy-and-gold pitch-book chrome              | Intaglio green on white, one optically variable accent                              |
| Stock photography of skylines and handshakes | Imagery engraved from each company's own identity and figures; no stock             |
| "AI-powered" sparkles and chat bubbles       | No sparkle icons, no chat; the work is the report, and the sources are on show      |
| Buy, Hold and Sell traffic lights            | A fair-value range, a football field, a value landscape, and what the price implies |
| Screenshots of fake dashboards               | A real report on a real company, every number cited                                 |
| Particles and abstract 3D blobs              | One object, the report, under one light                                             |

## Typography

- **Bodoni Moda** (variable, optical size 6–96, OFL) for display: the masthead, company names, headline numbers. Didone contrast is the typeface of certificates and financial mastheads, and for a reason: Didones were cut to imitate copperplate engraving. Their hairlines are engraving, which is why headlines are engraved as hairlines first and inked after. Optical size follows the type size automatically (forcing a large optical size at small sizes breaks the hairlines); headlines reach optical size 96 at weight 450, tracked −0.02 em.
- **Hanken Grotesk** (variable, OFL) for everything else: a clean contemporary grotesk whose figures are tabular by default, so every table aligns without feature switches (Libre Franklin, the first choice, ships no tabular figures on the web). Interface at weight 500, labels in capitals tracked +0.08 em.
- **Microtext** in Hanken Grotesk at 6–7 px, capitals, is used as rules and borders, the way banknotes print text instead of lines. It is decorative and hidden from assistive technology.

## Colour

| Role                                                 | Daylight                                                 | UV                                                       |
| ---------------------------------------------------- | -------------------------------------------------------- | -------------------------------------------------------- |
| Paper                                                | `#FBFBF8`                                                | `#0D0C14`                                                |
| Ink                                                  | `#101613`                                                | `#ECEAF4`                                                |
| Intaglio (line work, links, brand)                   | `#155E46`                                                | `#63E4B8`                                                |
| Optically variable pair (seal sheen, primary action) | `#14A386` → `#6B4BD6`                                    | `#63E4B8` → `#B79BFF`                                    |
| Evidence grades                                      | filed `#155E46`, reported `#8A5A00`, estimated `#5B4BB8` | filed `#63E4B8`, reported `#E6B85C`, estimated `#B79BFF` |

The optically variable pair is the one bold move: it lives only in the seal's sheen and the primary action, and it shifts with the pointer the way ink shifts on a banknote when you tilt it.

## Motion principles

1. **Light moves, paper rests.** The lamp is the main motion; objects move only when handled, and settle without overshoot.
2. **Engrave, then ink.** Type and seals draw as hairlines first, then fill with ink.
3. **Handled, not animated.** Tilt, lift, turn: physical verbs with real inertia, driven by the pointer, the phone's tilt or the scroll.
4. **One choreography per section.** The hero inspects, the method assembles, the anatomy opens, the valuation converges. Nothing else moves.
5. **Mechanical, never bouncy.** Drawing uses `cubic-bezier(0.65, 0, 0.35, 1)`; setting type uses `cubic-bezier(0.2, 0.8, 0.2, 1)`.
6. **Reduced motion keeps the idea.** The lamp is placed rather than swept, the reveal is a switch, seals render finished, sections never pin, and every number is already in place.

## Interaction principles

- One input does the important thing: the company's name. The headline takes it up as you type.
- The pointer is a lamp; on a phone, so is a finger, and the phone's tilt moves the foil.
- Every figure in a report is a link to its source, and every source is one quotation away.
- The report is a document first: it reads top to bottom, prints on A4, and works without JavaScript once rendered. Light, foil and fluorescence are added on top and never carry content of their own.
