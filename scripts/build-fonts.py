"""Build the self-hosted, subset web fonts used by Stock Picks.

Typography is matched to the reference images in the specification (page 29): faces were chosen by
rendering licensed candidates at the photographed sizes and scoring their ink against the crops
(see docs/TYPOGRAPHY.md for the method, scores and evidence).

  * FreeSerif Bold (GNU FreeFont)  -> display type, headlines, tickers and major figures
    The Times Roman design; best-scoring match for "Today's picks", "NVDA" and "$142.80".
  * Roboto Flex, wght 400-700       -> interface text, labels, controls and data

Sources
  * GNU FreeFont, FreeSerifBold.ttf: https://savannah.gnu.org/projects/freefont/
    (also packaged by Linux distributions, e.g. Debian "fonts-freefont-ttf").
    GPL-3.0-or-later with the GNU FreeFont font-embedding exception.
  * Roboto Flex: @fontsource-variable/roboto-flex (Google Fonts build), SIL OFL 1.1.

FreeSerif is only subset (unaltered glyphs, hinting and names kept) and re-wrapped as WOFF2, so
pages that use it stay outside the GPL under the font exception; the font files themselves remain
GPL and ship with their licence. Each family is split into a "latin" file (preloaded) and a
"latin-ext" file that browsers fetch only when a page contains those characters (unicode-range in
src/styles/fonts.css).

Usage (one-off asset build; outputs are committed under public/fonts):
  pip install fonttools brotli
  python3 scripts/build-fonts.py --freeserif /usr/share/fonts/truetype/freefont/FreeSerifBold.ttf
"""

from __future__ import annotations

import argparse
import io
import pathlib
import shutil

from fontTools import subset
from fontTools.pens.boundsPen import BoundsPen
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / "public" / "fonts"
ROBOTO_FLEX_SRC = ROOT / "node_modules" / "@fontsource-variable" / "roboto-flex"
GPL3_CANDIDATES = [pathlib.Path("/usr/share/common-licenses/GPL-3")]

LATIN = (
    "U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,"
    "U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD"
)
LATIN_EXT = (
    "U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+1D00-1DBF,"
    "U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF"
)
FEATURES = ["kern", "liga", "calt", "ccmp", "locl", "mark", "mkmk", "tnum", "pnum", "lnum", "case", "frac"]

# Representative text for fallback width matching: headlines, figures and interface copy.
SAMPLE = (
    "Today's picks. NVDA $142.80 +2.34% The market. On the radar Earnings strength. "
    "Growing demand. Demand growth supports the next earnings cycle. Add to watchlist"
)

FREEFONT_EXCEPTION = """\
GNU FreeFont (FreeSerif Bold, {version}), used by Stock Picks for display type.

{copyright}
Source: https://savannah.gnu.org/projects/freefont/

GNU FreeFont is free software; you can redistribute it and/or modify it under the terms of the
GNU General Public License as published by the Free Software Foundation; either version 3 of the
License, or (at your option) any later version.

The fonts are distributed in the hope that they will be useful, but WITHOUT ANY WARRANTY; without
even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU
General Public License for more details.

Font exception (as distributed with GNU FreeFont):

  As a special exception, if you create a document which uses this font, and embed this font or
  unaltered portions of this font into the document, this font does not by itself cause the
  resulting document to be covered by the GNU General Public License. This exception does not
  however invalidate any other reasons why the document might be covered by the GNU General Public
  License. If you modify this font, you may extend this exception to your version of the font, but
  you are not obligated to do so. If you do not wish to do so, delete this exception statement
  from your version.

The files freeserif-700-latin.woff2 and freeserif-700-latin-ext.woff2 contain unaltered portions of
FreeSerifBold.ttf (glyph subsets, hinting and naming kept), re-wrapped as WOFF2 by
scripts/build-fonts.py. The complete GNU General Public License version 3 follows.

"""


def parse_ranges(spec: str) -> list[int]:
    codepoints: list[int] = []
    for part in spec.split(","):
        part = part.strip().removeprefix("U+")
        if "-" in part:
            start, end = part.split("-")
            codepoints.extend(range(int(start, 16), int(end, 16) + 1))
        else:
            codepoints.append(int(part, 16))
    return codepoints


def reload(font: TTFont) -> TTFont:
    """Round-trip through bytes so instanced tables are fully materialised before subsetting."""
    buffer = io.BytesIO()
    font.recalcTimestamp = False
    font.save(buffer)
    buffer.seek(0)
    return TTFont(buffer, lazy=False)


def write_subset(font: TTFont, unicodes: list[int], target: pathlib.Path, *, keep_hinting: bool) -> None:
    font = reload(font)
    options = subset.Options()
    options.flavor = "woff2"
    options.layout_features = FEATURES
    options.name_IDs = ["*"]
    options.name_languages = ["*"]
    options.notdef_outline = True
    options.hinting = keep_hinting
    options.desubroutinize = not keep_hinting
    subsetter = subset.Subsetter(options=options)
    subsetter.populate(unicodes=unicodes)
    subsetter.subset(font)
    font.flavor = "woff2"
    font.recalcTimestamp = False  # keep head.modified from the source: reproducible output
    font.save(target)
    print(f"  {target.relative_to(ROOT)}  {target.stat().st_size / 1024:.1f} KiB")


def advance(font: TTFont, text: str) -> float:
    """Sum of advance widths in em (no kerning) for the characters that the font maps."""
    cmap = font.getBestCmap()
    hmtx = font["hmtx"]
    upm = font["head"].unitsPerEm
    return sum(hmtx[cmap[ord(c)]][0] for c in text if ord(c) in cmap) / upm


def fallback_overrides(name: str, font: TTFont, fallback: pathlib.Path | None) -> None:
    """Print @font-face overrides that make a local fallback occupy the same space (no CLS)."""
    os2 = font["OS/2"]
    upm = font["head"].unitsPerEm
    ascent, descent = os2.sTypoAscender / upm, -os2.sTypoDescender / upm
    line_gap = os2.sTypoLineGap / upm
    if fallback is None or not fallback.exists():
        print(f"  {name}: fallback font not found; overrides not computed")
        return
    reference = TTFont(fallback)
    size_adjust = advance(font, SAMPLE) / advance(reference, SAMPLE)
    print(
        f"  {name} vs {fallback.name}: size-adjust {size_adjust * 100:.1f}%; "
        f"ascent-override {ascent / size_adjust * 100:.1f}%; descent-override {descent / size_adjust * 100:.1f}%; "
        f"line-gap-override {line_gap / size_adjust * 100:.1f}%"
    )


def build_freeserif(source: pathlib.Path) -> None:
    print("FreeSerif Bold (GNU FreeFont)")
    for name, ranges in (("latin", LATIN), ("latin-ext", LATIN_EXT)):
        write_subset(TTFont(source, lazy=False), parse_ranges(ranges), OUT / f"freeserif-700-{name}.woff2", keep_hinting=True)
    gpl = next((path for path in GPL3_CANDIDATES if path.exists()), None)
    names = TTFont(source)["name"]
    header = FREEFONT_EXCEPTION.format(
        version=names.getDebugName(5).strip(), copyright=names.getDebugName(0).strip()
    )
    text = header + (gpl.read_text() if gpl else "See https://www.gnu.org/licenses/gpl-3.0.txt\n")
    (OUT / "FreeSerif-LICENSE.txt").write_text(text)
    fallback_overrides("FreeSerif Fallback", TTFont(source), pathlib.Path("/usr/share/fonts/truetype/liberation/LiberationSerif-Bold.ttf"))


def build_mark(source: pathlib.Path) -> None:
    """The brand mark "S." drawn from the display face's own outlines (public/favicon.svg)."""
    font = TTFont(source)
    glyphs = font.getGlyphSet()
    cmap = font.getBestCmap()
    letter, dot = cmap[ord("S")], cmap[ord(".")]
    dot_x = font["hmtx"][letter][0] - 0.02 * font["head"].unitsPerEm  # display tracking

    def outline(name: str) -> str:
        pen = SVGPathPen(glyphs)
        glyphs[name].draw(pen)
        return pen.getCommands()

    def bounds(name: str, dx: float = 0) -> tuple[float, float, float, float]:
        pen = BoundsPen(glyphs)
        glyphs[name].draw(pen)
        x0, y0, x1, y1 = pen.bounds
        return x0 + dx, y0, x1 + dx, y1

    a, b = bounds(letter), bounds(dot, dot_x)
    x0, y0, x1, y1 = min(a[0], b[0]), min(a[1], b[1]), max(a[2], b[2]), max(a[3], b[3])
    scale = 40 / (y1 - y0)  # 40 of 64 px tall, as the wordmark sits in the app icon
    tx = (64 - (x1 - x0) * scale) / 2 - x0 * scale
    ty = (64 - (y1 - y0) * scale) / 2 + y1 * scale
    svg = (
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">\n'
        '  <rect width="64" height="64" rx="12" fill="#F8F5ED"/>\n'
        f'  <g transform="translate({tx:.2f} {ty:.2f}) scale({scale:.5f} {-scale:.5f})">\n'
        f'    <path d="{outline(letter)}" fill="#111613"/>\n'
        f'    <g transform="translate({dot_x:.1f} 0)"><path d="{outline(dot)}" fill="#F3482D"/></g>\n'
        "  </g>\n"
        "</svg>\n"
    )
    target = ROOT / "public" / "favicon.svg"
    target.write_text(svg)
    print(f"  {target.relative_to(ROOT)}  {len(svg) / 1024:.1f} KiB")


def build_roboto_flex() -> None:
    print("Roboto Flex (wght 400-700, other axes at their defaults)")
    for name, ranges in (("latin", LATIN), ("latin-ext", LATIN_EXT)):
        source = ROBOTO_FLEX_SRC / "files" / f"roboto-flex-{name}-wght-normal.woff2"
        font = instancer.instantiateVariableFont(TTFont(source, lazy=False), {"wght": (400, 700)})
        write_subset(font, parse_ranges(ranges), OUT / f"roboto-flex-400-700-{name}.woff2", keep_hinting=False)
    shutil.copyfile(ROBOTO_FLEX_SRC / "LICENSE", OUT / "RobotoFlex-OFL.txt")
    regular = instancer.instantiateVariableFont(
        TTFont(ROBOTO_FLEX_SRC / "files" / "roboto-flex-latin-wght-normal.woff2", lazy=False), {"wght": 400}
    )
    fallback_overrides("Roboto Flex Fallback", regular, pathlib.Path("/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf"))


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument(
        "--freeserif",
        type=pathlib.Path,
        default=pathlib.Path("/usr/share/fonts/truetype/freefont/FreeSerifBold.ttf"),
        help="Path to FreeSerifBold.ttf from GNU FreeFont",
    )
    args = parser.parse_args()
    if not args.freeserif.exists():
        raise SystemExit(f"FreeSerifBold.ttf not found at {args.freeserif}; pass --freeserif PATH")
    OUT.mkdir(parents=True, exist_ok=True)
    build_freeserif(args.freeserif)
    build_mark(args.freeserif)
    build_roboto_flex()


if __name__ == "__main__":
    main()
