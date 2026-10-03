"""Build the self-hosted, subset web fonts used by Stock Picks.

The application ships two families (spec page 29):
  * Bodoni Moda 700 with optical sizing  -> display type and major figures
  * Inter 400/500/600                      -> UI, body and tabular data

Sources
  * Bodoni Moda: @fontsource-variable/bodoni-moda (Google Fonts build, OFL-1.1)
  * Inter 4.1:   https://github.com/rsms/inter/releases/download/v4.1/Inter-4.1.zip (OFL-1.1)

Each family is reduced to the axes the design uses, then split into a
"latin" file (preloaded) and a "latin-ext" file that browsers fetch only when
a page contains those characters (unicode-range in src/styles/fonts.css).

Usage (one-off asset build; outputs are committed under public/fonts):
  pip install fonttools brotli
  python3 scripts/build-fonts.py --inter /path/to/Inter-4.1/InterVariable.ttf
"""

from __future__ import annotations

import argparse
import io
import pathlib
import shutil

from fontTools import subset
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / "public" / "fonts"
BODONI_SRC = ROOT / "node_modules" / "@fontsource-variable" / "bodoni-moda"

LATIN = (
    "U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,"
    "U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD"
)
LATIN_EXT = (
    "U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+1D00-1DBF,"
    "U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF"
)
FEATURES = ["kern", "liga", "calt", "ccmp", "locl", "mark", "mkmk", "tnum", "pnum", "case", "frac"]


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
    font.save(buffer)
    buffer.seek(0)
    return TTFont(buffer, lazy=False)


def write_subset(font: TTFont, unicodes: list[int], target: pathlib.Path) -> None:
    font = reload(font)
    options = subset.Options()
    options.flavor = "woff2"
    options.layout_features = FEATURES
    options.name_IDs = ["*"]
    options.name_languages = ["*"]
    options.notdef_outline = True
    options.hinting = False
    options.desubroutinize = True
    subsetter = subset.Subsetter(options=options)
    subsetter.populate(unicodes=unicodes)
    subsetter.subset(font)
    font.flavor = "woff2"
    font.save(target)
    print(f"  {target.relative_to(ROOT)}  {target.stat().st_size / 1024:.1f} KiB")


def build_bodoni() -> None:
    print("Bodoni Moda 700 (opsz 6-96)")
    for name, ranges in (("latin", LATIN), ("latin-ext", LATIN_EXT)):
        source = BODONI_SRC / "files" / f"bodoni-moda-{name}-opsz-normal.woff2"
        font = TTFont(source, lazy=False)
        font = instancer.instantiateVariableFont(font, {"wght": 700})
        write_subset(font, parse_ranges(ranges), OUT / f"bodoni-moda-700-{name}.woff2")
    shutil.copyfile(BODONI_SRC / "LICENSE", OUT / "BodoniModa-OFL.txt")


def build_inter(inter_path: pathlib.Path) -> None:
    print("Inter 400-600 (opsz 14)")
    for name, ranges in (("latin", LATIN), ("latin-ext", LATIN_EXT)):
        font = TTFont(inter_path, lazy=False)
        font = instancer.instantiateVariableFont(font, {"opsz": 14, "wght": (400, 600)})
        write_subset(font, parse_ranges(ranges), OUT / f"inter-400-600-{name}.woff2")
    license_path = inter_path.parent / "LICENSE.txt"
    if license_path.exists():
        shutil.copyfile(license_path, OUT / "Inter-OFL.txt")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--inter", type=pathlib.Path, required=True, help="Path to InterVariable.ttf (Inter 4.1)")
    args = parser.parse_args()
    OUT.mkdir(parents=True, exist_ok=True)
    build_bodoni()
    build_inter(args.inter)


if __name__ == "__main__":
    main()
