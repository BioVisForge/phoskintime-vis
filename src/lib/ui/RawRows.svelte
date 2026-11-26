<script lang="ts">
  let { rows, limit = 200, caption = 'Plotted data' }: { rows: Record<string, unknown>[]; limit?: number; caption?: string } = $props()
  const cols = $derived(rows.length ? Object.keys(rows[0]) : [])
  const fmt = (v: unknown) => (v === null || v === undefined ? 'null' : typeof v === 'number' ? (Number.isInteger(v) ? String(v) : v.toPrecision(6)) : String(v))
</script>

<div class="raw">
  <p>{rows.length} rows{rows.length > limit ? `, first ${limit} shown (CSV has all)` : ''}. <em>null</em> = missing (a gap, never zero).</p>
  <table>
    <caption class="visually-hidden">{caption}</caption>
    <thead><tr>{#each cols as c}<th>{c}</th>{/each}</tr></thead>
    <tbody>
      {#each rows.slice(0, limit) as r}
        <tr>{#each cols as c}<td class:null={r[c] === null || r[c] === undefined}>{fmt(r[c])}</td>{/each}</tr>
      {/each}
    </tbody>
  </table>
</div>

<style>
  .raw { max-height: 320px; overflow: auto; font-size: 0.75rem; border: 1px solid var(--pkv-border); margin-top: 6px; border-radius: 4px; }
  table { border-collapse: collapse; }
  th, td { padding: 2px 6px; border-bottom: 1px solid var(--pkv-border); text-align: left; white-space: nowrap; }
  th { position: sticky; top: 0; background: var(--pkv-surface-2); }
  .null { color: var(--pkv-bad-ink); font-style: italic; }
  p { margin: 4px; }
</style>
