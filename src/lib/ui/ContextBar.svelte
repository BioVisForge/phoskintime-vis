<script lang="ts">
  import { app } from './state.svelte'

  /** Global protein / psite / layer selector: drives every dependent panel and the URL hash. */
  let { proteins, sites, layers }: { proteins: string[]; sites: Record<string, string[]>; layers: string[] } = $props()
  let query = $state('')
  let open = $state(false)
  let active = $state(0)
  const matches = $derived(query ? proteins.filter((p) => p.toLowerCase().includes(query.toLowerCase())).slice(0, 50) : proteins.slice(0, 50))
  const current = $derived(app.ctx.protein && proteins.includes(app.ctx.protein) ? app.ctx.protein : (proteins[0] ?? ''))
  const psites = $derived(sites[current] ?? [])
  function choose(p: string) {
    app.setCtx('protein', p)
    query = ''
    open = false
  }
  function onkey(e: KeyboardEvent) {
    if (e.key === 'ArrowDown') {
      open = true
      active = Math.min(matches.length - 1, active + 1)
      e.preventDefault()
    } else if (e.key === 'ArrowUp') {
      active = Math.max(0, active - 1)
      e.preventDefault()
    } else if (e.key === 'Enter' && matches[active]) {
      choose(matches[active])
      e.preventDefault()
    } else if (e.key === 'Escape') open = false
  }
</script>

<div class="ctx" role="group" aria-label="Global context">
  <div class="combo">
    <label for="ctx-protein">Protein</label>
    <input id="ctx-protein" type="search" role="combobox" aria-expanded={open} aria-controls="ctx-protein-list" aria-autocomplete="list" autocomplete="off" placeholder={current} bind:value={query} onfocus={() => (open = true)} onblur={() => setTimeout(() => (open = false), 150)} oninput={() => { open = true; active = 0 }} onkeydown={onkey} data-testid="ctx-protein" aria-activedescendant={open && matches[active] ? `ctx-opt-${matches[active]}` : undefined} />
    {#if open && matches.length}
      <ul id="ctx-protein-list" role="listbox" aria-label="Proteins">
        {#each matches as p, i}
          <li id={`ctx-opt-${p}`} role="option" aria-selected={i === active} class:sel={i === active} onmousedown={() => choose(p)} onkeydown={() => {}}>{p}</li>
        {/each}
      </ul>
    {/if}
    <span class="current" data-testid="ctx-current">{current}</span>
  </div>
  <label>Psite <select value={app.ctx.psite ?? ''} onchange={(e) => app.setCtx('psite', e.currentTarget.value || null)} data-testid="ctx-psite"><option value="">(any)</option>{#each psites as s}<option value={s}>{s}</option>{/each}</select></label>
  <label>Layer <select value={app.ctx.layer ?? ''} onchange={(e) => app.setCtx('layer', e.currentTarget.value || null)} data-testid="ctx-layer"><option value="">(any)</option>{#each layers as l}<option value={l}>{l}</option>{/each}</select></label>
</div>

<style>
  .ctx { display: flex; gap: var(--pkv-space-4); align-items: center; flex-wrap: wrap; padding: var(--pkv-space-2) 0 var(--pkv-space-3); font-size: var(--pkv-text-sm); }
  .ctx label { color: var(--pkv-ink-2); display: inline-flex; gap: 6px; align-items: center; }
  .combo { position: relative; display: inline-flex; gap: 6px; align-items: center; }
  .combo input { width: 12em; }
  .current { font-weight: 600; }
  ul { position: absolute; top: 100%; left: 3.5em; z-index: 35; list-style: none; margin: 2px 0 0; padding: 4px; max-height: 300px; overflow: auto; background: var(--pkv-surface); border: 1px solid var(--pkv-border-strong); border-radius: 8px; box-shadow: var(--pkv-shadow-pop); min-width: 12em; }
  li { padding: 4px 8px; border-radius: 4px; cursor: pointer; }
  li.sel, li:hover { background: var(--pkv-accent-soft); }
</style>
