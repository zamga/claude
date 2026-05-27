# Meridian

A premium agency homepage built from the Master Web Design Blueprint:
**Goldman for structure, Effortel for surface & motion, Carlyle for language.**

- **Structure** — Header → Hero lead → Editorial proof rail → Capability/Thinking/Careers band → Firm identity → Subscription → Compact footer.
- **Surface** — Effortel's two-anchor system: electric cyan (`#66E8FA`) on deep charcoal (`#1B2123`), alternating dark atmospheric chapters with pale rounded inversion shells. Satoshi for display/body, a monospace face for micro-labels.
- **Motion** — "Depth, not spectacle": load-in reveal, IntersectionObserver scroll reveals, shallow scrub parallax, tactile button hovers, an animated data plate. Fully respects `prefers-reduced-motion`.

## Stack

Self-contained static site — no build step.

- `index.html` — semantic markup, all blueprint copy
- `css/styles.css` — design tokens + full layout/motion system
- `js/main.js` — reveals, parallax, sticky header, mobile nav, form validation

Fonts load from CDN (Fontshare/Google) with system fallbacks; the page renders fully offline.

## Run

```bash
python3 -m http.server 8000
# open http://localhost:8000
```
