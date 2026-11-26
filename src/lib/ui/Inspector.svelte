<script lang="ts">
  import { app } from './state.svelte'
  import { PANELS } from '../panels/registry'

  const b = $derived(app.active)
  const m = $derived(b?.meta)
  const vstate = $derived(b ? (app.verifyProgress[b.meta.bundleId] ?? b.verifyState) : '')
  const panel = $derived(PANELS.find((p) => p.id === app.focusPanel) ?? null)
  let openIssue = $state<string | null>(null)
  const issueUrl = (commit: string) => `https://github.com/bibymaths/phoskintime/blob/${commit}/KNOWN_ISSUES.md`
  const bad = $derived(vstate && b ? b.checks.filter((c) => !c.ok) : [])
</script>

<aside id="inspector" class="insp" class:closed={!app.inspectorOpen} aria-label="Inspector">
  {#if b && m}
    <section data-testid="bundle-header">
      <h2>Run</h2>
      <p class="badge" class:ok={vstate === 'verified'} class:bad={vstate === 'mismatch' || vstate === 'error'} data-testid="verify-badge" data-state={vstate} role="status">
        {vstate === 'verified' ? '✔ sha256 verified' : vstate === 'mismatch' ? '✖ sha256 mismatch' : vstate === 'error' ? '✖ files missing' : vstate}
      </p>
      <dl>
        <dt>bundle_id</dt><dd><code data-testid="bundle-id">{m.bundleId}</code></dd>
        <dt>PhosKinTime</dt><dd>{m.phoskintimeVersion}</dd>
        <dt>commit</dt><dd><code title={m.gitCommit}>{m.gitCommit.slice(0, 10)}</code>{m.gitBranch ? ` (${m.gitBranch})` : ''}</dd>
        <dt>workflow</dt><dd>{m.workflows.join(', ')}</dd>
        <dt>model</dt><dd>{m.modelId}{m.modelVariant ? ` / ${m.modelVariant}` : ''}</dd>
        <dt>config</dt><dd><code title={m.configSha256}>{m.configSha256.slice(0, 12)}</code></dd>
        <dt>schema</dt><dd>{m.schemaVersion} via {b.contract}{b.draft ? ' (DRAFT)' : ''}</dd>
      </dl>
      {#if bad.length}<p class="mismatch" data-testid="mismatch-list">Files that do not match the manifest: {#each bad as c}<code>{c.path}</code>{c.error ? ` (${c.error})` : ''} {/each}</p>{/if}
    </section>
    <section>
      <h2>Known issues</h2>
      {#if m.knownIssuesOpen && m.knownIssuesOpen.length}
        <p class="chip" data-testid="issues-chip">⚠ produced with open issues:
          {#each m.knownIssuesOpen as k, i}<button class="link" aria-expanded={openIssue === k.id} onclick={() => (openIssue = openIssue === k.id ? null : k.id)}>{k.id}</button>{i < m.knownIssuesOpen.length - 1 ? ', ' : ''}{/each}
        </p>
        {#if openIssue}
          {@const k = m.knownIssuesOpen.find((x) => x.id === openIssue)}
          <p class="issue" data-testid="issue-text"><b>{k?.id}</b> {k?.severity ? `[${k.severity}]` : ''} {k?.status ?? ''}: {k?.text ?? k?.title ?? 'No text bundled; see the link.'}</p>
        {/if}
        {#if m.knownIssuesSource?.commit}<a href={issueUrl(m.knownIssuesSource.commit)} target="_blank" rel="noreferrer">KNOWN_ISSUES.md @ {m.knownIssuesSource.commit.slice(0, 7)}</a>{/if}
      {:else if m.knownIssuesOpen === null}
        <p class="dim">Not recorded in this bundle.</p>
      {:else}<p class="dim">None open.</p>{/if}
    </section>
    {#if m.warnings.length || b.notices.length}
      <section>
        <h2>Warnings</h2>
        {#each m.warnings as w}<p class="warn">{w.code ? `[${w.code}] ` : ''}{w.message}{w.issue ? ` (${w.issue})` : ''}</p>{/each}
        {#each b.notices as n}<p class="dim">{n}</p>{/each}
      </section>
    {/if}
    {#if panel}
      <section aria-live="polite">
        <h2>Panel: {panel.title}</h2>
        <p>{panel.description}</p>
        <dl>
          <dt>tables</dt><dd>{panel.requires.map((r) => r.table).join(', ') || '—'}{panel.arrays?.length ? `; arrays ${panel.arrays.join(', ')}` : ''}</dd>
          <dt>parity</dt><dd>{#if panel.parity}<code>{panel.parity.fn}</code> <code>{panel.parity.file}:{panel.parity.line}</code> @ <code>{panel.parity.commit.slice(0, 7)}</code>{:else}viewer extra{/if}</dd>
          <dt>coverage</dt><dd>{panel.coverage}</dd>
          <dt>patterns</dt><dd>{panel.patterns.join(', ') || 'none'}</dd>
        </dl>
      </section>
    {/if}
  {:else}
    <p class="dim">Open a bundle to see its provenance.</p>
  {/if}
</aside>

<style>
  .insp { grid-area: insp; background: var(--pkv-surface); border-left: 1px solid var(--pkv-border); padding: var(--pkv-space-3) var(--pkv-space-4); overflow-y: auto; width: 300px; font-size: var(--pkv-text-sm); }
  .insp.closed { display: none; }
  h2 { font-size: var(--pkv-text-sm); font-weight: 650; color: var(--pkv-ink); margin: var(--pkv-space-4) 0 6px; }
  section:first-child h2 { margin-top: 0; }
  dl { display: grid; grid-template-columns: max-content 1fr; gap: 3px 10px; margin: 0; }
  dt { color: var(--pkv-ink-2); }
  dd { margin: 0; overflow-wrap: anywhere; }
  .badge { display: inline-block; padding: 2px 10px; border-radius: 999px; background: var(--pkv-surface-2); font-weight: 600; margin: 0 0 8px; }
  .ok { background: var(--pkv-ok-bg); color: var(--pkv-ok-ink); } .bad { background: var(--pkv-bad-bg); color: var(--pkv-bad-ink); }
  .chip { background: var(--pkv-warn-bg); color: var(--pkv-warn-ink); border: 1px solid var(--pkv-warn-border); border-radius: 8px; padding: 4px 8px; margin: 0 0 6px; }
  .link { border: none; background: none; color: inherit; text-decoration: underline; padding: 0; font-weight: 600; }
  .issue { background: var(--pkv-surface-2); border-left: 3px solid var(--pkv-warn-border); padding: 4px 8px; }
  .warn { background: var(--pkv-warn-bg); color: var(--pkv-warn-ink); padding: 4px 8px; border-radius: 4px; }
  .mismatch { background: var(--pkv-bad-bg); color: var(--pkv-bad-ink); padding: 4px 8px; border-radius: 4px; }
  .dim { color: var(--pkv-ink-2); }
</style>
