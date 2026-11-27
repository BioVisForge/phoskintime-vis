<script lang="ts">
  import { untrack, type Component } from 'svelte'
  import { setPlotDefaults } from 'svelteplot'
  import { setExportMode, setCollector, VECTOR_MAX, type FigureCollector } from '../plot'
  import { LAYOUT_PX_PER_MM, ptToLayoutPx, type ExportSettings } from './settings'
  import { okabeIto } from '../ui/palette'
  import { FONT_FAMILY } from './fonts'
  import { setPanelId } from '../ui/panelState'

  /** Renders one panel (or comparison view) offscreen in export mode: print theme, export font, dialog size. */
  let { component, props, settings, collector, panelId }: { component: Component<any>; props: Record<string, unknown>; settings: ExportSettings; collector: FigureCollector; panelId: string } = $props()
  const s = untrack(() => $state.snapshot(settings)) as ExportSettings
  setExportMode({ active: true, vectorMax: VECTOR_MAX, pixelRatio: s.dpi / (25.4 * LAYOUT_PX_PER_MM) })
  setCollector(untrack(() => collector))
  setPanelId(untrack(() => panelId))
  const F = ptToLayoutPx(s.fontPt)
  setPlotDefaults({
    categoricalColorScheme: okabeIto,
    colorScheme: 'viridis',
    axis: { tickFontSize: F * 0.875, titleFontSize: F } as any,
    text: { fontSize: F * 0.875 } as any,
  })
  const width = Math.round(s.widthMm * LAYOUT_PX_PER_MM) - s.fitReservePx
  const C = untrack(() => component)
</script>

<div class="export-root pkv-light" data-export-root style={`width:${width}px;font-size:${F}px;font-family:'${FONT_FAMILY}',sans-serif;--export-font:${F}px`}>
  <C {...props} />
</div>

<style>
  .export-root { background: #fff; color: #1a1a1a; }
  /* interaction-only controls never appear in exports */
  .export-root :global(select), .export-root :global(input), .export-root :global(button), .export-root :global(label), .export-root :global([data-export-skip]) { display: none !important; }
  /* every HTML text sizes from the dialog's base pt, not from screen CSS */
  .export-root :global(*:not(svg):not(svg *)) { font-size: inherit !important; font-family: inherit !important; }
  .export-root :global(table), .export-root :global(p), .export-root :global(.color-legend), .export-root :global(.symbol-legend) { font-size: 0.875em !important; }
  .export-root :global(.svelteplot h2), .export-root :global(.svelteplot h3) { font-size: 1em !important; font-weight: 600; margin: 0.4em 0 0.2em; }
  /* multi-column panel layouts stack at journal widths; minmax(0, 1fr), not 1fr (= minmax(auto, 1fr)):
     a plot's min-content width must not push its column wider than the figure */
  .export-root :global(.two), .export-root :global(.three) { grid-template-columns: minmax(0, 1fr) !important; }
  /* tables use the figure width and tighter padding, so they do not widen the figure */
  .export-root :global(table) { max-width: 100%; border-collapse: collapse; }
  .export-root :global(table td), .export-root :global(table th) { padding: 1px 0.25em !important; }
  .export-root :global(svg text) { font-family: inherit; }
</style>
