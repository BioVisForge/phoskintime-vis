<script lang="ts">
  import { setPlotDefaults } from 'svelteplot'
  import { app } from './lib/ui/state.svelte'
  import Opener from './lib/ui/Opener.svelte'
  import TopBar from './lib/ui/TopBar.svelte'
  import Sidebar from './lib/ui/Sidebar.svelte'
  import Inspector from './lib/ui/Inspector.svelte'
  import ContextBar from './lib/ui/ContextBar.svelte'
  import CommandPalette from './lib/ui/CommandPalette.svelte'
  import Overview from './lib/ui/Overview.svelte'
  import SectionView from './lib/ui/SectionView.svelte'
  import Compare from './lib/ui/Compare.svelte'
  import WhatIf from './lib/ui/WhatIf.svelte'
  import Help from './lib/ui/Help.svelte'
  import ExportDialog from './lib/export/ExportDialog.svelte'
  import { okabeIto } from './lib/ui/palette'
  import { num, str } from './lib/transforms/table'

  setPlotDefaults({ categoricalColorScheme: okabeIto, colorScheme: 'viridis' })
  let opener: ReturnType<typeof Opener> | undefined = $state()
  let helpOpen = $state(false)
  let whatif = $state(false)

  $effect(() => {
    document.documentElement.dataset.theme = app.theme
    document.documentElement.dataset.density = app.density
  })
  // global context options from the active bundle's state index
  let ctxOpts = $state.raw<{ proteins: string[]; sites: Record<string, string[]>; layers: string[] }>({ proteins: [], sites: {}, layers: [] })
  $effect(() => {
    const b = app.active
    if (!b || !b.hasTable('state_index')) {
      ctxOpts = { proteins: [], sites: {}, layers: [] }
      return
    }
    b.table('state_index').then((t) => {
      const P = str(t, 'protein'), S = str(t, 'psite'), L = str(t, 'layer')
      void num
      const sites: Record<string, string[]> = {}
      for (let i = 0; i < t.rows; i++) if (S[i]) (sites[P[i]!] ??= []).push(S[i]!)
      ctxOpts = { proteins: [...new Set(P.filter(Boolean) as string[])].sort(), sites, layers: [...new Set(L.filter(Boolean) as string[])] }
    })
  })
  function onkeydown(e: KeyboardEvent) {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault()
      app.paletteOpen = !app.paletteOpen
    } else if (e.key === '?' && !(e.target as HTMLElement)?.closest('input, textarea, select')) helpOpen = true
  }
  $effect(() => {
    if (!app.toast) return
    const t = setTimeout(() => (app.toast = null), 4000)
    return () => clearTimeout(t)
  })
  const showCompare = $derived(app.route.section === 'compare')
</script>

<svelte:window {onkeydown} />
<div
  class="shell"
  class:no-side={!app.sidebarOpen}
  class:no-insp={!app.inspectorOpen || !app.bundles.length}
  role="presentation"
  ondragover={(e) => e.preventDefault()}
  ondrop={(e) => opener?.drop(e)}>
  <TopBar onopen={(k) => opener?.pick(k)} onhelp={() => (helpOpen = true)} />
  {#if app.bundles.length}<Sidebar />{/if}
  <main id="main" tabindex="-1">
    <Opener bind:this={opener} showZone={!app.bundles.length} />
    {#if app.engineFlag && app.bundles.length}
      <p class="flag"><a href="#/overview" onclick={(e) => { e.preventDefault(); whatif = !whatif }}>{whatif ? 'Close' : 'Open'} What-if (mock engine, feature flag)</a></p>
    {/if}
    {#if whatif}
      <WhatIf />
    {:else if app.active}
      {#if !showCompare}<ContextBar proteins={ctxOpts.proteins} sites={ctxOpts.sites} layers={ctxOpts.layers} />{/if}
      {#if showCompare}
        <Compare />
      {:else if app.route.section === 'overview'}
        <Overview bundle={app.active} />
      {:else}
        {#key app.active.meta.bundleId}<SectionView bundle={app.active} />{/key}
      {/if}
    {/if}
  </main>
  {#if app.bundles.length}<Inspector />{/if}
</div>
<CommandPalette proteins={ctxOpts.proteins} onopen={(k) => opener?.pick(k)} />
<ExportDialog />
<Help bind:open={helpOpen} />
{#if app.toast}<div class="toast" role="status" aria-live="polite">{app.toast}</div>{/if}

<style>
  .shell { display: grid; grid-template-columns: auto 1fr auto; grid-template-rows: auto 1fr; grid-template-areas: 'top top top' 'side main insp'; height: 100vh; }
  main { grid-area: main; overflow-y: auto; padding: var(--pkv-space-4) var(--pkv-space-5) 60px; min-width: 0; }
  .flag { font-size: var(--pkv-text-sm); margin: 0 0 8px; }
  .toast { position: fixed; bottom: 18px; left: 50%; transform: translateX(-50%); background: var(--pkv-ink); color: var(--pkv-surface); padding: 8px 16px; border-radius: 8px; font-size: var(--pkv-text-sm); box-shadow: var(--pkv-shadow-pop); z-index: 60; max-width: 80vw; }
</style>
