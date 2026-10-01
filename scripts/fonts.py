#!/usr/bin/env python3
"""
Build the self-hosted fonts in src/assets/fonts from the @fontsource-variable
packages (SIL OFL).

Each face is instanced to the axes the design uses, then split in two:
  core      ASCII plus the punctuation and symbols the interface prints.
            Small enough to preload; this is all an English page needs.
  extended  The rest of Latin-1 and friends (accented names in a surveyed
            company, for example). Never preloaded: the browser fetches it only
            when a page contains one of its characters (CSS unicode-range).

Usage:  pip install fonttools brotli && python3 scripts/fonts.py
Keep CORE and EXTENDED in sync with the unicode-range lists in src/styles/fonts.css.
"""
from io import BytesIO
from pathlib import Path

from fontTools import subset
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "node_modules" / "@fontsource-variable"
OUT = ROOT / "src" / "assets" / "fonts"

CORE = (
    "U+0020-007E,U+00A0,U+00A3,U+00A7,U+00A9,U+00AB,U+00AE,U+00B0,U+00B1,U+00B7,U+00BB,U+00BD,"
    "U+00D7,U+00F7,U+2013-2014,U+2018-201A,U+201C-201E,U+2022,U+2026,U+2032-2033,U+2039-203A,"
    "U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215"
)
# Disjoint from CORE: where ranges overlap, the browser would fetch both files.
EXTENDED = (
    "U+00A1-00A2,U+00A4-00A6,U+00A8,U+00AA,U+00AC-00AD,U+00AF,U+00B2-00B6,U+00B8-00BA,U+00BC,"
    "U+00BE-00D6,U+00D8-00F6,U+00F8-00FF,U+0131,U+0152-0153,U+02C6,U+02DA,U+02DC,U+2044"
)

FEATURES = ["kern", "liga", "pnum", "tnum", "frac"]

FACES = [
    # (output name, source file, axis limits)
    ("newsreader-display", "newsreader/files/newsreader-latin-standard-normal.woff2", {"opsz": 60, "wght": (300, 560)}),
    ("newsreader-italic", "newsreader/files/newsreader-latin-standard-italic.woff2", {"opsz": 30, "wght": (300, 520)}),
    ("newsreader-text", "newsreader/files/newsreader-latin-standard-normal.woff2", {"opsz": 14, "wght": (380, 560)}),
    ("archivo", "archivo/files/archivo-latin-standard-normal.woff2", {"wght": (300, 800), "wdth": (62, 100)}),
]


def unicodes(spec: str) -> list[int]:
    out: list[int] = []
    for part in spec.split(","):
        lo, _, hi = part.removeprefix("U+").partition("-")
        out.extend(range(int(lo, 16), int(hi or lo, 16) + 1))
    return out


def build(name: str, source: str, limits: dict) -> None:
    core = set(unicodes(CORE))
    for suffix, wanted in (("", core), ("-ext", set(unicodes(EXTENDED)))):
        # Subsetting mutates the font, so each part starts from a fresh instance,
        # round-tripped through bytes so every table is fully decompiled.
        buffer = BytesIO()
        instancer.instantiateVariableFont(TTFont(SRC / source), limits).save(buffer)
        buffer.seek(0)
        font = TTFont(buffer)
        options = subset.Options()
        options.flavor = "woff2"
        options.layout_features = FEATURES
        options.name_IDs = [0, 1, 2, 3, 4, 5, 6]  # keep copyright and naming, as the OFL asks
        options.notdef_outline = True
        subsetter = subset.Subsetter(options)
        subsetter.populate(unicodes=wanted)
        subsetter.subset(font)
        path = OUT / f"{name}{suffix}.woff2"
        font.flavor = "woff2"
        font.save(path)
        print(f"{path.relative_to(ROOT)}  {path.stat().st_size / 1024:.1f} KB")


if __name__ == "__main__":
    for face in FACES:
        build(*face)
