# Bergweiss Capital — Website

A self-contained static rebuild of the marketing site, rebranded from
"Hark" to "Bergweiss" throughout.

## Running locally

It's a plain static site — open `index.html` directly, or serve the
folder:

```bash
python3 -m http.server 8000
# then visit http://localhost:8000
```

## Structure

```
index.html              # the page (all references localized)
assets/css/             # stylesheets extracted from the original archive
assets/img/             # images extracted from the original archive
```

## Notes

- The site was extracted from a saved web archive (`.mht`). Every asset
  that the archive contained — HTML, CSS, and images — is bundled locally
  under `assets/`, so the page renders without network access.
- `hark`/`Hark` was replaced with `bergweiss`/`Bergweiss` everywhere
  (page text, `<title>`/meta tags, CSS custom properties such as
  `--swatch--bergweiss-white`, and asset filenames), preserving the
  original capitalization in each occurrence.
- A few resources were not part of the archive and are still referenced
  from their original CDN (so they load only when online): web fonts, the
  hero background video, the animated logo (Lottie JSON), `scripts.js`
  (interactions/Swiper init), and the favicons. Fonts fall back to system
  fonts and the hero shows its static poster image when offline.
