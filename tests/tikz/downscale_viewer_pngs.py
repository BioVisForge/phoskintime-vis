#!/usr/bin/env python3
"""Downscale the viewer PNGs in docs/screenshots/tikz to the width of the 200 dpi TikZ renders
(670 px) so the gallery stays small. Dev only (Pillow). Run after tests/tikz/gallery.mjs."""
import glob
from PIL import Image

for f in glob.glob("docs/screenshots/tikz/*_viewer.png"):
    im = Image.open(f).convert("RGB")
    if im.width > 670:
        im = im.resize((670, round(im.height * 670 / im.width)), Image.LANCZOS)
    im.save(f, optimize=True)
