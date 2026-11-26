<script lang="ts">
  import { app } from './state.svelte'
  import { BundleFolderSource, filesFromDrop } from '../sources/folder'
  import { BundleZipSource } from '../sources/zip'
  import { SourceError } from '../sources/types'

  let { showZone = true }: { showZone?: boolean } = $props()
  let dragging = $state(false)
  let busy = $state(false)
  let zipInput: HTMLInputElement | undefined = $state()
  let folderInput: HTMLInputElement | undefined = $state()
  export function pick(kind: 'zip' | 'folder') {
    ;(kind === 'zip' ? zipInput : folderInput)?.click()
  }
  export async function drop(e: DragEvent) {
    await onDrop(e)
  }

  async function openFiles(files: File[]) {
    busy = true
    try {
      const zips = files.filter((f) => f.name.endsWith('.zip'))
      for (const z of zips) await openSafe(() => BundleZipSource.fromFile(z), z.name)
      const rest = files.filter((f) => !f.name.endsWith('.zip'))
      if (rest.length) await openSafe(async () => BundleFolderSource.fromFileList(rest), rest[0].webkitRelativePath?.split('/')[0] || 'folder')
    } finally {
      busy = false
    }
  }

  async function openSafe(make: () => Promise<import('../sources/types').DataSource>, label: string) {
    try {
      await app.open(await make())
    } catch (e) {
      app.errors = [...app.errors, { label, message: (e as Error).message, kind: e instanceof SourceError ? 'source' : 'error', details: [] }]
    }
  }

  async function onDrop(e: DragEvent) {
    e.preventDefault()
    dragging = false
    if (!e.dataTransfer) return
    const items = e.dataTransfer.items
    const hasDir = Array.from(items).some((i) => i.webkitGetAsEntry?.()?.isDirectory)
    if (hasDir) {
      busy = true
      try {
        const entries = await filesFromDrop(items)
        // one bundle per top-level dropped folder
        const tops = new Map<string, { path: string; file: File }[]>()
        for (const e2 of entries) {
          const top = e2.path.split('/')[0]
          ;(tops.get(top) ?? tops.set(top, []).get(top)!).push(e2)
        }
        for (const [top, list] of tops) {
          if (top.endsWith('.zip')) await openSafe(() => BundleZipSource.fromFile(list[0].file), top)
          else await openSafe(async () => new BundleFolderSource(list), top)
        }
      } finally {
        busy = false
      }
    } else await openFiles(Array.from(e.dataTransfer.files))
  }
</script>

<input bind:this={folderInput} class="visually-hidden" tabindex="-1" aria-label="Open bundle folder" data-testid="open-folder" type="file" webkitdirectory multiple onchange={(e) => openFiles(Array.from(e.currentTarget.files ?? []))} />
<input bind:this={zipInput} class="visually-hidden" tabindex="-1" aria-label="Open bundle zip" data-testid="open-zip" type="file" accept=".zip" multiple onchange={(e) => openFiles(Array.from(e.currentTarget.files ?? []))} />
{#if showZone}
  <div
    class="drop"
    class:dragging
    role="region"
    aria-label="Open bundles"
    ondragover={(e) => {
      e.preventDefault()
      dragging = true
    }}
    ondragleave={() => (dragging = false)}
    ondrop={onDrop}>
    <h1>Open a PhosKinTime run bundle</h1>
    <p>Drop <code>&lt;run&gt;.pkt/</code> folders or <code>&lt;run&gt;.pkt.zip</code> files anywhere in this window, or choose:</p>
    <div class="btns">
      <button class="primary" onclick={() => zipInput?.click()}>Open zip…</button>
      <button onclick={() => folderInput?.click()}>Open folder…</button>
      {#if __BUILD_MODE__ === 'pages'}
        <span class="demo">Synthetic demo:
          {#each ['small-protwise', 'network', 'network-after-fix'] as d}
            <button onclick={() => openSafe(async () => new BundleZipSource(`${d}.pkt.zip`, new Uint8Array(await (await fetch(`demo/${d}.pkt.zip`)).arrayBuffer())), d)}>{d}</button>
          {/each}
        </span>
      {/if}
    </div>
    {#if busy}<p class="busy" role="status">Opening…</p>{/if}
    <p class="privacy">Everything stays in this browser tab: nothing is uploaded, no network is used.</p>
  </div>
{:else if busy}<p class="busy" role="status">Opening…</p>{/if}

{#each app.errors as err, i}
  <div class="error" data-testid="load-error" data-kind={err.kind}>
    <strong>{err.label}:</strong> {err.message}
    {#if err.details.length}<ul>{#each err.details.slice(0, 12) as d}<li><code>{d}</code></li>{/each}</ul>{/if}
    <button onclick={() => (app.errors = app.errors.filter((_, j) => j !== i))}>dismiss</button>
  </div>
{/each}

<style>
  .drop { border: 2px dashed var(--pkv-border-strong); border-radius: 14px; padding: 48px 32px; background: var(--pkv-surface); text-align: center; max-width: 720px; margin: 8vh auto 0; }
  .drop h1 { font-size: 1.35rem; margin: 0 0 8px; }
  .drop p { color: var(--pkv-ink-2); }
  .dragging { background: var(--pkv-accent-soft); border-color: var(--pkv-accent); }
  .btns { display: flex; gap: 8px; justify-content: center; flex-wrap: wrap; align-items: center; }
  .demo { font-size: var(--pkv-text-sm); color: var(--pkv-ink-2); display: inline-flex; gap: 4px; align-items: center; }
  .privacy { font-size: var(--pkv-text-xs); margin-top: 18px; }
  .busy { color: var(--pkv-ink-2); }
  .error { background: var(--pkv-bad-bg); color: var(--pkv-bad-ink); border: 1px solid var(--pkv-bad-ink); padding: 8px 12px; margin-top: 8px; border-radius: 8px; font-size: var(--pkv-text-sm); }
</style>
