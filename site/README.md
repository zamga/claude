# Project Triglav: offer website

This is a single-file investor site (`index.html`) for a share offer by [Issuer] d.d. under the EU €12M prospectus exemption. The money raised funds the acquisition of a target with €11.0M revenue and €1.9M EBITDA.

The page has no build step and no dependencies apart from Google Fonts. To preview it, open `index.html` in a browser. To host it, deploy the folder to any static host (Netlify, Cloudflare Pages, S3).

## What's on the page

- **Hero**: the thesis, plus a gauge that tracks the target raise against the €12M ceiling. The gauge is driven by the model below it.
- **Target**: the P&L tiles (revenue, EBITDA, margin, entry multiple) and three investment theses.
- **Deal model**: interactive sliders for the purchase multiple, senior debt and vendor loan. It outputs EV, the equity needed, headroom under the cap, leverage, interest and cash yield, and draws a sources-and-uses bar to scale.
- **Investor protection**: conditional subscription, escrow, a refund at the long-stop date, an anchor commitment and book-entry shares through KDD.
- **Legal frame**, **Timeline**, **FAQ**, and a non-binding **register interest** form. The form asks for no payment or bank data.
- An EN/SL language toggle, light and dark themes, a responsive layout down to 390px, and support for reduced motion.

## Base case (illustrative)

| Item | € M |
|---|---|
| EV at 5.5× EBITDA 1.9 | 10.45 |
| Transaction costs (4% EV) | 0.42 |
| Cash buffer | 0.50 |
| **Total uses** | **11.37** |
| Senior debt 2.0× EBITDA | 3.80 |
| Vendor loan 10% EV | 1.05 |
| **New equity (this offer)** | **6.52** |
| Headroom under €12M cap | 5.48 |
| Pre-tax cash yield on equity (EBITDA − interest) / equity | 24.5% |

## Launch blockers: resolve before going live

1. **Slovenia's national threshold.** Regulation (EU) 2024/2809 sets the exemption at €12M from 5 June 2026, but each Member State may opt for €5M instead. Slovenia previously applied €5M (ZTFI-1, Art. 72). Get written confirmation of the threshold currently applied from ATVP or counsel. If Slovenia opted for €5M, the offer must be capped at €5M or a prospectus is required. The base-case equity of €6.52M would then fail.
2. **12-month aggregation.** The cap counts every public offer by the issuer in the EU over the preceding 12 months.
3. **National information document or notification.** Confirm whether ATVP requires one for offers below the threshold.
4. **General meeting resolution under ZGD-1** approving the capital increase, including any exclusion of pre-emptive rights.
5. **Escrow and conditionality mechanics.** Set up the dedicated account, the conditions for registering the capital increase, and the refund at the long-stop date. Documentation comes from counsel and the bank.
6. **Marketing copy review.** Counsel must review the page, including the Slovenian translation. The SL text is a draft.
7. **Fill every `[placeholder]`**: issuer name, price per share, minimum ticket, anchor amount, dates, ATVP reference, company registration details.
8. **Wire the form** (see the `TODO` in the script) to a GDPR-compliant CRM, and add a privacy notice.
