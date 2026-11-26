<script lang="ts">
  import type { LoadedBundle } from '../model/bundle'
  import { app, SECTIONS } from './state.svelte'
  import { gofByLayer, gofPoints } from '../derive/trajectories'
  import { layerLabel, fmt } from '../panels/common'
  import { PANELS } from '../panels/registry'
  import { availability } from '../panels/availability'
  import type { Table } from '../model/types'

  let { bundle }: { bundle: LoadedBundle } = $props()
  let t = $state.raw<Table | null>(null)
  $effect(() => {
    if (bundle.hasTable('trajectories')) bundle.table('trajectories').then((x) => (t = x))
  })
  const gof = $derived(t ? gofByLayer(gofPoints(t)) : null)
  const m = $derived(bundle.meta)
  const vstate = $derived(app.verifyProgress[m.bundleId] ?? bundle.verifyState)
  const panels = $derived(PANELS.filter((p) => p.workflow === 'any' || m.workflows.includes(p.workflow)))
  const unavailable = $derived(panels.filter((p) => !availability(p, bundle).ok))
</script>

<section class="ov" aria-labelledby="ov-title">
  <h1 id="ov-title">Run overview</h1>
  <dl class="lede">
    <div><dt>Bundle</dt><dd>{bundle.label}</dd></div>
    <div><dt>Workflow</dt><dd>{m.workflows.join(', ')}</dd></div>
    <div><dt>Model</dt><dd>{m.modelId}{m.modelVariant ? ` (${m.modelVariant})` : ''}</dd></div>
    <div><dt>Produced by</dt><dd>PhosKinTime {m.phoskintimeVersion} at <code>{m.gitCommit.slice(0, 7)}</code></dd></div>
  </dl>
  <div class="tiles">
    <div class="tile" data-testid="tile-verify">
      <span class="k">Verification</span>
      <span class="v" class:good={vstate === 'verified'} class:badv={vstate === 'mismatch' || vstate === 'error'}>{vstate === 'verified' ? '✔ verified' : vstate}</span>
      <span class="s">{m.files.length} files, sha256 recomputed</span>
    </div>
    {#if gof}
      <div class="tile" data-testid="tile-r2">
        <span class="k">R² (best fit, all layers)</span>
        <span class="v">{fmt(gof.overall.r2, 3)}</span>
        <span class="s">squared Pearson r, n = {gof.overall.n}</span>
      </div>
      <div class="tile">
        <span class="k">RMSE (about identity)</span>
        <span class="v">{fmt(gof.overall.rmse, 3)}</span>
        <span class="s">robust σ {fmt(gof.overall.sigma, 3)}</span>
      </div>
    {/if}
    <div class="tile">
      <span class="k">Open known issues</span>
      <span class="v">{m.knownIssuesOpen === null ? 'n/a' : m.knownIssuesOpen.length}</span>
      <span class="s">{m.knownIssuesOpen === null ? 'not recorded' : m.knownIssuesOpen.map((k) => k.id).join(', ') || 'none'}</span>
    </div>
    <div class="tile">
      <span class="k">Panels available</span>
      <span class="v">{panels.length - unavailable.length}/{panels.length}</span>
      <span class="s">{unavailable.length ? `${unavailable.length} not available (see reasons)` : 'all available'}</span>
    </div>
  </div>
  {#if gof}
    <table class="tbl" aria-label="Fit quality per layer">
      <thead><tr><th scope="col">Layer</th><th scope="col">n</th><th scope="col">R²</th><th scope="col">RMSE</th><th scope="col">robust σ</th></tr></thead>
      <tbody>
        {#each Object.entries(gof.layers) as [l, g]}<tr><th scope="row">{layerLabel(bundle, l)}</th><td>{g.n}</td><td>{fmt(g.r2, 4)}</td><td>{fmt(g.rmse, 4)}</td><td>{fmt(g.sigma, 4)}</td></tr>{/each}
      </tbody>
    </table>
  {/if}
  {#if m.warnings.length}
    <h2>Warnings</h2>
    {#each m.warnings as w}<p class="warn">{w.code ? `[${w.code}] ` : ''}{w.message}</p>{/each}
  {/if}
  {#if unavailable.length}
    <h2>Not available in this bundle</h2>
    <ul class="na">{#each unavailable as p}<li><b>{p.title}</b>: {availability(p, bundle).reason}</li>{/each}</ul>
  {/if}
  <h2>Sections</h2>
  <div class="secs">
    {#each SECTIONS.filter((s) => s.id !== 'overview' && (s.id !== 'compare' || app.bundles.length > 1)) as s}
      <a href={`#/${s.id}`} class="sec"><b>{s.label}</b><span>{s.hint}</span></a>
    {/each}
  </div>
</section>

<style>
  .ov h1 { font-size: 1.4rem; margin: 0 0 4px; letter-spacing: -0.01em; }
  .lede { display: flex; flex-wrap: wrap; gap: 4px 28px; margin: 0 0 var(--pkv-space-4); font-size: var(--pkv-text-sm); }
  .lede div { display: flex; gap: 6px; }
  .lede dt { color: var(--pkv-ink-2); }
  .lede dd { margin: 0; }
  .tiles { display: grid; grid-template-columns: repeat(auto-fill, minmax(190px, 1fr)); gap: var(--pkv-space-3); margin-bottom: var(--pkv-space-4); }
  .tile { background: var(--pkv-surface); border: 1px solid var(--pkv-border); border-radius: var(--pkv-radius); padding: var(--pkv-space-3); display: flex; flex-direction: column; gap: 2px; }
  .k { font-size: var(--pkv-text-sm); color: var(--pkv-ink-2); }
  .v { font-size: 1.6rem; font-weight: 650; font-variant-numeric: tabular-nums; }
  .good { color: var(--pkv-ok-ink); } .badv { color: var(--pkv-bad-ink); }
  .s { font-size: var(--pkv-text-xs); color: var(--pkv-ink-2); }
  h2 { font-size: var(--pkv-text-md); margin: var(--pkv-space-4) 0 var(--pkv-space-2); }
  .tbl { border-collapse: collapse; background: var(--pkv-surface); border: 1px solid var(--pkv-border); border-radius: var(--pkv-radius); font-size: var(--pkv-text-sm); }
  .tbl th, .tbl td { padding: 5px 14px; text-align: right; border-bottom: 1px solid var(--pkv-border); }
  .tbl th:first-child { text-align: left; }
  .warn { background: var(--pkv-warn-bg); color: var(--pkv-warn-ink); padding: 6px 10px; border-radius: 6px; margin: 4px 0; font-size: var(--pkv-text-sm); }
  .na { font-size: var(--pkv-text-sm); color: var(--pkv-ink-2); }
  .secs { display: grid; grid-template-columns: repeat(auto-fill, minmax(230px, 1fr)); gap: var(--pkv-space-2); }
  .sec { display: flex; flex-direction: column; padding: var(--pkv-space-3); border: 1px solid var(--pkv-border); border-radius: var(--pkv-radius); background: var(--pkv-surface); text-decoration: none; color: var(--pkv-ink); }
  .sec span { font-size: var(--pkv-text-xs); color: var(--pkv-ink-2); }
  .sec:hover { border-color: var(--pkv-accent); }
</style>
