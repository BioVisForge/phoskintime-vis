<script lang="ts">
  import type { Snippet } from 'svelte'
  import RawRows from '../ui/RawRows.svelte'
  import { app } from '../ui/state.svelte'
  import { compareTarget, openExport, runExport, saveFiles } from '../export/actions'
  import { FitError } from '../export/compose'
  import { loadSettings } from '../export/settings'
  import type { Format } from '../export/formats'

  let { id, title, patterns = [], rows = [], note = '', tikz = true, children }: { id: string; title: string; patterns?: string[]; rows?: Record<string, unknown>[]; note?: string; /** false for table-only sections (no plot to emit) */ tikz?: boolean; children: Snippet } = $props()
  let raw = $state(false)
  let busy = $state(false)
  async function exp(fmt: Format) {
    const a = app.byId(app.compareA)
    const b = app.byId(app.compareB)
    if (!a || !b) return
    busy = true
    const snapshot = $state.snapshot(rows) as Record<string, unknown>[]
    const make = async () => [await compareTarget(id, title, note || title, a, b, snapshot)]
    try {
      saveFiles(await runExport(await make(), [fmt], loadSettings()))
    } catch (e) {
      // does not fit at the chosen pt size: the export dialog shows the warning and its fixes
      if (e instanceof FitError) openExport([], false, { formats: [fmt], fit: e.issues, custom: { title, make } })
      else app.toast = `Export failed: ${(e as Error).message}`
    } finally {
      busy = false
    }
  }
</script>

<section class="cs" data-compare-section={id}>
  <header><h3>{title}</h3>{#each patterns as p}<span class="pat">{p}</span>{/each}</header>
  <div class="fig" data-figure={id}>{@render children()}</div>
  {#if note}<p class="note">{note}</p>{/if}
  <div class="tools" data-export-skip>
    <button onclick={() => (raw = !raw)}>{raw ? 'Hide' : 'View'} data ({rows.length})</button>
    {#each (['png', 'pdf', 'svg', 'csv', 'tikz'] as const).filter((f) => tikz || f !== 'tikz') as f}<button disabled={busy} onclick={() => exp(f)} data-testid={`cmp-export-${f}`}>{f === 'tikz' ? 'TikZ' : f.toUpperCase()}</button>{/each}
  </div>
  {#if raw}<RawRows {rows} />{/if}
</section>

<style>
  .cs { border: 1px solid var(--pkv-border); border-radius: var(--pkv-radius); padding: var(--pkv-space-3) var(--pkv-space-4); margin: 0 0 var(--pkv-space-4); background: var(--pkv-surface); }
  header { display: flex; gap: 6px; align-items: baseline; }
  h3 { margin: 0 8px 4px 0; font-size: 1rem; }
  .pat { font-size: 0.7rem; padding: 1px 6px; border-radius: 9px; background: var(--pkv-surface-2); font-family: monospace; }
  .note { background: var(--pkv-warn-bg); color: var(--pkv-warn-ink); border-left: 3px solid var(--pkv-warn-border); margin: 6px 0; padding: 4px 8px; font-size: 0.82rem; }
  .tools { display: flex; gap: 4px; justify-content: flex-end; font-size: 0.75rem; }
  .fig { overflow-x: auto; }
  .fig :global(h2) { font-size: 0.82rem; font-weight: 600; margin: 2px 0; }
</style>
