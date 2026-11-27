<script lang="ts">
  let { open = $bindable(false) }: { open?: boolean } = $props()
  let dlg: HTMLDialogElement | undefined = $state()
  $effect(() => {
    if (!dlg) return
    if (open && !dlg.open) dlg.showModal()
    else if (!open && dlg.open) dlg.close()
  })
</script>

<dialog bind:this={dlg} aria-labelledby="help-title" onclose={() => (open = false)}>
  <h2 id="help-title">Help</h2>
  <dl>
    <dt><kbd>Ctrl</kbd>/<kbd>⌘</kbd> + <kbd>K</kbd></dt><dd>Command palette: jump to a panel, protein or action</dd>
    <dt><kbd>?</kbd></dt><dd>This help</dd>
    <dt><kbd>Tab</kbd></dt><dd>Move between controls; every panel action is keyboard reachable</dd>
  </dl>
  <p>Sections follow scientific questions. The protein / psite / layer bar drives every dependent panel and the URL, so links reproduce the view. Each panel's ⋯ menu exports PNG (600 dpi), vector PDF, SVG, CSV and TikZ/PGFPlots, shows the plotted data and copies a deep link.</p>
  <p>All data stays in this browser tab.</p>
  <form method="dialog"><button class="primary">Close</button></form>
</dialog>

<style>
  dialog { border: 1px solid var(--pkv-border-strong); border-radius: 12px; background: var(--pkv-surface); color: var(--pkv-ink); width: min(560px, 92vw); box-shadow: var(--pkv-shadow-pop); }
  dialog::backdrop { background: rgba(10, 14, 22, 0.4); }
  dl { display: grid; grid-template-columns: max-content 1fr; gap: 6px 14px; font-size: var(--pkv-text-sm); }
  dd { margin: 0; }
  kbd { font: inherit; font-size: var(--pkv-text-xs); border: 1px solid var(--pkv-border-strong); border-radius: 4px; padding: 0 4px; }
  p { font-size: var(--pkv-text-sm); color: var(--pkv-ink-2); }
</style>
