<script lang="ts">
  import { app, SECTIONS } from './state.svelte'
  import { PANELS } from '../panels/registry'
  import { availability } from '../panels/availability'

  const b = $derived(app.active)
  const counts = $derived.by(() => {
    const out: Record<string, { ok: number; all: number }> = {}
    if (!b) return out
    for (const p of PANELS) {
      if (p.workflow !== 'any' && !b.meta.workflows.includes(p.workflow)) continue
      const c = (out[p.topic] ??= { ok: 0, all: 0 })
      c.all++
      if (availability(p, b).ok) c.ok++
    }
    return out
  })
  const workflows = $derived([...new Set(app.bundles.flatMap((x) => x.meta.workflows))])
  function toggleWf(w: string) {
    app.workflowFilter = app.workflowFilter.includes(w) ? app.workflowFilter.filter((x) => x !== w) : [...app.workflowFilter, w]
  }
</script>

<nav id="sidebar" class="side" class:collapsed={!app.sidebarOpen} aria-label="Sections">
  <ul>
    {#each SECTIONS as s}
      {#if s.id !== 'compare' || app.bundles.length > 1}
        <li>
          <a href={`#/${s.id}`} class:current={app.route.section === s.id} aria-current={app.route.section === s.id ? 'page' : undefined} data-testid={`nav-${s.id}`} title={s.hint}>
            <span class="label">{s.label}</span>
            {#if counts[s.id]}<span class="count" aria-label={`${counts[s.id].ok} of ${counts[s.id].all} panels available`}>{counts[s.id].ok}/{counts[s.id].all}</span>{/if}
          </a>
        </li>
      {/if}
    {/each}
  </ul>
  {#if workflows.length > 1 || workflows.length === 1}
    <div class="filters" role="group" aria-label="Workflow filter">
      <span class="ftitle">Show workflow</span>
      {#each workflows as w}
        <button class="tag" aria-pressed={app.workflowFilter.includes(w)} onclick={() => toggleWf(w)}>{w}</button>
      {/each}
    </div>
  {/if}
</nav>

<style>
  .side { grid-area: side; background: var(--pkv-surface); border-right: 1px solid var(--pkv-border); padding: var(--pkv-space-3) var(--pkv-space-2); overflow-y: auto; width: 236px; }
  .side.collapsed { width: 0; padding: 0; border: none; overflow: hidden; }
  .side.collapsed .label, .side.collapsed .count, .side.collapsed .filters { display: none; }
  ul { list-style: none; margin: 0; padding: 0; }
  a { display: flex; align-items: center; gap: 10px; padding: 7px 10px; border-radius: 6px; color: var(--pkv-ink); text-decoration: none; font-size: var(--pkv-text-sm); }
  a:hover { background: var(--pkv-surface-2); }
  a.current { background: var(--pkv-accent-soft); font-weight: 600; }
  .count { margin-left: auto; font-size: var(--pkv-text-xs); color: var(--pkv-ink-2); font-variant-numeric: tabular-nums; }
  .filters { margin-top: var(--pkv-space-4); padding: 0 10px; display: flex; flex-wrap: wrap; gap: 6px; align-items: center; }
  .ftitle { width: 100%; font-size: var(--pkv-text-xs); font-weight: 600; color: var(--pkv-ink-2); }
  .tag { border-radius: 999px; font-size: var(--pkv-text-xs); padding: 1px 10px; }
  .tag[aria-pressed='true'] { background: var(--pkv-accent); color: var(--pkv-accent-ink); border-color: var(--pkv-accent); }
</style>
