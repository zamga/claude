# Kozolec — secured convertible bonds (concept site)

A one-page site for a bond issue of up to €5m, offered without a prospectus
under Article 72 of ZTFI-1. The bonds are secured by a pledge over the shares
of the companies the holding buys (EBITDA €1.5–5m), and become convertible
into shares once the company changes from a d.o.o. into a d.d. in Q1 2027.

**Idea:** *Danes upnik. Jutri solastnik.* (Lender today. Co-owner tomorrow.)
The hero is the bond itself. As you scroll, its coupons are cut and flown into
an interest tally. The talon unlocks the 2027 conversion, and the certificate
turns over into a share. The kozolec (hayrack) carries the strategy: each bay is
one company, and the holding fills it bay by bay.

## Files

- `index.html`: all Slovenian content, semantic and complete without JavaScript
- `styles.css`: tokens (light and dark), layout, components
- `app.js`: terms rendering, generated engraving (guilloche, rosettes, kozolec),
  the scroll story, strategy tabs, calculator, form, English copy

There is no build step. Serve the folder with any static server, for example
`python3 -m http.server`, and open `http://localhost:8000`.

## Changing the terms

Every figure comes from `TERMS` at the top of `app.js`: nominal, minimum,
rate, coupon frequency, issue date, tenor, conversion price, issue size.
Coupon dates, the schedule, the maturity, the conversion ratio and the
calculator all derive from it.

Values that are not final render in [square brackets]. When a value is
agreed, add its key to `TERMS.confirmed` (for example `['rate', 'nominal']`)
and the brackets disappear everywhere.

The Slovenian markup in `index.html` is pre-rendered from the default terms so
the page needs no JavaScript to read correctly. If you change `TERMS`, update
the matching values in the HTML as well. In production, generate both from one
source (see below).

English copy lives in the `EN` dictionary in `app.js`, keyed by each element's
`data-i18n` attribute.

## Stack

- Static HTML, CSS and vanilla JS. GSAP 3.15 + ScrollTrigger and Lenis 1.3.26
  from jsDelivr with SRI hashes. Google Fonts subsets: Spectral and
  Instrument Sans.
- Everything works without the libraries: reduced motion, no JavaScript, or a
  blocked CDN all fall back to a still page with a Bond / Share switch.
- For production: Astro (static output) with the terms as a CMS singleton that
  feeds both the HTML and the script, deployed to an edge host with preview
  deploys and instant rollback.

## Before launch

Legal (needs counsel; the site is not legal advice):

1. Real company name; check it in the AJPES register.
2. ZTFI-1 Art. 72: total consideration in the EU below €5m over 12 months, and
   notify ATVP before using the exemption. Prepare the terms of issue that
   replace the prospectus. Check the advertising wording.
3. Security package: the share pledge agreement, the bondholders' agent, and the
   ranking against any bank debt that co-finances acquisitions.
4. Conversion: the d.o.o. → d.d. transformation, a conditional capital
   increase, and the conversion price, ratio and anti-dilution terms.
5. KDD registration (ISIN) and a paying agent.

Product:

1. Remove the concept strip and the "Vzorec / Specimen" overprints once the
   terms are final (or keep the specimen if counsel prefers).
2. Connect the interest form (`[data-lead]` in `app.js`) to the CRM with double
   opt-in. It collects no payment data and should stay that way.
3. Add the privacy policy, company imprint, OG image, sitemap, analytics with
   consent, and error monitoring.

## Measured (lab, Chromium)

| | Mobile, 4× CPU throttle | Desktop |
|---|---|---|
| LCP | 0.3–0.4 s | 1.2 s |
| CLS | 0 | 0.024 |
| Total blocking time | ~320 ms | ~50 ms |

Below-the-fold sections use `content-visibility: auto`. The boot is split into
short tasks, and off-screen engraving is drawn in idle time. No horizontal
overflow from 360 px to 1920 px.
