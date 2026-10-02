"""
Cut the three typefaces down to the characters the site sets, so a first
visit downloads about 94 kB of type instead of 135 kB.

Writes src/styles/fonts/*.woff2, with each typeface's SIL Open Font License
beside it (the cut faces are modified versions; neither declares a Reserved
Font Name), and src/styles/fonts.css. Run it again after upgrading the
@fontsource-variable packages:

    pip install fonttools brotli
    python3 scripts/subset-fonts.py

The cut faces are declared after fontsource's own (see base.css). Where
@font-face rules overlap, the browser uses the one declared last, so text in
the core set comes from these small files, and fontsource's full Latin file is
fetched only when a page holds a character outside it, such as the é of a
company typed into the form. Slovenian and Croatian letters get a second small
cut, fetched by the pages that set them, instead of the whole Latin Extended file.
"""

import shutil
import subprocess
from pathlib import Path

from fontTools import subset
from fontTools.ttLib import TTFont

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / "node_modules" / "@fontsource-variable"
OUT = ROOT / "src" / "styles" / "fonts"
CSS = ROOT / "src" / "styles" / "fonts.css"

# Printable ASCII, and the typography the copy, the figures and the reports use:
# no-break, thin and hair spaces, soft and no-break hyphens, en and em dashes,
# curly quotes, guillemets, bullet, ellipsis, primes, middle dot, degree, plus-minus,
# multiplication sign, true minus and the euro sign.
CORE = [(0x20, 0x7E)] + [
    (c, c)
    for c in (
        0xA0, 0xA9, 0xAB, 0xAD, 0xB0, 0xB1, 0xB7, 0xBB, 0xD7,
        0x2009, 0x200A, 0x2011, 0x2013, 0x2014, 0x2018, 0x2019, 0x201C, 0x201D,
        0x2022, 0x2026, 0x2032, 0x2033, 0x20AC, 0x2212,
    )
]

# Shaping and the figure styles the stylesheets ask for (tabular, proportional
# and lining figures); the fraction features are left out, as nothing sets fractions.
FEATURES = [
    "ccmp", "locl", "liga", "clig", "calt", "rlig", "rclt", "rvrn",
    "kern", "mark", "mkmk", "pnum", "tnum", "lnum", "onum", "case", "zero",
]

# Č, č, Ć, ć, Đ, đ, Š, š, Ž, ž: the names of the companies Uncovered starts with.
SLOVENIAN = [(0x106, 0x107), (0x10C, 0x10D), (0x110, 0x111), (0x160, 0x161), (0x17D, 0x17E)]

FACES = [
    # (fontsource file, with {subset} for the subset it is cut from; output name; family; style; weight range)
    ("bodoni-moda/files/bodoni-moda-{subset}-opsz-normal.woff2", "bodoni-moda-opsz-normal", "Bodoni Moda Variable", "normal", "400 900"),
    ("bodoni-moda/files/bodoni-moda-{subset}-opsz-italic.woff2", "bodoni-moda-opsz-italic", "Bodoni Moda Variable", "italic", "400 900"),
    ("hanken-grotesk/files/hanken-grotesk-{subset}-wght-normal.woff2", "hanken-grotesk-wght-normal", "Hanken Grotesk Variable", "normal", "100 900"),
]

CUTS = [
    # (suffix, fontsource subset it is cut from, characters); the core cut is the one preloaded.
    ("core", "latin", CORE),
    ("sl", "latin-ext", SLOVENIAN),
]


def codepoints(ranges):
    return sorted({c for lo, hi in ranges for c in range(lo, hi + 1)})


def unicode_range(points):
    """Compress code points into a CSS unicode-range value."""
    parts, start, prev = [], None, None
    for c in points:
        if start is None:
            start = prev = c
        elif c == prev + 1:
            prev = c
        else:
            parts.append((start, prev))
            start = prev = c
    if start is not None:
        parts.append((start, prev))
    return ",".join(f"U+{a:04X}" if a == b else f"U+{a:04X}-{b:04X}" for a, b in parts)


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    for package in ("bodoni-moda", "hanken-grotesk"):
        shutil.copyfile(SOURCE / package / "LICENSE", OUT / f"OFL-{package}.txt")
    rules = []
    for source, stem, family, style, weight in FACES:
        for suffix, fontsource_subset, characters in CUTS:
            options = subset.Options()
            options.flavor = "woff2"
            options.layout_features = FEATURES
            options.name_IDs = ["*"]
            options.notdef_outline = True
            # Keep the source's timestamp, so the same sources always cut the same files.
            font = TTFont(SOURCE / source.format(subset=fontsource_subset), recalcTimestamp=False)
            subsetter = subset.Subsetter(options)
            subsetter.populate(unicodes=codepoints(characters))
            subsetter.subset(font)
            name = f"{stem}-{suffix}"
            target = OUT / f"{name}.woff2"
            font.flavor = "woff2"
            font.save(target)
            # Declare exactly the characters the cut face can draw.
            drawn = sorted(set(TTFont(target).getBestCmap()))
            rules.append(
                "\n".join(
                    [
                        "@font-face {",
                        f"  font-family: '{family}';",
                        f"  font-style: {style};",
                        "  font-display: swap;",
                        f"  font-weight: {weight};",
                        f"  src: url(./fonts/{name}.woff2) format('woff2-variations');",
                        f"  unicode-range: {unicode_range(drawn)};",
                        "}",
                    ]
                )
            )
            print(f"{target.relative_to(ROOT)}: {target.stat().st_size / 1024:.1f} kB, {len(drawn)} characters")
    header = (
        "/*\n"
        " * Generated by scripts/subset-fonts.py: each typeface cut to the characters the site sets.\n"
        " * Imported after fontsource's faces, so these win for the characters they cover.\n"
        " */\n"
    )
    CSS.write_text(header + "\n" + "\n\n".join(rules) + "\n")
    subprocess.run(["npx", "prettier", "--write", str(CSS)], cwd=ROOT, check=True, capture_output=True)
    print(f"{CSS.relative_to(ROOT)} written")


if __name__ == "__main__":
    main()
