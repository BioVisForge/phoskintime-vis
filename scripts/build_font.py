#!/usr/bin/env python3
"""Build the bundled UI/export font "PKV Sans" (dev only; needs fontTools).

PKV Sans = a subset of Noto Sans (Regular, Bold) with math operators that Noto Sans lacks
(− ≤ ≥ → ≈ ≠ √ ∞ ∑ …) copied from Noto Sans Math. All three are SIL Open Font License 1.1
(see THIRD_PARTY.md). Renamed so it cannot be confused with the upstream fonts.

Usage: python scripts/build_font.py [noto font dir]   (default /usr/share/fonts/truetype/noto)
Writes src/assets/fonts/PKVSans-{Regular,Bold}.ttf
"""
import sys
from pathlib import Path

from fontTools.pens.ttGlyphPen import TTGlyphPen
from fontTools.subset import Options, Subsetter
from fontTools.ttLib import TTFont

SRC = Path(sys.argv[1] if len(sys.argv) > 1 else "/usr/share/fonts/truetype/noto")
OUT = Path(__file__).resolve().parents[1] / "src/assets/fonts"
RANGES = [(0x20, 0x7E), (0xA0, 0x17F), (0x370, 0x3FF), (0x2000, 0x206F), (0x2070, 0x209F), (0x2100, 0x214F), (0x2190, 0x21FF), (0x2200, 0x22FF), (0x25A0, 0x25FF)]
UNICODES = sorted({u for a, b in RANGES for u in range(a, b + 1)})
MATH_NEEDED = "−≤≥→←↑↓↔∑√∞≈≠∓∝∈∉∂∇∫⋅∗∼≡≪≫⊂⊆∧∨¬∀∃∅∠∥⟨⟩"


def subset(font: TTFont, unicodes):
    o = Options()
    o.layout_features = ["kern"]
    o.hinting = True  # unhinted glyphs showed spurious gaps at small sizes (e.g. "T ime") in Chromium
    o.name_IDs = ["*"]
    o.notdef_outline = True
    o.glyph_names = False
    s = Subsetter(o)
    s.populate(unicodes=unicodes)
    s.subset(font)


def copy_glyphs(base: TTFont, donor: TTFont, chars: str):
    bcmap = base.getBestCmap()
    dcmap = donor.getBestCmap()
    dgs = donor.getGlyphSet()
    added = []
    for ch in chars:
        u = ord(ch)
        if u in bcmap or u not in dcmap:
            continue
        src = dcmap[u]
        name = f"uni{u:04X}"
        pen = TTGlyphPen(None)
        dgs[src].draw(pen)  # decomposes composites
        base["glyf"][name] = pen.glyph()
        base["hmtx"][name] = donor["hmtx"][src]
        order = base.getGlyphOrder()
        if name not in order:
            base.setGlyphOrder(order + [name])
        for t in base["cmap"].tables:
            if t.isUnicode():
                t.cmap[u] = name
        added.append(ch)
    base["maxp"].numGlyphs = len(base.getGlyphOrder())
    return added


def rename(font: TTFont, family: str, style: str):
    full = f"{family} {style}".strip()
    ps = full.replace(" ", "")
    for rec in font["name"].names:
        if rec.nameID in (1, 16):
            rec.string = family
        elif rec.nameID in (4,):
            rec.string = full
        elif rec.nameID == 6:
            rec.string = ps
        elif rec.nameID == 3:
            rec.string = f"{ps};phoskintime-vis"


def build(style: str):
    base = TTFont(SRC / f"NotoSans-{style}.ttf")
    subset(base, UNICODES)
    math = TTFont(SRC / "NotoSansMath-Regular.ttf")
    subset(math, [ord(c) for c in MATH_NEEDED])
    added = copy_glyphs(base, math, MATH_NEEDED)
    rename(base, "PKV Sans", style)
    OUT.mkdir(parents=True, exist_ok=True)
    out = OUT / f"PKVSans-{style}.ttf"
    base.save(out)
    print(f"{out.name}: {out.stat().st_size} bytes, {len(base.getGlyphOrder())} glyphs, math glyphs added: {''.join(added)}")


for st in ("Regular", "Bold"):
    build(st)
