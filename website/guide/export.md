# Export figures

Open a panel's **⋯** menu. The format entries export at once with your last settings; **Export
options…** opens the dialog.

| Format | What you get |
|---|---|
| PNG | 300, **600** (default) or 1200 dpi, with the resolution and provenance stored in the file |
| PDF | vector, real text, embedded font |
| SVG | size in millimetres |
| CSV | the plotted data with units and provenance in the header |
| TikZ / PGFPlots | **LaTeX source, not a rendered figure**: a zip you compile yourself (below) |

## Dialog settings

- **Size**: single column 85 mm, 1.5 column 114 mm, double column 174 mm, poster or custom.
- **Base size**: 6 to 12 pt. Ticks and legends are 0.875 × this size.
- **Contents**: title, caption with the definition, provenance footer, embedded SVG font, and
  downsampling for TeX.

Files are named `<panel>_<bundle>_<date>.<extension>`.

## When labels do not fit

Text is never made smaller than your chosen size unless you say so. If something sticks out of
the chosen width, nothing is exported and the dialog names it and offers:

| Choice | Effect | Written in the caption |
|---|---|---|
| Shorter labels | long tick labels are cut with `…` (numbers never are; the CSV keeps the full labels) | yes |
| Fewer ticks | only every 2nd to 4th tick label | yes |
| Next width | 114 or 174 mm, with the plot drawn narrower where labels need room | no |
| Scale anyway | the whole figure is scaled down; the button shows the resulting pt size | yes |

A choice applies to that one export.

## What is in the TikZ zip

| File | Use |
|---|---|
| `<panel>.tex` | the `tikzpicture`, to `\input` into your document |
| `<panel>-standalone.tex` | compiles on its own: `lualatex <panel>-standalone.tex` gives the figure as PDF |
| `data/*.dat` | the plotted values at full precision |
| `fonts/`, `README.txt`, `PROVENANCE.txt` | the LuaLaTeX font, compile instructions and the source run |

If you want a finished figure without LaTeX, use PDF, SVG or PNG.

## Export everything

Open the command palette and choose **Export all panels…** for one zip.

## Using the files

- Raster layers appear in vector files only for very large data layers (over 50,000 points), and
  the caption then says so.
- TikZ: compile the `*-standalone.tex` file. Large figures need LuaLaTeX; the README in the zip
  says whether pdfLaTeX is enough.
