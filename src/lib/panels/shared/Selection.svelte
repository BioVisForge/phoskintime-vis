<script lang="ts">
  import { download } from '../../export/figure'
  import { toCsv } from '../../transforms/table'
  let { ids, label = 'selected', name = 'selection' }: { ids: string[]; label?: string; name?: string } = $props()
</script>

<div class="sel" data-testid="selection">
  <b>{ids.length}</b> {label}{ids.length ? ':' : ''}
  <span class="ids">{ids.slice(0, 30).join(', ')}{ids.length > 30 ? ` … (+${ids.length - 30})` : ''}</span>
  {#if ids.length}
    <button onclick={() => download(`${name}.csv`, toCsv(ids.map((id) => ({ id }))), 'text/csv')}>CSV</button>
    <button onclick={() => download(`${name}.json`, JSON.stringify(ids, null, 1), 'application/json')}>JSON</button>
  {/if}
  <span class="dim">Selection is interaction only; it never changes the bundle.</span>
</div>

<style>
  .sel { font-size: 0.8rem; background: #f3f6fb; padding: 4px 8px; border-radius: 4px; margin: 4px 0; }
  .ids { font-family: monospace; }
  .dim { color: #777; margin-left: 8px; }
</style>
