# Uncovered: creative direction

## The brief, restated

A research desk for any company, public or private, Ljubljana or London. You name a company; Uncovered researches it and writes the initiation-of-coverage report a bank's equity research desk would publish: investment thesis, business and industry, financial analysis, forecasts, valuation and risks, with every figure traced to its source.

**Audience.** M&A advisers and corporate-finance boutiques, private equity and family offices, lenders and credit analysts, corporate development teams, journalists, and investors in small listed companies. Most of all, anyone who needs a serious first look at a company that no analyst has ever covered.

**What visitors must feel, remember and do.** Feel: rigour and speed, the confidence of a top-tier research note. Remember: _every company gets coverage, and every number has a source_. Do: type a company's name and initiate coverage.

## The truth behind the idea

Slovenia's business register holds about 294,000 entities. Research desks cover a handful of listed names. The rest have never had a single page of analysis: their suppliers, lenders, buyers and employees decide without one. Coverage is not a data problem (filings are public, in Slovenia through AJPES); it is a labour problem. A bank spends two to six weeks writing an initiation. Uncovered writes one in minutes, and shows its working.

## The idea: The Certificate

Equity is, physically, a printed security: a share certificate, engraved, numbered, sealed, and printed with security features precisely so that it can be trusted. Uncovered treats every report the same way.

- **Every company gets its seal.** A guilloche rosette, the engraved pattern of share certificates and banknotes, generated from the company's identity. No two companies share one. It appears on the report cover, in links, on social cards and on the printed PDF. It is the mark of coverage.
- **Every report is numbered.** A serial on the cover, rolled into place by a numbering machine.
- **Every figure is footnoted.** Superscripts lead to a source rail: the filing, the page, the date. Each claim is graded _filed_ (audited statements), _reported_ (company or press), or _estimated_ (our model).
- **Daylight and UV.** The light theme is security paper in daylight. The dark theme is the same document under an inspection lamp: the engraving fluoresces and hidden microtext appears.

## Three directions considered

|                  | A. The Certificate (chosen)                                                          | B. Exposure                                                                              | C. Constellation                                                                      |
| ---------------- | ------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| Idea             | Reports as printed securities: engraved seals, serials, microtext, footnotes         | Research as developing a photograph: an unknown company develops as evidence accumulates | The whole economy as a field of 294,000 points; initiating coverage lights a new star |
| Visual language  | Security paper, intaglio green line work, Bodoni Moda and Hanken Grotesk, Swiss grid | Darkroom amber on black, film grain, contact sheets                                      | WebGL particles, deep space, glowing links between peers                              |
| Motion           | Engraving: lines draw, type sets from the baseline, numbers roll                     | Slow exposure, grain resolving into image                                                | Camera flights through the field                                                      |
| Signature moment | Type a company and its seal engraves itself live                                     | Drag a loupe over an annual report to lift the numbers out                               | Search flies the camera to one company among 294,000                                  |
| Build            | Medium-high: generative guilloche on Canvas, GSAP choreography                       | Medium                                                                                   | High: heavy WebGL, poor on low-end phones                                             |
| Why not          | —                                                                                    | Moody and dark where finance needs trust; the metaphor is photography, not finance       | A celebrated web trope; says nothing about the quality of the report                  |

**Recommendation: A.** Its picture is the promise: an engraved, numbered, sealed document is literally how trust is printed in finance. It scales from the hero to the PDF, gives every company a shareable artefact, and costs little on a phone.

## Clichés broken, deliberately

| The category does                            | Uncovered does                                                                     |
| -------------------------------------------- | ---------------------------------------------------------------------------------- |
| Dark "terminal" screens, neon tickers        | Daylight security paper; the dark theme is an inspection lamp, not a trading floor |
| Navy-and-gold pitch-book chrome              | Intaglio green on white, one optically variable accent                             |
| Stock photography of skylines and handshakes | Generative engravings unique to each company; no photographs at all                |
| "AI-powered" sparkles and chat bubbles       | No sparkle icons, no chat; the work is the report, and the sources are on show     |
| Buy, Hold and Sell traffic lights            | A fair-value range, a football field, and what the price implies                   |
| Screenshots of fake dashboards               | A real report on a real company, every number cited                                |

## Typography

- **Bodoni Moda** (variable, optical size 6–96, OFL) for display: the masthead, company names, headline numbers. Didone contrast is the typeface of certificates and financial mastheads. Optical size follows the type size automatically (forcing a large optical size at small sizes breaks the hairlines); headlines reach optical size 96 at weight 450, tracked −0.02 em.
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

1. **Engrave, don't fade.** Lines draw along their path; type sets upward from the baseline; numbers roll like a numbering machine.
2. **One choreography per section.** The hero engraves, the method pins and assembles, the valuation converges. Nothing else moves.
3. **Mechanical, never bouncy.** Drawing uses `cubic-bezier(0.65, 0, 0.35, 1)`; setting type uses `cubic-bezier(0.2, 0.8, 0.2, 1)`.
4. **Reduced motion is complete.** Seals render finished, type is set, sections never pin, and every number is already in place.

## Interaction principles

- One input does the important thing: the company's name. Everything else is optional.
- Every figure in a report is a link to its source.
- The report is a document first: it reads top to bottom, prints on A4, and works without JavaScript once rendered.
