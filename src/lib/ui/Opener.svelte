<script lang="ts">
  import { app } from './state.svelte'
  import { BundleFolderSource, filesFromDrop } from '../sources/folder'
  import { BundleZipSource } from '../sources/zip'
  import { SourceError } from '../sources/types'

  let dragging = $state(false)
  let busy = $state(false)

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
  <strong>Open a run bundle</strong> — drop <code>&lt;run&gt;.pkt/</code> folders or <code>&lt;run&gt;.pkt.zip</code> files here, or
  <label class="btn">folder… <input data-testid="open-folder" type="file" webkitdirectory multiple onchange={(e) => openFiles(Array.from(e.currentTarget.files ?? []))} /></label>
  <label class="btn">zip… <input data-testid="open-zip" type="file" accept=".zip" multiple onchange={(e) => openFiles(Array.from(e.currentTarget.files ?? []))} /></label>
  {#if __BUILD_MODE__ === 'pages'}
    <span>or a synthetic demo:
      {#each ['small-protwise', 'network', 'network-after-fix'] as d}
        <button onclick={() => openSafe(async () => new BundleZipSource(`${d}.pkt.zip`, new Uint8Array(await (await fetch(`demo/${d}.pkt.zip`)).arrayBuffer())), d)}>{d}</button>
      {/each}
    </span>
  {/if}
  {#if busy}<span class="busy">opening…</span>{/if}
  <span class="privacy">Everything stays in this browser tab: nothing is uploaded.</span>
</div>

{#each app.errors as err, i}
  <div class="error" data-testid="load-error" data-kind={err.kind}>
    <strong>{err.label}:</strong> {err.message}
    {#if err.details.length}<ul>{#each err.details.slice(0, 12) as d}<li><code>{d}</code></li>{/each}</ul>{/if}
    <button onclick={() => (app.errors = app.errors.filter((_, j) => j !== i))}>dismiss</button>
  </div>
{/each}

<style>
  .drop { border: 2px dashed #9aa4b5; border-radius: 8px; padding: 12px 16px; background: #fff; font-size: 0.9rem; display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
  .dragging { background: #eef4ff; border-color: #3b6fd8; }
  .btn { border: 1px solid #c4c8cf; border-radius: 4px; padding: 2px 8px; cursor: pointer; background: #f8f9fb; }
  .btn input { display: none; }
  .privacy { margin-left: auto; color: #4a6; font-size: 0.8rem; }
  .busy { color: #777; }
  .error { background: #fdecec; border: 1px solid #e3a3a3; padding: 8px 12px; margin-top: 8px; border-radius: 6px; font-size: 0.88rem; }
</style>
