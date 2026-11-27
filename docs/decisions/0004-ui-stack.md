# 0004: UI stack and visual design

Status: accepted (2026-11-26)

## Libraries

**No UI component library.** The shell (top bar, sidebar, inspector, context bar, command
palette, export dialog, menus) is written in plain Svelte 5 with native elements:

- `<dialog>` with `showModal()` provides focus trapping, Escape and the backdrop;
- `<button>` and `role="menu"`, `combobox` and `listbox` follow the WAI-ARIA patterns.

Headless libraries (Bits UI, Melt UI) were not needed for the handful of widgets and would add
weight to a single offline file. There is no CSS-in-JS: styles are Svelte-scoped CSS plus design
tokens (CSS custom properties) in `src/app.css`.

Only new dependencies for the export work: `jspdf` and `svg2pdf.js` (decision 0002). Dev only:
`pdf-lib`, `pdfjs-dist`, `pngjs`, `@axe-core/playwright`.

## Design tokens

`src/app.css` defines colour, spacing, radius, typography and elevation for light and dark.
Dark is tuned for plots: the surface is `#1a1e26` and the page `#12151b`, never pure black.
Text tokens meet WCAG AA on their surfaces in both themes (secondary text 8.3:1 light and 9.1:1
dark; tertiary 5.9:1 and 6.5:1). Axe (`wcag2a` and `wcag2aa`) runs on every section in both
themes in the e2e suite, in Chromium and Firefox, and fails on serious or critical violations.
In Playwright's Firefox (build 1572) one read of the DOM property `ariaLabelledByElements`, which
axe-core 4.14.1 performs, segfaults the content process; the spec removes the getter in Firefox so
that axe reads the `aria-labelledby` attribute instead. The app never reads the property. The
crash was reproduced only inside the Playwright test runner; stock Firefox was not tried. Density: comfortable or
compact, through spacing tokens.

## Data colours

- **Categorical:** Okabe–Ito, reordered to `#0072B2, #E69F00, #009E73, #D55E00, #56B4E9,
  #CC79A7` (then `#F0E442`, `#999999` for more than 6 categories). Checked with the dataviz
  skill's `validate_palette.js` on white: CVD ΔE between adjacent slots ≥ 9.6, normal-vision
  ΔE ≥ 20. Orange and sky blue are below 3:1 contrast on white, so every chart keeps a legend
  and a "View data" table. The same order is used in the UI (`setPlotDefaults`), PNG, PDF, SVG
  and TikZ (`\definecolor{OIblue}` …).
- **Sequential:** viridis. **Diverging:** RdBu centred at 0.
- Neutral marks use the ink token, so they invert in dark mode; exports always use light ink.

## Typography

PKV Sans (a Noto Sans subset plus Noto Sans Math operators, OFL; see `THIRD_PARTY.md`) is used
for both the UI and exports. It is bundled as data URLs: no font request, and the file works
offline. Tables use tabular numerals. The subset keeps TrueType hinting: an unhinted subset
showed spurious gaps at small sizes in Chromium ("T ime", "FIXT URE").

## Information architecture

Sections follow scientific questions (Overview, Fit quality, Dynamics, Parameters, Uncertainty,
Sensitivity, Steady state & network, Compare). protwise and networkmodel are tags (a filter), not
separate trees. A global protein / psite / layer bar drives dependent panels and the URL hash
(`#/dynamics/nm-timeseries?protein=G007&layer=phospho`). Ctrl/⌘ + K opens the command palette.
The registry gained one field, `topic`, for navigation; every other registry field and its
meaning is unchanged.

## Size budget

The single-file build is 2.5 MB at most, including the fonts and PDF libraries. Measured sizes
are in `docs/performance.md`.
