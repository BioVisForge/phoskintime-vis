<script lang="ts">
  import type { LoadedBundle } from '../model/bundle'
  import type { PanelDef, PanelReport } from './types'
  import { availability } from './availability'
  import { download, figureToPng, figureToSvg } from '../export/figure'
  import { toCsv } from '../transforms/table'
  import RawRows from '../ui/RawRows.svelte'

  let { def, bundle }: { def: PanelDef; bundle: LoadedBundle } = $props()
  const avail = $derived(availability(def, bundle))
  let report: PanelReport = $state({ rows: [], notes: [] })
  let showRaw = $state(false)
  let figure: HTMLElement | undefined = $state()
  let error = $state<string | null>(null)
  const sources = $derived([...def.requires.map((r) => bundle.tableEntry(r.table)?.path ?? r.table), ...(def.arrays ?? []).map((a) => bundle.arrayEntry(a)?.path ?? a)])
  const fname = (ext: string) => `${def.id}_${bundle.meta.bundleId}.${ext}`

  // render lazily: only once the panel scrolls near the viewport (keeps first paint fast)
  let host: HTMLElement | undefined = $state()
  let visible = $state(typeof IntersectionObserver === 'undefined')
  $effect(() => {
    if (!host || visible) return
    const io = new IntersectionObserver((es) => {
      if (es.some((e) => e.isIntersecting)) {
        visible = true
        io.disconnect()
      }
    }, { rootMargin: '300px' })
    io.observe(host)
    return () => io.disconnect()
  })

  function onerror(e: unknown) {
    error = (e as Error)?.message ?? String(e)
  }
</script>

<section bind:this={host} class="panel" data-rendered={visible} data-panel={def.id} data-available={avail.ok} id={`panel-${def.id}`}>
  <header>
    <h3>{def.title}</h3>
    <span class="cov cov-{def.coverage}" title="coverage against PhosKinTime">{def.coverage}</span>
    {#each def.patterns as p}<span class="pat" title="SveltePlot pattern, see docs/plot-patterns.md">{p}</span>{/each}
  </header>
  <p class="desc">{def.description}</p>
  {#if !avail.ok}
    <div class="na" data-testid="not-available">
      <strong>Not available.</strong>
      {avail.reason}
    </div>
  {:else}
    <div class="figure" bind:this={figure}>
      <svelte:boundary onerror={onerror}>
        {#if visible}<def.component {bundle} {report} />{:else}<div class="placeholder">…</div>{/if}
        {#snippet failed(e)}
          <div class="na err">Panel failed: {(e as Error)?.message ?? String(e)}</div>
        {/snippet}
      </svelte:boundary>
    </div>
    {#if error}<div class="na err">{error}</div>{/if}
    {#each report.notes as n}<p class="note">{n}</p>{/each}
    <div class="tools">
      <span class="src">Source: {#each sources as s, i}<code>{s}</code>{i < sources.length - 1 ? ', ' : ''}{/each}</span>
      {#if def.parity}
        <span class="src">Parity: <code>{def.parity.file}:{def.parity.line}</code> <code>{def.parity.fn}</code> @ <code>{def.parity.commit.slice(0, 7)}</code></span>
      {:else}
        <span class="src">Viewer extra: no PhosKinTime plot to match.</span>
      {/if}
      <span class="btns">
        <button onclick={() => (showRaw = !showRaw)}>{showRaw ? 'Hide' : 'Show'} rows ({report.rows.length})</button>
        <button onclick={() => figure && download(fname('svg'), figureToSvg(figure).svg, 'image/svg+xml')}>SVG</button>
        <button onclick={async () => figure && download(fname('png'), await figureToPng(figure))}>PNG</button>
        <button onclick={() => download(fname('csv'), toCsv(report.rows), 'text/csv')}>CSV</button>
      </span>
    </div>
    {#if showRaw}<RawRows rows={report.rows} />{/if}
  {/if}
</section>

<style>
  .panel { border: 1px solid #d6d9de; border-radius: 6px; padding: 10px 14px; margin: 12px 0; background: #fff; }
  header { display: flex; gap: 6px; align-items: baseline; flex-wrap: wrap; }
  h3 { margin: 0 8px 0 0; font-size: 1.02rem; }
  .cov, .pat { font-size: 0.7rem; padding: 1px 6px; border-radius: 9px; background: #eef; }
  .cov-full { background: #dcf3e2; } .cov-partial { background: #fff1c9; } .cov-substituted { background: #ffe2cc; } .cov-viewer-extra { background: #e5e7f5; }
  .pat { background: #f0f0f0; font-family: monospace; }
  .desc { margin: 4px 0 6px; color: #444; font-size: 0.85rem; }
  .na { background: #f7f7f9; border: 1px dashed #aab; padding: 12px; border-radius: 4px; color: #333; font-size: 0.9rem; }
  .err { border-color: #c33; color: #a00; }
  .note { background: #fff6dd; border-left: 3px solid #e0a800; margin: 6px 0; padding: 4px 8px; font-size: 0.82rem; }
  .tools { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; font-size: 0.75rem; color: #555; margin-top: 6px; }
  .btns { margin-left: auto; display: flex; gap: 4px; }
  button { font-size: 0.75rem; }
  .figure { overflow-x: auto; }
  .placeholder { height: 260px; }
  .figure :global(h2) { font-size: 0.82rem; font-weight: 600; margin: 2px 0; }
  .figure :global(h3) { font-size: 0.78rem; font-weight: 400; margin: 0; }
</style>
