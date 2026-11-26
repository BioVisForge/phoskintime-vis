<script lang="ts">
  import type { LoadedBundle } from '../model/bundle'
  import type { PanelDef, PanelReport } from './types'
  import { availability } from './availability'
  import RawRows from '../ui/RawRows.svelte'
  import { enqueueRender } from '../ui/renderQueue'
  import { setPanelId } from '../ui/panelState'
  import { app, hashFor } from '../ui/state.svelte'
  import { openExport, quickExport } from '../export/actions'
  import type { Format } from '../export/formats'

  let { def, bundle }: { def: PanelDef; bundle: LoadedBundle } = $props()
  // svelte-ignore state_referenced_locally
  setPanelId(def.id)
  const avail = $derived(availability(def, bundle))
  let report: PanelReport = $state({ rows: [], notes: [] })
  let showData = $state(false)
  let showAbout = $state(false)
  let menuOpen = $state(false)
  let figure: HTMLElement | undefined = $state()
  let error = $state<string | null>(null)
  const sources = $derived([...def.requires.map((r) => bundle.tableEntry(r.table)?.path ?? r.table), ...(def.arrays ?? []).map((a) => bundle.arrayEntry(a)?.path ?? a)])
  const STATUS: Record<string, string> = { full: 'Full', partial: 'Partial', substituted: 'Substituted', 'viewer-extra': 'Viewer extra' }
  const status = $derived(avail.ok ? STATUS[def.coverage] : 'Not available')
  const statusKey = $derived(avail.ok ? def.coverage : 'na')
  const titleId = $derived(`title-${def.id}`)

  // render lazily: only once the card scrolls near the viewport (keeps first paint fast)
  let host: HTMLElement | undefined = $state()
  let visible = $state(typeof IntersectionObserver === 'undefined')
  $effect(() => {
    if (!host || visible) return
    const io = new IntersectionObserver(
      (es) => {
        if (es.some((e) => e.isIntersecting)) {
          io.disconnect()
          enqueueRender(() => (visible = true))
        }
      },
      { rootMargin: '150px' },
    )
    io.observe(host)
    return () => io.disconnect()
  })
  const loading = $derived(visible && avail.ok && report.rows.length === 0 && !error)

  function onerror(e: unknown) {
    error = (e as Error)?.message ?? String(e)
  }
  async function copyLink() {
    const url = location.href.split('#')[0] + hashFor(def.topic, def.id, app.ctx)
    try {
      await navigator.clipboard.writeText(url)
      app.toast = 'Deep link copied'
    } catch {
      app.toast = url
    }
    menuOpen = false
  }
  function quick(fmt: Format) {
    menuOpen = false
    quickExport(def, bundle, fmt)
  }
  function onKeyMenu(e: KeyboardEvent) {
    if (e.key === 'Escape') menuOpen = false
  }
</script>

<article bind:this={host} class="card" data-panel={def.id} data-rendered={visible} data-available={avail.ok} id={`panel-${def.id}`} aria-labelledby={titleId} onfocusin={() => (app.focusPanel = def.id)} onpointerenter={() => (app.focusPanel = def.id)}>
  <header>
    <div class="title-row">
      <h3 id={titleId}>{def.title}</h3>
      <span class="status status-{statusKey}" title="Coverage against PhosKinTime">{status}</span>
      <span class="wf">{def.workflow === 'any' ? 'all workflows' : def.workflow}</span>
      <div class="actions" role="presentation" onkeydown={onKeyMenu}>
        <button class="ghost icon" aria-haspopup="menu" aria-expanded={menuOpen} aria-label={`Actions for ${def.title}`} onclick={() => (menuOpen = !menuOpen)} data-testid="panel-menu" disabled={!avail.ok}>⋯</button>
        {#if menuOpen}
          <div class="menu" role="menu" aria-label="Panel actions">
            {#each ['png', 'pdf', 'svg', 'csv', 'tikz'] as const as f}
              <button role="menuitem" onclick={() => quick(f)} data-testid={`export-${f}`}>Export {f === 'tikz' ? 'TikZ / PGFPlots' : f.toUpperCase()}</button>
            {/each}
            <button role="menuitem" onclick={() => { menuOpen = false; openExport([def.id]) }} data-testid="export-dialog">Export options…</button>
            <hr />
            <button role="menuitem" onclick={() => { showData = !showData; menuOpen = false }}>{showData ? 'Hide' : 'View'} data ({report.rows.length})</button>
            <button role="menuitem" onclick={copyLink}>Copy deep link</button>
            <button role="menuitem" onclick={() => { showAbout = !showAbout; menuOpen = false }}>About this plot</button>
          </div>
        {/if}
      </div>
    </div>
    <p class="definition">{def.description}</p>
    <div class="chips">{#each sources as s}<span class="src">{s.replace(/^tables\/|^arrays\//, '')}</span>{/each}</div>
  </header>
  {#if !avail.ok}
    <div class="na" data-testid="not-available"><strong>Not available.</strong> {avail.reason}</div>
  {:else}
    <figure class="figure" bind:this={figure} aria-label={`${def.title}. ${def.description} The plotted data is available as a table from the panel menu (View data).`}>
      <svelte:boundary {onerror}>
        {#if visible}<def.component {bundle} {report} />{:else}<div class="skeleton" aria-hidden="true"></div>{/if}
        {#snippet failed(e)}
          <div class="na err">Panel failed: {(e as Error)?.message ?? String(e)}</div>
        {/snippet}
      </svelte:boundary>
      {#if loading}<span class="visually-hidden" role="status">Loading {def.title}</span>{/if}
    </figure>
    {#if error}<div class="na err">{error}</div>{/if}
    {#each report.notes as n}<p class="note">{n}</p>{/each}
    {#if showAbout}
      <div class="about">
        {#if def.parity}
          <p>Redraws PhosKinTime <code>{def.parity.fn}</code> in <code>{def.parity.file}:{def.parity.line}</code> at commit <code>{def.parity.commit.slice(0, 7)}</code>.</p>
        {:else}<p>Viewer extra: PhosKinTime has no plot to match.</p>{/if}
        <p>Patterns: {def.patterns.length ? def.patterns.join(', ') : 'none'} (see docs/plot-patterns.md). Minimum bundle schema {def.minSchema}.</p>
      </div>
    {/if}
    {#if showData}<RawRows rows={report.rows} caption={`Data plotted in “${def.title}”`} />{/if}
  {/if}
</article>

<style>
  .card { background: var(--pkv-surface); border: 1px solid var(--pkv-border); border-radius: var(--pkv-radius); padding: var(--pkv-space-3) var(--pkv-space-4); margin: 0 0 var(--pkv-space-4); }
  .card:focus-within { border-color: var(--pkv-border-strong); }
  .title-row { display: flex; gap: var(--pkv-space-2); align-items: center; }
  h3 { margin: 0; font-size: var(--pkv-text-lg); font-weight: 650; letter-spacing: -0.005em; }
  .status, .wf { font-size: var(--pkv-text-xs); padding: 1px 8px; border-radius: 999px; border: 1px solid var(--pkv-border); color: var(--pkv-ink-2); white-space: nowrap; }
  .status-full { background: var(--pkv-ok-bg); color: var(--pkv-ok-ink); border-color: transparent; }
  .status-partial, .status-substituted { background: var(--pkv-warn-bg); color: var(--pkv-warn-ink); border-color: transparent; }
  .status-viewer-extra { background: var(--pkv-accent-soft); color: var(--pkv-ink); border-color: transparent; }
  .status-na { background: var(--pkv-surface-2); }
  .actions { margin-left: auto; position: relative; }
  .icon { font-size: 1.1rem; line-height: 1; padding: 2px 8px; }
  .menu { position: absolute; right: 0; top: 100%; z-index: 30; background: var(--pkv-surface); border: 1px solid var(--pkv-border-strong); border-radius: var(--pkv-radius); box-shadow: var(--pkv-shadow-pop); padding: 4px; display: flex; flex-direction: column; min-width: 210px; }
  .menu button { text-align: left; border: none; background: transparent; padding: 6px 10px; border-radius: 4px; }
  .menu button:hover, .menu button:focus-visible { background: var(--pkv-surface-2); }
  .menu hr { border: none; border-top: 1px solid var(--pkv-border); margin: 4px 0; }
  .definition { margin: 4px 0 6px; color: var(--pkv-ink-2); font-size: var(--pkv-text-sm); max-width: 110ch; }
  .chips { display: flex; gap: 4px; flex-wrap: wrap; margin-bottom: var(--pkv-space-2); }
  .src { font-family: ui-monospace, Menlo, monospace; font-size: 0.7rem; color: var(--pkv-ink-2); background: var(--pkv-surface-2); border-radius: 4px; padding: 1px 6px; }
  .na { background: var(--pkv-surface-2); border: 1px dashed var(--pkv-border-strong); padding: var(--pkv-space-3); border-radius: var(--pkv-radius-sm); font-size: var(--pkv-text-sm); }
  .err { border-color: var(--pkv-bad-ink); color: var(--pkv-bad-ink); }
  .note { background: var(--pkv-warn-bg); border-left: 3px solid var(--pkv-warn-border); color: var(--pkv-warn-ink); margin: 6px 0; padding: 4px 8px; font-size: var(--pkv-text-sm); border-radius: 0 4px 4px 0; }
  .figure { margin: 0; min-width: 0; }
  .figure :global(h2) { font-size: 0.82rem; font-weight: 600; margin: 2px 0; }
  .figure :global(label) { font-size: var(--pkv-text-sm); color: var(--pkv-ink-2); margin-right: 8px; }
  .skeleton { height: 260px; border-radius: var(--pkv-radius-sm); background: linear-gradient(90deg, var(--pkv-surface-2) 0%, var(--pkv-border) 50%, var(--pkv-surface-2) 100%); background-size: 200% 100%; animation: shimmer 1.4s ease-in-out infinite; }
  @keyframes shimmer { from { background-position: 100% 0; } to { background-position: -100% 0; } }
  @media (prefers-reduced-motion: reduce) { .skeleton { animation: none; } }
  .about { font-size: var(--pkv-text-sm); color: var(--pkv-ink-2); border-top: 1px solid var(--pkv-border); margin-top: 8px; padding-top: 4px; }
</style>
