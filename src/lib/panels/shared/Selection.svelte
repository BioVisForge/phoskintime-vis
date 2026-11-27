<script lang="ts">
  import { download } from '../../export/figure'
  import { toCsv } from '../../transforms/table'
  /**
   * `ids`: the selected ids, or a function that returns them (with `count`), so a brush over
   * 100k points does not build 100k strings per move; they are built for the 30 shown and for
   * downloads only.
   */
  let { ids, count, label = 'selected', name = 'selection' }: { ids: string[] | ((limit?: number) => string[]); count?: number; label?: string; name?: string } = $props()
  const all = () => (typeof ids === 'function' ? ids() : ids)
  const n = $derived(typeof ids === 'function' ? (count ?? 0) : ids.length)
  const shown = $derived(!n ? [] : typeof ids === 'function' ? ids(30) : ids.slice(0, 30))
</script>

<div class="sel" data-testid="selection" data-export-skip>
  <b>{n}</b> {label}{n ? ':' : ''}
  <span class="ids">{shown.join(', ')}{n > 30 ? ` … (+${n - 30})` : ''}</span>
  {#if n}
    <button onclick={() => download(`${name}.csv`, toCsv(all().map((id) => ({ id }))), 'text/csv')}>CSV</button>
    <button onclick={() => download(`${name}.json`, JSON.stringify(all(), null, 1), 'application/json')}>JSON</button>
  {/if}
  <span class="dim">Selection is interaction only; it never changes the bundle.</span>
</div>

<style>
  .sel { font-size: 0.8rem; background: var(--pkv-surface-2); padding: 4px 8px; border-radius: 4px; margin: 4px 0; }
  .ids { font-family: monospace; }
  .dim { color: var(--pkv-ink-2); margin-left: 8px; }
</style>
