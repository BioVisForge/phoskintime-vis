<script lang="ts">
  import { app } from '../ui/state.svelte'
  import { PANELS } from '../panels/registry'
  import { loadSettings, saveSettings, normalise, nextPreset, PRESETS, LAYOUT_PX_PER_MM, type ExportSettings, type SizePreset } from './settings'
  import { FitError, type FitIssue } from './compose'
  import { pngPixelSize, checkCanvasSize } from './png'
  import { allTargets, allZipName, panelTarget, runExport, saveFiles } from './actions'
  import { FORMATS, type Format } from './formats'

  let dlg: HTMLDialogElement | undefined = $state()
  let s = $state<ExportSettings>(loadSettings())
  let formats = $state<Record<Format, boolean>>({ png: true, pdf: true, svg: false, csv: false, tikz: false })
  let busy = $state(false)
  let progress = $state('')
  let error = $state<string | null>(null)
  /** panels that do not fit the width at the chosen pt (from the last attempt or a quick export) */
  let fit = $state<FitIssue[] | null>(null)

  $effect(() => {
    if (!dlg) return
    if (app.export.open && !dlg.open) {
      s = loadSettings()
      // a one-click export refused by the fit check keeps its "current view" choice
      if (app.export.view) s.view = app.export.view
      error = null
      fit = app.export.fit ?? null
      if (app.export.formats) formats = Object.fromEntries(FORMATS.map((f) => [f, app.export.formats!.includes(f)])) as Record<Format, boolean>
      dlg.showModal()
    } else if (!app.export.open && dlg.open) dlg.close()
  })
  const ns = $derived(normalise(s))
  const pngSize = $derived(pngPixelSize(ns.widthMm, ns.heightMm ?? ns.widthMm * 0.6, ns.dpi))
  const sizeErr = $derived(formats.png ? checkCanvasSize(pngSize.width, pngSize.height) : null)
  const targetDefs = $derived(app.export.all ? [] : PANELS.filter((p) => app.export.targetIds.includes(p.id)))
  const chosen = $derived(FORMATS.filter((f) => formats[f]))
  const next = $derived(nextPreset(ns.widthMm))
  const fitTicks = $derived(!!fit?.some((i) => i.tickLabels))
  const fitMinPt = $derived(fit ? Math.min(...fit.map((i) => i.scaledPt)) : 0)
  const kindText: Record<string, string> = { tick: 'tick label', 'axis-title': 'axis title', text: 'text label', html: 'legend or table text', mark: 'mark' }

  function close() {
    app.export = { open: false, targetIds: [], all: false }
  }
  /** Apply one fit fix and export again. */
  function fix(kind: 'shorten' | 'ticks' | 'preset' | 'scale') {
    if (kind === 'shorten') s.fitShortenLabels = true
    if (kind === 'ticks') s.fitFewerTicks = true
    if (kind === 'preset' && next) {
      setPreset(next)
      s.fitReflow = true
    }
    if (kind === 'scale') s.fitScale = true
    // a fix applies to this export only: it does not change the remembered settings
    run(false)
  }
  async function run(remember = true) {
    const b = app.active
    if (!b) return
    error = null
    fit = null
    busy = true
    if (remember) saveSettings(ns)
    try {
      const targets = app.export.custom ? await app.export.custom.make() : app.export.all ? allTargets(b) : targetDefs.map((d) => panelTarget(d, b))
      const files = await runExport(targets, chosen, ns, (m) => (progress = m))
      saveFiles(files, app.export.all || files.length > 1 ? (app.export.all ? allZipName(b) : undefined) : undefined)
      app.toast = `Exported ${files.length} file${files.length > 1 ? 's' : ''}`
      close()
    } catch (e) {
      if (e instanceof FitError) fit = e.issues
      else error = (e as Error).message
    } finally {
      busy = false
      progress = ''
    }
  }
  function setPreset(p: SizePreset) {
    s.preset = p
    // a width change invalidates the previous attempt's warning and fixes
    s.fitScale = false
    if (p !== 'custom' && p !== 'poster') s.widthMm = PRESETS[p].widthMm
  }
</script>

<dialog bind:this={dlg} class="export" aria-labelledby="export-title" onclose={close} data-testid="export-dialog-el">
  <form method="dialog" onsubmit={(e) => { e.preventDefault(); s.fitScale = false; run() }}>
    <h2 id="export-title">{app.export.custom ? `Export ${app.export.custom.title}` : app.export.all ? 'Export all panels' : `Export ${targetDefs.map((d) => d.title).join(', ')}`}</h2>
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
        <label class="radio" title="Zoomed plots show the view you zoomed to; the caption states the shown axis ranges. Off: the full data range."><input type="checkbox" checked={s.view === 'current'} onchange={(e) => (s.view = e.currentTarget.checked ? 'current' : 'full')} data-testid="export-view" /> Export current view</label>
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
    {#if fit}
      <div class="warn" role="alert" data-testid="fit-warning">
        <p><strong>Labels do not fit {fit[0].widthMm} mm at {fit[0].fontPt} pt.</strong> Nothing was exported. Text is never scaled below the chosen size without your confirmation.</p>
        <ul>
          {#each fit as i (i.panelId)}
            <li data-testid="fit-issue" data-panel={i.panelId}>
              {i.title}: needs about {i.neededMm.toFixed(0)} mm{i.applied.length ? ` (after ${i.applied.join(' and ')})` : ''}; sticking out:
              {[...new Set(i.offenders.map((o) => `${kindText[o.kind]} “${o.text.length > 24 ? o.text.slice(0, 23) + '…' : o.text}” (${o.side})`))].slice(0, 3).join(', ')}{i.offenders.length > 3 ? ', …' : ''}.
            </li>
          {/each}
        </ul>
        <div class="fixes">
          {#if fitTicks && !s.fitShortenLabels}<button type="button" onclick={() => fix('shorten')} disabled={busy} data-testid="fit-shorten">Shorter labels</button>{/if}
          {#if fitTicks && !s.fitFewerTicks}<button type="button" onclick={() => fix('ticks')} disabled={busy} data-testid="fit-fewer-ticks">Fewer ticks</button>{/if}
          {#if next}<button type="button" onclick={() => fix('preset')} disabled={busy} data-testid="fit-next-preset">Use {PRESETS[next].label}</button>{/if}
          <button type="button" onclick={() => fix('scale')} disabled={busy} data-testid="fit-scale">Scale anyway (text {fitMinPt.toFixed(1)} pt)</button>
        </div>
        <p class="hint">The wider preset draws the plot narrower where labels need room. Shorter labels and fewer ticks change only tick labels; the CSV keeps the full labels. Shortening, fewer ticks and scaling are stated in the caption.</p>
      </div>
    {/if}
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
  .warn { background: var(--pkv-warn-bg); color: var(--pkv-warn-ink); border: 1px solid var(--pkv-warn-border); border-radius: 8px; padding: 8px 12px; font-size: var(--pkv-text-sm); margin: 0 0 10px; }
  .warn p { margin: 0 0 6px; }
  .warn ul { margin: 0 0 8px; padding-left: 1.2em; }
  .fixes { display: flex; flex-wrap: wrap; gap: 8px; }
  .buttons { display: flex; justify-content: flex-end; gap: 8px; margin-top: 10px; }
</style>
