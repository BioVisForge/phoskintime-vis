<script lang="ts">
  import { app } from '../ui/state.svelte'
  import { PANELS } from '../panels/registry'
  import { loadSettings, saveSettings, normalise, PRESETS, LAYOUT_PX_PER_MM, type ExportSettings, type SizePreset } from './settings'
  import { pngPixelSize, checkCanvasSize } from './png'
  import { allTargets, allZipName, panelTarget, runExport, saveFiles } from './actions'
  import { FORMATS, type Format } from './formats'

  let dlg: HTMLDialogElement | undefined = $state()
  let s = $state<ExportSettings>(loadSettings())
  let formats = $state<Record<Format, boolean>>({ png: true, pdf: true, svg: false, csv: false, tikz: false })
  let busy = $state(false)
  let progress = $state('')
  let error = $state<string | null>(null)

  $effect(() => {
    if (!dlg) return
    if (app.export.open && !dlg.open) {
      s = loadSettings()
      error = null
      dlg.showModal()
    } else if (!app.export.open && dlg.open) dlg.close()
  })
  const ns = $derived(normalise(s))
  const pngSize = $derived(pngPixelSize(ns.widthMm, ns.heightMm ?? ns.widthMm * 0.6, ns.dpi))
  const sizeErr = $derived(formats.png ? checkCanvasSize(pngSize.width, pngSize.height) : null)
  const targetDefs = $derived(app.export.all ? [] : PANELS.filter((p) => app.export.targetIds.includes(p.id)))
  const chosen = $derived(FORMATS.filter((f) => formats[f]))

  function close() {
    app.export = { open: false, targetIds: [], all: false }
  }
  async function run() {
    const b = app.active
    if (!b) return
    error = null
    busy = true
    saveSettings(ns)
    try {
      const targets = app.export.all ? allTargets(b) : targetDefs.map((d) => panelTarget(d, b))
      const files = await runExport(targets, chosen, ns, (m) => (progress = m))
      saveFiles(files, app.export.all || files.length > 1 ? (app.export.all ? allZipName(b) : undefined) : undefined)
      app.toast = `Exported ${files.length} file${files.length > 1 ? 's' : ''}`
      close()
    } catch (e) {
      error = (e as Error).message
    } finally {
      busy = false
      progress = ''
    }
  }
  function setPreset(p: SizePreset) {
    s.preset = p
    if (p !== 'custom' && p !== 'poster') s.widthMm = PRESETS[p].widthMm
  }
</script>

<dialog bind:this={dlg} class="export" aria-labelledby="export-title" onclose={close} data-testid="export-dialog-el">
  <form method="dialog" onsubmit={(e) => { e.preventDefault(); run() }}>
    <h2 id="export-title">{app.export.all ? 'Export all panels' : `Export ${targetDefs.map((d) => d.title).join(', ')}`}</h2>
    <fieldset>
      <legend>Size</legend>
      <div class="row">
        {#each [['single', 'Single column 85 mm'], ['onehalf', '1.5 column 114 mm'], ['double', 'Double column 174 mm'], ['poster', 'Poster panel'], ['custom', 'Custom']] as [k, l]}
          <label class="radio"><input type="radio" name="preset" value={k} checked={s.preset === k} onchange={() => setPreset(k as SizePreset)} /> {l}</label>
        {/each}
      </div>
      <div class="row">
        <label>Width (mm) <input type="number" min="20" max="1200" step="1" bind:value={s.widthMm} disabled={s.preset !== 'custom' && s.preset !== 'poster'} data-testid="export-width" /></label>
        <label>Height (mm) <input type="number" min="10" max="1200" step="1" value={s.heightMm ?? ''} placeholder="follows the panel" oninput={(e) => (s.heightMm = e.currentTarget.value ? +e.currentTarget.value : null)} /></label>
      </div>
    </fieldset>
    <fieldset>
      <legend>Typography and resolution</legend>
      <div class="row">
        <label>Font <select disabled><option>PKV Sans (embedded)</option></select></label>
        <label>Base size (pt) <input type="number" min="6" max="12" step="0.5" bind:value={s.fontPt} data-testid="export-font" /></label>
        <label>PNG resolution <select bind:value={s.dpi} data-testid="export-dpi"><option value={300}>300 dpi</option><option value={600}>600 dpi</option><option value={1200}>1200 dpi</option></select></label>
      </div>
      <p class="hint">Exports always use the light print theme. Axis labels use the base size; ticks and legends 0.875 ×. Layout: {Math.round(ns.widthMm * LAYOUT_PX_PER_MM)} px wide.</p>
    </fieldset>
    <fieldset>
      <legend>Contents</legend>
      <div class="row">
        <label class="radio"><input type="checkbox" bind:checked={s.title} /> Title</label>
        <label class="radio"><input type="checkbox" bind:checked={s.caption} /> Caption (definition)</label>
        <label class="radio"><input type="checkbox" bind:checked={s.footer} /> Provenance footer</label>
        <label class="radio"><input type="checkbox" bind:checked={s.svgEmbedFont} /> Embed font in SVG</label>
        <label class="radio"><input type="checkbox" bind:checked={s.tikzDownsample} /> Downsample for TeX (LTTB, stated in caption)</label>
      </div>
    </fieldset>
    <fieldset>
      <legend>Formats</legend>
      <div class="row">
        {#each FORMATS as f}
          <label class="radio"><input type="checkbox" bind:checked={formats[f]} data-testid={`fmt-${f}`} /> {f === 'tikz' ? 'TikZ / PGFPlots (zip)' : f.toUpperCase()}</label>
        {/each}
      </div>
      {#if formats.png}<p class="hint">PNG: {pngSize.width} × {pngSize.height} px at {ns.dpi} dpi{ns.heightMm ? '' : ' (height estimated; follows the panel)'}, with pHYs and provenance text chunks.</p>{/if}
      {#if formats.tikz}<p class="hint">TikZ: PGFPlots axes with data files; layers above 20,000 points become a 600 dpi image{s.tikzDownsample ? ' unless downsampled (LTTB; stated in the files)' : ''}.</p>{/if}
    </fieldset>
    {#if sizeErr}<p class="err" role="alert">{sizeErr}</p>{/if}
    {#if error}<p class="err" role="alert" data-testid="export-error">{error}</p>{/if}
    {#if busy}<p class="hint" role="status">Exporting… {progress}</p>{/if}
    <div class="buttons">
      <button type="button" onclick={close}>Cancel</button>
      <button type="submit" class="primary" disabled={busy || !chosen.length || !!sizeErr} data-testid="export-run">{app.export.all ? 'Export all as zip' : 'Export'}</button>
    </div>
  </form>
</dialog>

<style>
  dialog { border: 1px solid var(--pkv-border-strong); border-radius: 12px; padding: 0; background: var(--pkv-surface); color: var(--pkv-ink); box-shadow: var(--pkv-shadow-pop); width: min(720px, 94vw); }
  dialog::backdrop { background: rgba(10, 14, 22, 0.45); }
  form { padding: 18px 22px; }
  h2 { margin: 0 0 10px; font-size: 1.1rem; }
  fieldset { border: 1px solid var(--pkv-border); border-radius: 8px; margin: 0 0 10px; padding: 8px 12px; }
  legend { font-size: var(--pkv-text-sm); font-weight: 600; padding: 0 4px; }
  .row { display: flex; flex-wrap: wrap; gap: 10px 16px; align-items: center; font-size: var(--pkv-text-sm); }
  .row label { display: inline-flex; gap: 6px; align-items: center; }
  input[type='number'] { width: 6em; }
  .hint { font-size: var(--pkv-text-xs); color: var(--pkv-ink-2); margin: 6px 0 0; }
  .err { color: var(--pkv-bad-ink); background: var(--pkv-bad-bg); padding: 6px 10px; border-radius: 6px; font-size: var(--pkv-text-sm); }
  .buttons { display: flex; justify-content: flex-end; gap: 8px; margin-top: 10px; }
</style>
