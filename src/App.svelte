<script lang="ts">
  import { app } from './lib/ui/state.svelte'
  import Opener from './lib/ui/Opener.svelte'
  import Viewer from './lib/ui/Viewer.svelte'
  import Compare from './lib/ui/Compare.svelte'
  import WhatIf from './lib/ui/WhatIf.svelte'
</script>

<header class="top">
  <h1>PhosKinTime-Vis</h1>
  <span class="dim">v{__APP_VERSION__} · {__BUILD_MODE__ === 'single' ? 'offline single file' : 'web'} · reads bundle schema 1.x</span>
  <nav>
    <button class:on={app.view === 'viewer'} onclick={() => (app.view = 'viewer')}>Viewer</button>
    <button class:on={app.view === 'compare'} data-testid="tab-compare" onclick={() => (app.view = 'compare')}>Compare runs</button>
    {#if app.engineFlag}<button class:on={app.view === 'whatif'} onclick={() => (app.view = 'whatif')}>What-if (mock engine)</button>{/if}
  </nav>
  <label class="toggle"><input type="checkbox" bind:checked={app.rawLines} data-testid="raw-lines" /> raw lines (canvas)</label>
</header>
<main>
  <Opener />
  {#if app.bundles.length}
    <div class="bundles">
      {#each app.bundles as b}
        <span class="bchip" class:active={app.active === b}>
          <button class="link" onclick={() => (app.activeId = b.meta.bundleId)}>{b.label}</button>
          <span class="st st-{b.verifyState}">{b.verifyState}</span>
          <button class="x" title="close" onclick={() => app.remove(b.meta.bundleId)}>×</button>
        </span>
      {/each}
    </div>
  {/if}
  {#if app.view === 'viewer'}
    {#if app.active}<Viewer bundle={app.active} />{:else}<p class="empty">No bundle open. Open a <code>.pkt</code> folder or <code>.pkt.zip</code> above.</p>{/if}
  {:else if app.view === 'compare'}
    <Compare />
  {:else}
    <WhatIf />
  {/if}
</main>

<style>
  .top { display: flex; align-items: center; gap: 16px; padding: 8px 16px; background: #1d2a44; color: #fff; flex-wrap: wrap; }
  h1 { font-size: 1.15rem; margin: 0; }
  .dim { color: #b8c2d6; font-size: 0.8rem; }
  nav { display: flex; gap: 4px; }
  nav button { background: #2c3c5e; color: #fff; border-color: #3d4f74; }
  nav button.on { background: #fff; color: #1d2a44; }
  .toggle { margin-left: auto; font-size: 0.8rem; }
  main { padding: 10px 16px 40px; max-width: 1400px; margin: 0 auto; }
  .bundles { display: flex; gap: 8px; margin-top: 8px; flex-wrap: wrap; }
  .bchip { background: #fff; border: 1px solid #ccd; border-radius: 14px; padding: 2px 8px; font-size: 0.82rem; }
  .bchip.active { border-color: #3b6fd8; box-shadow: 0 0 0 1px #3b6fd8; }
  .link { border: none; background: none; padding: 0; font-weight: 600; }
  .x { border: none; background: none; }
  .st { font-size: 0.7rem; color: #666; } .st-verified { color: #1a7f37; } .st-mismatch, .st-error { color: #b00; }
  .empty { color: #666; }
</style>
