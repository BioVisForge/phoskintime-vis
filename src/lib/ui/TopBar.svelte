<script lang="ts">
  import { app } from './state.svelte'

  let { onopen, onhelp }: { onopen: (kind: 'zip' | 'folder') => void; onhelp: () => void } = $props()
  let openMenu = $state(false)
  const mac = typeof navigator !== 'undefined' && /Mac/.test(navigator.platform)
</script>

<header class="top">
  <button class="ghost burger" aria-label={app.sidebarOpen ? 'Collapse navigation' : 'Expand navigation'} aria-expanded={app.sidebarOpen} aria-controls="sidebar" onclick={() => (app.sidebarOpen = !app.sidebarOpen)}>☰</button>
  <span class="brand">PhosKinTime-Vis <span class="ver">v{__APP_VERSION__}</span></span>
  <div class="chips" role="list" aria-label="Loaded bundles">
    {#each app.bundles as b (b.meta.bundleId)}
      {@const st = app.verifyProgress[b.meta.bundleId] ?? b.verifyState}
      <span class="chip" class:active={app.active === b} role="listitem">
        <button class="ghost chip-main" onclick={() => (app.activeId = b.meta.bundleId)} aria-pressed={app.active === b} title={b.meta.bundleId}>
          <span class="dot st-{b.verifyState}" aria-hidden="true"></span>
          <span class="name">{b.label.replace(/\.pkt(\.zip)?$/, '')}</span>
          <code>{b.meta.bundleId.slice(4, 12)}</code>
          <span class="wf">{b.meta.workflows.join('+')}</span>
          <span class="visually-hidden">verification: {st}</span>
        </button>
        <button class="ghost x" aria-label={`Close ${b.label}`} onclick={() => app.remove(b.meta.bundleId)}>×</button>
      </span>
    {/each}
  </div>
  <div class="right">
    <div class="open">
      <button onclick={() => (openMenu = !openMenu)} aria-haspopup="menu" aria-expanded={openMenu} data-testid="open-menu">Open</button>
      {#if openMenu}
        <div class="menu" role="menu">
          <button role="menuitem" onclick={() => { openMenu = false; onopen('zip') }}>Bundle zip (.pkt.zip)…</button>
          <button role="menuitem" onclick={() => { openMenu = false; onopen('folder') }}>Bundle folder (.pkt/)…</button>
        </div>
      {/if}
    </div>
    <button onclick={() => app.go('compare')} disabled={app.bundles.length < 2} data-testid="tab-compare" title="Compare two runs">Compare</button>
    <button class="ghost kbd" onclick={() => (app.paletteOpen = true)} aria-label="Command palette" data-testid="palette-button"><kbd>{mac ? '⌘' : 'Ctrl'}</kbd><kbd>K</kbd></button>
    <label class="raw"><input type="checkbox" bind:checked={app.rawLines} data-testid="raw-lines" /> raw lines</label>
    <button class="ghost" onclick={() => app.setDensity(app.density === 'compact' ? 'comfortable' : 'compact')} aria-label={`Density: ${app.density}`} title="Comfortable / compact">{app.density === 'compact' ? '▤' : '☰'}</button>
    <button class="ghost" onclick={() => app.setTheme(app.theme === 'dark' ? 'light' : 'dark')} aria-label={`Switch to ${app.theme === 'dark' ? 'light' : 'dark'} theme`} data-testid="theme-toggle">{app.theme === 'dark' ? '☀' : '☾'}</button>
    <button class="ghost" onclick={() => (app.inspectorOpen = !app.inspectorOpen)} aria-label={app.inspectorOpen ? 'Hide inspector' : 'Show inspector'} aria-expanded={app.inspectorOpen} aria-controls="inspector">ⓘ</button>
    <button class="ghost" onclick={onhelp} aria-label="Help">?</button>
  </div>
</header>

<style>
  .top { grid-area: top; display: flex; align-items: center; gap: var(--pkv-space-3); padding: 6px var(--pkv-space-4); background: var(--pkv-surface); border-bottom: 1px solid var(--pkv-border); min-height: 48px; }
  .brand { font-weight: 700; letter-spacing: -0.01em; white-space: nowrap; }
  .ver { font-weight: 400; color: var(--pkv-ink-3); font-size: var(--pkv-text-xs); }
  .burger { font-size: 1.1rem; }
  .chips { display: flex; gap: 6px; overflow-x: auto; flex: 1; min-width: 0; }
  .chip { display: inline-flex; align-items: center; border: 1px solid var(--pkv-border); border-radius: 999px; background: var(--pkv-surface-2); white-space: nowrap; }
  .chip.active { border-color: var(--pkv-accent); box-shadow: 0 0 0 1px var(--pkv-accent); }
  .chip-main { display: inline-flex; gap: 6px; align-items: center; padding: 2px 4px 2px 10px; }
  .chip code { background: transparent; color: var(--pkv-ink-2); }
  .wf { font-size: var(--pkv-text-xs); color: var(--pkv-ink-2); }
  .dot { width: 8px; height: 8px; border-radius: 50%; background: var(--pkv-ink-3); }
  .st-verified { background: #1f9d55; } .st-mismatch, .st-error { background: #d1242f; }
  .x { padding: 0 8px; }
  .right { display: flex; gap: 6px; align-items: center; margin-left: auto; }
  .open { position: relative; }
  .menu { position: absolute; right: 0; top: 110%; z-index: 40; background: var(--pkv-surface); border: 1px solid var(--pkv-border-strong); border-radius: 8px; box-shadow: var(--pkv-shadow-pop); padding: 4px; display: flex; flex-direction: column; min-width: 220px; }
  .menu button { border: none; text-align: left; background: transparent; padding: 6px 10px; }
  .menu button:hover { background: var(--pkv-surface-2); }
  kbd { font: inherit; font-size: var(--pkv-text-xs); border: 1px solid var(--pkv-border-strong); border-bottom-width: 2px; border-radius: 4px; padding: 0 4px; margin: 0 1px; background: var(--pkv-surface-2); }
  .raw { font-size: var(--pkv-text-xs); color: var(--pkv-ink-2); display: inline-flex; gap: 4px; align-items: center; }
</style>
