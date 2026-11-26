# 0002: Publication exports (PNG, PDF, SVG) and the vector/raster rule

Status: accepted (2026-11-26)

## One pipeline

All figure exports start from the same place. The panel is mounted **offscreen in export mode**
(`src/lib/export/ExportHost.svelte`), using:

- the light/print theme;
- the bundled font (PKV Sans) at the dialog's base size: axis labels at the base size, ticks
  and legends at 0.875 ×;
- a layout width of `width_mm × 5.6 px/mm` (85 mm → 476 px);
- the same persisted panel controls and global protein/psite/layer as on screen.

In export mode, canvas layers with at most `VECTOR_MAX` = 50,000 elements are re-rendered as SVG
by the plot wrappers (`src/lib/plot/`), so they are fully vector. Larger layers are re-drawn into
an offscreen canvas at the export resolution: `pixelRatio = dpi / (25.4 × 5.6)`, 4.2 at 600 dpi.
A screen bitmap is never copied. If a canvas layer has no export renderer, the export refuses
rather than embed a screen bitmap. `compose.ts` then builds one self-contained SVG at the dialog
size in mm:

- the plot SVGs with computed styles inlined;
- the figure's HTML text (legends, plot titles) as SVG text;
- optional title, caption and provenance footer;
- the font, as `@font-face` data URLs.

When a layer is rasterised, the caption says so ("Data layer rasterised at 600 dpi (… points
exceed the vector limit)"). This never happens silently.

## PNG

The composed SVG is drawn with `drawImage` straight onto a canvas of `round(w_mm / 25.4 × dpi)`
× `round(h_mm / 25.4 × dpi)` pixels, so the vector is rasterised at the target resolution and no
bitmap is upscaled. A `pHYs` chunk (pixels per metre) and `tEXt` chunks are added: Title,
bundle_id, phoskintime_commit, panel_id, Software, Comment. Requests above the browser canvas
limits (16,384 px per side) are refused with a message, never downscaled.

## PDF: svg2pdf.js + jsPDF

**Chosen:** `jspdf@4.2.1` + `svg2pdf.js@2.9.0`. The page size is the dialog size in mm. Text
stays real text in PKV Sans, embedded as a TrueType subset with a ToUnicode map, so labels can be
extracted (the e2e test finds "Observed" and "Predicted" with pdf.js). Metadata Title, Subject
and Keywords carry the provenance.

Alternatives considered:

| Option | Why not |
|---|---|
| pdf-lib alone | no SVG renderer: every mark would need a second drawing implementation |
| browser print-to-PDF | not programmatic in a single offline file; page and size control are poor |
| rasterising to PNG inside a PDF | not vector |
| server-side tools (Inkscape, cairosvg) | require a server or network; the app is offline |

Size: jsPDF's optional `html2canvas`, `dompurify` and `canvg` are aliased to an empty module
(`src/lib/export/empty.ts`). The export only needs the SVG path.

Font weights: only regular and bold are embedded, so composed CSS weights are mapped to 400 or
700. svg2pdf.js otherwise falls back to Times for an unregistered weight such as 500 (this was
observed).

## Vector threshold: 50,000 elements (measured)

`bench/pdf/run.mjs` measures svg2pdf.js + jsPDF on one stroked path (Chromium 159):

| points | time | PDF size |
|---|---|---|
| 5,000 | 40 ms | 0.20 MB |
| 20,000 | 72 ms | 0.79 MB |
| 50,000 | 164 ms | 1.98 MB |
| 112,000 | 300 ms | 4.43 MB |
| 250,000 | 746 ms | 9.89 MB |

Cost is about 40 bytes per point. At 50,000 points a vector layer is about 2 MB, which viewers
handle easily. Beyond that a 600 dpi image is smaller and renders faster in PDF viewers. In the
current panels only "raw lines" (all trajectories, 112,000 points) crosses the limit. GOF (two
marks of 4,912 points) stays fully vector; the e2e test checks that it contains 0 images.

## SVG

The same composed SVG with `width="…mm" height="…mm"`, inline styles and the light theme. The
font is embedded as a data URL by default; the dialog option "Embed font in SVG" switches to
referencing `'PKV Sans'` by name.

## Fit

When long tick labels overhang a plot's own box (for example parameter labels in the ridgeline
at 85 mm), the whole figure is scaled to fit the dialog width, and the caption states the
percentage.
