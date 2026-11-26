<script lang="ts">
  import { app, SECTIONS } from './state.svelte'
  import { PANELS } from '../panels/registry'
  import { availability } from '../panels/availability'
  import { openExport } from '../export/actions'

  let { proteins = [], onopen }: { proteins?: string[]; onopen: (kind: 'zip' | 'folder') => void } = $props()
  let dlg: HTMLDialogElement | undefined = $state()
  let q = $state('')
  let sel = $state(0)
  let input: HTMLInputElement | undefined = $state()

  interface Cmd {
    id: string
    label: string
    kind: 'Panel' | 'Section' | 'Protein' | 'Action'
    run: () => void
  }
  const cmds = $derived.by<Cmd[]>(() => {
    const b = app.active
    const out: Cmd[] = []
    for (const s of SECTIONS) out.push({ id: `sec-${s.id}`, label: s.label, kind: 'Section', run: () => app.go(s.id) })
    if (b)
      for (const p of PANELS)
        if ((p.workflow === 'any' || b.meta.workflows.includes(p.workflow)) && availability(p, b).ok) out.push({ id: `p-${p.id}`, label: `${p.title} (${p.workflow})`, kind: 'Panel', run: () => app.go(p.topic, p.id) })
    for (const pr of proteins) out.push({ id: `pr-${pr}`, label: pr, kind: 'Protein', run: () => app.setCtx('protein', pr) })
    out.push({ id: 'a-open-zip', label: 'Open bundle (zip)…', kind: 'Action', run: () => onopen('zip') })
    out.push({ id: 'a-open-folder', label: 'Open bundle (folder)…', kind: 'Action', run: () => onopen('folder') })
    if (app.bundles.length > 1) out.push({ id: 'a-compare', label: 'Compare runs', kind: 'Action', run: () => app.go('compare') })
    if (b) out.push({ id: 'a-export-all', label: 'Export all panels…', kind: 'Action', run: () => openExport([], true) })
    out.push({ id: 'a-theme', label: `Switch to ${app.theme === 'dark' ? 'light' : 'dark'} theme`, kind: 'Action', run: () => app.setTheme(app.theme === 'dark' ? 'light' : 'dark') })
    out.push({ id: 'a-density', label: `Switch to ${app.density === 'compact' ? 'comfortable' : 'compact'} density`, kind: 'Action', run: () => app.setDensity(app.density === 'compact' ? 'comfortable' : 'compact') })
    return out
  })
  // subsequence match, scored by contiguity and position
  function score(label: string, query: string): number {
    if (!query) return 1
    const l = label.toLowerCase()
    const qq = query.toLowerCase()
    const at = l.indexOf(qq)
    if (at >= 0) return 1000 - at
    let i = 0
    let s = 0
    for (const ch of qq) {
      const j = l.indexOf(ch, i)
      if (j < 0) return -1
      s += j === i ? 3 : 1
      i = j + 1
    }
    return s
  }
  const results = $derived(cmds.map((c) => ({ c, s: score(c.label, q) })).filter((x) => x.s >= 0).sort((a, b) => b.s - a.s).slice(0, 40).map((x) => x.c))

  $effect(() => {
    if (!dlg) return
    if (app.paletteOpen && !dlg.open) {
      q = ''
      sel = 0
      dlg.showModal()
      queueMicrotask(() => input?.focus())
    } else if (!app.paletteOpen && dlg.open) dlg.close()
  })
  function exec(c: Cmd | undefined) {
    if (!c) return
    app.paletteOpen = false
    c.run()
  }
  function onkey(e: KeyboardEvent) {
    if (e.key === 'ArrowDown') {
      sel = Math.min(results.length - 1, sel + 1)
      e.preventDefault()
    } else if (e.key === 'ArrowUp') {
      sel = Math.max(0, sel - 1)
      e.preventDefault()
    } else if (e.key === 'Enter') {
      exec(results[sel])
      e.preventDefault()
    }
  }
</script>

<dialog bind:this={dlg} class="palette" aria-label="Command palette" onclose={() => (app.paletteOpen = false)} data-testid="palette">
  <input bind:this={input} bind:value={q} oninput={() => (sel = 0)} onkeydown={onkey} type="search" placeholder="Jump to a panel, protein or action…" aria-label="Command" aria-controls="palette-list" aria-activedescendant={results[sel] ? `cmd-${results[sel].id}` : undefined} role="combobox" aria-expanded="true" data-testid="palette-input" />
  <ul id="palette-list" role="listbox" aria-label="Results">
    {#each results as c, i (c.id)}
      <li id={`cmd-${c.id}`} role="option" aria-selected={i === sel} class:sel={i === sel} onclick={() => exec(c)} onkeydown={() => {}} onmousemove={() => (sel = i)}>
        <span class="kind">{c.kind}</span> {c.label}
      </li>
    {:else}
      <li class="empty">No match</li>
    {/each}
  </ul>
  <p class="foot">↑ ↓ to move · Enter to run · Esc to close</p>
</dialog>

<style>
  dialog { border: 1px solid var(--pkv-border-strong); border-radius: 12px; padding: 0; width: min(620px, 92vw); background: var(--pkv-surface); color: var(--pkv-ink); box-shadow: var(--pkv-shadow-pop); margin-top: 12vh; }
  dialog::backdrop { background: rgba(10, 14, 22, 0.4); }
  input { width: 100%; border: none; border-bottom: 1px solid var(--pkv-border); padding: 14px 16px; font-size: 1rem; border-radius: 12px 12px 0 0; background: var(--pkv-surface); }
  input:focus-visible { outline: none; }
  ul { list-style: none; margin: 0; padding: 6px; max-height: 50vh; overflow: auto; }
  li { padding: 7px 10px; border-radius: 6px; cursor: pointer; font-size: var(--pkv-text-sm); }
  li.sel { background: var(--pkv-accent-soft); }
  .kind { display: inline-block; width: 64px; font-size: var(--pkv-text-xs); color: var(--pkv-ink-2); }
  .empty { color: var(--pkv-ink-2); cursor: default; }
  .foot { margin: 0; padding: 6px 14px 10px; font-size: var(--pkv-text-xs); color: var(--pkv-ink-2); }
</style>
