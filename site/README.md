# Project VRH: offer website

An investor site for a share offer by [Issuer] d.d. under the EU €12M prospectus exemption. The raise funds the acquisition of a target with €11.0M revenue and €1.9M EBITDA.

*Vrh* is Slovenian for "summit". The site tells the deal as an ascent: the €12M ceiling is the summit line, and the raise is the level the capital reaches.

## Theme

The site uses one light theme: a cool glacier white (`#F5F7F6`) with white panels, ink text (`#0B1A20`), jade (`#0A7D68`) for equity and emphasis, and red (`#D63A26`) only for the €12M ceiling. The terrain is drawn as grey contour lines on the light ground.

## Run it

There is no build step. Serve the folder with any static server, for example `python3 -m http.server` in `site/`, and open `index.html`. Every library and font is self-hosted in `assets/`, so the page makes no third-party requests.

## What award juries reward, and where this site answers it

Awwwards scores sites on Design (40%), Usability (30%), Creativity (20%) and Content (10%). Winning sites, and a Developer Award, also need responsive, fast, accessible and bug-free motion. Recent Sites of the Year and fintech Site of the Day winners share a few patterns:

- **One signature interactive centrepiece that embodies the brand concept.** Lando Norris (Site of the Year 2025) uses a 3D helmet, Igloo Inc (Site of the Year 2024) a procedural ice world, and Jeton (fintech Site of the Day) a coin that is always in motion. Here, the centrepiece is a live WebGL topographic terrain. A red contour marks the €12M ceiling, and a jade fill rises to the €6.52M raise.
- **Cinematic scroll.** Lenis smooth scrolling, and GSAP ScrollTrigger scenes that are pinned and scrubbed by the scroll position:
  - **The Ascent:** four numbers, with the camera tilting from a map view to a 3D view.
  - **The Route:** a horizontal timeline drawn along an elevation profile.
- **Kinetic, variable typography.** The big figures compress and stretch through Archivo's width axis (62–125%) as they count. The footer wordmark stretches as you scroll into it. Headlines reveal line by line through a mask.
- **Tension in the type pairing.** Newsreader, a high-contrast serif, carries the emotional lines. Archivo in extended light cuts carries the numbers. JetBrains Mono is used for survey-style labels.
- **Micro-interactions.** A surveyor's reticle cursor, magnetic buttons, a marquee whose direction follows the scroll direction, hover fills on the investment-case rows, and a progress meter on the right edge showing the ascent from €0 to €12M.
- **Trust signals next to the creative work, as in fintech winners.** An escrow flow diagram, a summary of the regulation, a fixed "Struktura posla" section, a legal line in the first screen, and a non-binding form that asks for no payment data. The "Struktura posla" section shows sources and uses to scale against the €12M ceiling, a waterfall from EBITDA to cash for shareholders (24.5% yield) and four key ratios.
- **Craft for the Developer Award.**
  - The site honours `prefers-reduced-motion`: no loader, no smooth scroll and no pinning, with a static terrain frame.
  - Without JavaScript, the full content still renders.
  - Semantic sections, a skip link, labelled controls and visible focus states.
  - The site is in Slovenian only (`lang="sl"`), with Slovenian number formats (`12.000.000 €`, `17,3 %`) and full č/š/ž support.
  - The WebGL scene pauses when it is off-screen.

## Base case (illustrative)

| Item | € M |
|---|---|
| EV at 5.5× EBITDA 1.9 | 10.45 |
| Transaction costs (4% of EV) | 0.42 |
| Cash buffer | 0.50 |
| **Total uses** | **11.37** |
| Senior debt at 2.0× EBITDA | 3.80 |
| Vendor loan at 10% of EV | 1.05 |
| **New equity (this offer)** | **6.52** |
| Headroom under the €12M ceiling | 5.48 |
| Pre-tax cash yield on equity: (EBITDA − interest) / equity | 24.5% |

## Launch blockers: resolve before going live

1. **Slovenia's national threshold.** Regulation (EU) 2024/2809 sets the exemption at €12M from 5 June 2026. Each Member State may instead opt for €5M, and Slovenia previously applied €5M (ZTFI-1, Art. 72).
   - Get written confirmation of the current threshold from ATVP or counsel.
   - If the threshold is €5M, the base-case equity of €6.52M needs a prospectus. The alternative is to redesign the raise below €5M.
2. **12-month aggregation.** The ceiling counts every public offer by the issuer in the EU over the preceding 12 months.
3. **National information document or notification.** Confirm whether ATVP requires one for an offer below the threshold.
4. **General meeting resolution under ZGD-1.** It must approve the capital increase, including any exclusion of pre-emptive rights.
5. **Escrow and conditionality.** Counsel and the bank must document the dedicated account, the conditions for registering the capital increase, and the refund at the long-stop date.
6. **Legal review of all copy.** The Slovenian text is a draft written for this site. The regulation box is a summary, not the official wording.
7. **Fill every `[placeholder]`** (`[Izdajatelj]`, `[banka]`, `[skrajni rok]` and so on): issuer, price per share, minimum ticket, anchor amount, bank, dates, ATVP reference and registry details.
8. **Wire the form** (see the `TODO` in the script) to a GDPR-compliant CRM, and add a privacy notice.
9. **Named parties.** The site names Alzetta Capital d.o.o. as anchor investor (€2.2M) and Bergweiss and Oaklins as transaction advisors. Before launch:
   - Get written consent from all three to be named, and have each approve the exact wording of its role. Oaklins, as an international network, will have brand-use rules. No logos are used for that reason.
   - Hold a signed, unconditional subscription commitment from Alzetta Capital d.o.o. for €2.2M. The site says the commitment is made on the same terms and at the same price as every other subscriber, so disclose any fee, side letter or preferential right, or remove that claim.
   - The anchor's €2.2M is counted inside the €12M ceiling. If it is placed under a separate exemption, such as a private placement, counsel should confirm how it counts towards the 12-month aggregation.

## Naming and IP checks already applied

- **Codename changed from "Triglav" to "VRH".** Zavarovalnica Triglav d.d. is a listed Slovenian insurer. A share-offer page named "Triglav" risks confusion with a real issuer.
- **No Knafelc trail marker.** The red-ring-with-white-dot trail blaze is protected as a national symbol. The site uses the generic cartographic triangulation-point symbol instead.
- **Fonts are self-hosted, not loaded from Google.** In 2022, LG München (3 O 17493/20) awarded damages under the GDPR for loading Google Fonts from Google's servers.

## Licences

- GSAP 3.15 (including ScrollTrigger and SplitText) is used under GreenSock's no-charge standard licence.
- Lenis is MIT-licensed (`assets/vendor/LICENSE-lenis.txt`).
- Archivo, Newsreader and JetBrains Mono are under the SIL Open Font License (`assets/fonts/OFL-*.txt`).
