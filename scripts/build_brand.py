#!/usr/bin/env python3
"""Generate the PhosKinTime-Vis marks (SVG). Dev only: needs fontTools.

The mark combines the BioVisForge visual language (navy tile, drafting grid, copper forge gear)
with PhosKinTime's (a kinetic time course through signalling nodes, with a phosphate tag).
The wordmark is outlined from the bundled PKV Sans Bold, so it renders identically everywhere.
Raster versions and favicons: node scripts/build-brand-rasters.mjs
"""
import math
from pathlib import Path

from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.ttLib import TTFont

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "assets" / "brand"
NAVY, NAVY_LINE, COPPER, COPPER_DARK = "#1f2a44", "#34415f", "#c4692f", "#8f4a22"
ORANGE, AMBER, RED, TEAL, BLUE = "#ff9f1c", "#ffbf69", "#e71d36", "#2ec4b6", "#3a8fd6"


def gear(cx, cy, outer, root, inner, teeth):
    """A gear ring as one path (outer toothed contour plus a circular hole, even-odd)."""
    step = 2 * math.pi / teeth
    pts = []
    for i in range(teeth):
        a = i * step - math.pi / 2
        for da, r in ((-0.30, root), (-0.19, outer), (0.19, outer), (0.30, root)):
            pts.append((cx + r * math.cos(a + da * step), cy + r * math.sin(a + da * step)))
    d = "M" + " L".join(f"{x:.1f} {y:.1f}" for x, y in pts) + " Z"
    hole = f"M{cx - inner} {cy}a{inner} {inner} 0 1 0 {2 * inner} 0a{inner} {inner} 0 1 0 {-2 * inner} 0Z"
    return d + hole


def mark(prefix="m"):
    """The full mark on a 512 x 512 canvas (returns inner SVG)."""
    grid = "".join(f"M{v} 0V512M0 {v}H512" for v in (64, 256, 448))
    return f"""<defs>
<linearGradient id="{prefix}-wave" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="{ORANGE}"/><stop offset="0.55" stop-color="{AMBER}"/><stop offset="1" stop-color="{RED}"/></linearGradient>
<clipPath id="{prefix}-in"><circle cx="256" cy="256" r="164"/></clipPath>
<clipPath id="{prefix}-tile"><rect width="512" height="512" rx="104"/></clipPath>
</defs>
<g clip-path="url(#{prefix}-tile)"><rect width="512" height="512" fill="{NAVY}"/><path d="{grid}M0 0L512 512M512 0L0 512" stroke="{NAVY_LINE}" stroke-width="3" fill="none"/></g>
<path d="{gear(256, 256, 232, 200, 172, 12)}" fill="{COPPER}" fill-rule="evenodd" stroke="{COPPER_DARK}" stroke-width="6" stroke-linejoin="round"/>
<circle cx="256" cy="256" r="172" fill="{NAVY}"/>
<g clip-path="url(#{prefix}-in)">
<g fill="{BLUE}" opacity="0.9"><rect x="150" y="340" width="34" height="90" rx="5" opacity="0.45"/><rect x="194" y="316" width="34" height="114" rx="5" opacity="0.6"/><rect x="238" y="356" width="34" height="74" rx="5" opacity="0.45"/><rect x="282" y="372" width="34" height="58" rx="5" opacity="0.35"/><rect x="326" y="352" width="34" height="78" rx="5" opacity="0.45"/></g>
<path d="M150 186L256 138L372 196M150 186L372 196" stroke="#8fa3c7" stroke-width="7" fill="none" stroke-linecap="round"/>
<path d="M92 316C150 316 168 304 196 262C220 224 232 206 258 206C292 206 300 286 344 292C372 296 390 270 424 264" stroke="url(#{prefix}-wave)" stroke-width="30" fill="none" stroke-linecap="round"/>
</g>
<g stroke="#ffffff" stroke-width="7"><circle cx="150" cy="186" r="23" fill="{BLUE}"/><circle cx="372" cy="196" r="23" fill="{BLUE}"/><circle cx="256" cy="138" r="31" fill="{TEAL}"/></g>
<circle cx="258" cy="206" r="30" fill="{RED}" stroke="#ffffff" stroke-width="7"/>
<path d="M249 224V188h12a11.5 11.5 0 0 1 0 23h-12" fill="none" stroke="#ffffff" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/>"""


def favicon():
    """Simplified mark that stays legible at 16 px: tile, copper ring, wave, phosphate."""
    return f"""<defs><linearGradient id="f-wave" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="{ORANGE}"/><stop offset="1" stop-color="{AMBER}"/></linearGradient></defs>
<rect width="64" height="64" rx="14" fill="{NAVY}"/>
<path d="{gear(32, 32, 30, 25.5, 21.5, 8)}" fill="{COPPER}" fill-rule="evenodd"/>
<path d="M14 40C21 40 23 25 31 25C38 25 39 38 50 36" stroke="url(#f-wave)" stroke-width="6" fill="none" stroke-linecap="round"/>
<circle cx="31" cy="25" r="7" fill="{RED}" stroke="#fff" stroke-width="2.5"/>"""


def outline(text, size, x, y, fill):
    """Text as paths from PKV Sans Bold; returns (svg, advance width)."""
    font = TTFont(ROOT / "src" / "assets" / "fonts" / "PKVSans-Bold.ttf")
    glyphs, cmap, upm = font.getGlyphSet(), font.getBestCmap(), font["head"].unitsPerEm
    scale, pen_x, parts = size / upm, 0, []
    for ch in text:
        name = cmap[ord(ch)]
        pen = SVGPathPen(glyphs)
        glyphs[name].draw(pen)
        if pen.getCommands():
            parts.append(f'<path transform="translate({x + pen_x * scale:.2f} {y}) scale({scale:.5f} {-scale:.5f})" d="{pen.getCommands()}"/>')
        pen_x += glyphs[name].width
    return f'<g fill="{fill}">{"".join(parts)}</g>', pen_x * scale


def svg(view_w, view_h, body, label):
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {view_w} {view_h}" role="img" aria-label="{label}">{body}</svg>\n'


def wordmark(ink, accent, sub):
    a, wa = outline("PhosKinTime", 96, 190, 108, ink)
    b, wb = outline("-Vis", 96, 190 + wa, 108, accent)
    c, wc = outline("BioVisForge", 40, 193, 158, sub)
    icon = f'<g transform="scale({168 / 512})">{mark("w")}</g>'
    return svg(round(190 + wa + wb + 8), 168, icon + a + b + c, "PhosKinTime-Vis by BioVisForge")


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / "logo.svg").write_text(svg(512, 512, mark(), "PhosKinTime-Vis"))
    (OUT / "favicon.svg").write_text(svg(64, 64, favicon(), "PhosKinTime-Vis"))
    (OUT / "wordmark-light.svg").write_text(wordmark(NAVY, "#12857b", "#a3531f"))
    (OUT / "wordmark-dark.svg").write_text(wordmark("#f4f6fb", TEAL, "#e8935c"))
    print("wrote", ", ".join(sorted(p.name for p in OUT.glob("*.svg"))))


if __name__ == "__main__":
    main()
