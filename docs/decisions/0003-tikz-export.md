# 0003: TikZ / PGFPlots export

Status: accepted (2026-11-26)

## Design: a matplot2tikz for this viewer

Every mark a panel draws goes through a thin wrapper (`src/lib/plot/*.svelte`) that records the
mark type, its props (data and channel accessors) and the Plot's resolved scales into a
`FigureCollector`, then renders the SveltePlot mark unchanged. `src/lib/tikz/emit.ts` turns that
spec into PGFPlots code by evaluating the same accessors on the same data; there is no second
plotting implementation and no Python. The export renders the panel offscreen in export mode, as
in decision 0002, and emits:

- `<panel>.tex`: a `tikzpicture` to `\input`, with each Plot as a PGFPlots `axis` or a
  `groupplot` for facets. Each axis is placed in a shifted `scope` at its exact position and
  size: `scale only axis`, with width and height taken from the plot's inner area.
- `<panel>-standalone.tex`: a `standalone` document with `\pgfplotsset{compat=1.18}`. It uses the
  libraries it needs (`groupplots`, `statistics`, `colormaps`, TikZ `calc`, `arrows.meta`) and a
  `\definecolor` per colour (Okabe–Ito names such as `OIblue`). Under LuaLaTeX it uses PKV Sans
  via fontspec; under pdfLaTeX it falls back to helvet.
- `data/*.dat`: tab-separated, every number via `toPrecision(17)`. Parsing recovers the exact
  float64 that was plotted (unit test with `Object.is`). `nan` marks a gap (`unbounded
  coords=jump`).
- `<panel>-layer.png`: only for layers above the TeX limit (600 dpi), placed with
  `\addplot graphics` at the exact axis bounds.
- `README.txt` with the required packages, `fonts/` (PKV Sans plus its OFL notice), and
  `PROVENANCE.txt`. Every `.tex` starts with a provenance header and the compile command.

## Mark → PGFPlots mapping (unit-tested with golden snapshots, `tests/unit/__snapshots__/tikz/`)

| Mark | PGFPlots |
|---|---|
| Line | `\addplot[no markers]`, one per z group; `const plot mark left` for step curves (kinase activity as the RHS uses it) |
| Dot | `only marks` grouped by colour; `scatter` with `point meta` for continuous colour |
| AreaY (band, ridge) | **closed filled polygon** (upper edge forward, lower edge backward, `-- cycle`). See below for why this is not `fill between`. |
| DifferenceY | positive and negative polygons **precomputed in JS**, with the sign changes interpolated linearly as on screen; no TeX-side intersections |
| BoxY | `boxplot prepared` with the viewer's own Tukey statistics (`draw direction=y`), outliers as marks |
| RuleX/RuleY | segments with `nan` separators |
| RegressionY | OLS line plus a CI polygon computed with SveltePlot's own `confidenceInterval`, so the band is the viewer's |
| Vector (direction-of-time arrows) | `\draw[-Stealth]` of fixed length along the segment, using `calc` partway modifiers in axis coordinates, so the direction is correct in pixel space. Not `quiver`: quiver lengths are in data units and cannot express "fixed screen length along the drawn path". |
| Cell / dense heatmap | `matrix plot*` with `mesh/cols`; missing cells are `nan` and left blank |
| Raster above the limit | `\addplot graphics` (600 dpi) with exact bounds |
| Facets | `groupplot` (cell titles; no per-cell legend, because the title names the category) |
| Text, CustomMark | `\node`s; ring, cross and triangle glyphs as marks |
| symlog axes | `x coord trafo` of d3's symlog (`sign(x)·ln(1+|x|/C)`, using the plot's constant C), computed with the PGF floating-point unit (fixed-point TeX overflows above 16,383) |

Labels come from the bundle manifest and are LaTeX-escaped (`_ % & # $ { } ~ ^ \`). Greek and
operators become math (`$\mu^*$`, `$\sigma$`, `$\Delta$`). Tick numbers use the text font
(`assume math mode`).

### Why bands are polygons, not `fill between`

With `fillbetween`, PGFPlots switches to layered drawing. Inside a shifted `scope` or
`groupplot`, the bands were not drawn and the axis frames disappeared (observed in the compiled
"all trajectories" export). A closed polygon through the same data points is exact, needs no
library, and survives any placement.

## Size limits (measured with TeX Live 2025)

Synthetic scatter of N marks in one axis (`only marks`):

| N | pdfLaTeX | LuaLaTeX |
|---|---|---|
| 3,000 | ok (3.3 s) | ok (2.9 s) |
| 5,000 | ok (4.9 s) | ok (4.2 s) |
| 8,000 | **fails** (main memory 5,000,000) | ok (5.6 s) |
| 20,000 | fails | ok (11.7 s) |
| 40,000 | fails | ok (22.1 s) |
| 80,000 | fails | ok (43.6 s) |

- A layer above **20,000 points** (`TEX_MAX_POINTS`) becomes `\addplot graphics` at 600 dpi.
  The `%` comment, the README and the dialog all say so. LuaLaTeX could take more, but compile
  time grows linearly (about 0.55 s per 1,000 marks).
- Every export records `% points: N; pdflatex: yes|no`. pdfLaTeX is listed only up to 5,000
  points (`PDFLATEX_MAX_POINTS`); above that, LuaLaTeX is required. `tests/tikz/compile_all.sh`
  compiles every panel with LuaLaTeX, and also with pdfLaTeX when the header says yes.
- "Downsample for TeX" (largest-triangle-three-buckets) is off by default. When it is on, the
  file header and the README state it.

Results on the spec fixtures (37 panels, `docs/tikz-compile-results.txt`): **all 37 compile with
LuaLaTeX**, and 34 also compile with pdfLaTeX. `nm-gof` (19,773 points), `nm-post-ridge` (19,275)
and `nm-residuals` (16,837) are marked LuaLaTeX-only. No panel needs a raster layer at the default
settings; "raw lines" (112,000 points) is the only layer that becomes `\addplot graphics`.

## Raw TikZ fallback: svg2tikz, rejected

`svg2tikz@0.1.1` (npm, MIT) was tried on the composed SVG exports of GOF, all trajectories and
the posterior ridgeline. All three compiled with LuaLaTeX, but none looked right:

- in GOF, the nested plot SVGs were mispositioned and shrunk;
- in all trajectories, band colours and opacities were lost, with grey and blue blocks instead
  of the quantile bands;
- the GOF conversion took 22 s and produced a 4 MB `.tex` of raw paths.

It also needs jsdom (in Node) and adds weight for an option that only reproduces drawings, not
axes and data. It is left out.
