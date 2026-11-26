<script lang="ts">
  import type { LoadedBundle } from '../model/bundle'
  import { app } from './state.svelte'

  let { bundle }: { bundle: LoadedBundle } = $props()
  const m = $derived(bundle.meta)
  let openIssue = $state<string | null>(null)
  const state = $derived(app.verifyProgress[m.bundleId] ?? bundle.verifyState)
  const issueUrl = (commit: string) => `https://github.com/bibymaths/phoskintime/blob/${commit}/KNOWN_ISSUES.md`
  const bad = $derived(bundle.checks.filter((c) => !c.ok))
</script>

<div class="hdr" data-testid="bundle-header">
  <div class="row">
    <span class="badge" class:ok={state === 'verified'} class:bad={state === 'mismatch' || state === 'error'} data-testid="verify-badge" data-state={state}>
      {state === 'verified' ? '✔ sha256 verified' : state === 'mismatch' ? '✖ sha256 mismatch' : state === 'error' ? '✖ files missing' : state}
    </span>
    <code title="bundle_id" data-testid="bundle-id">{m.bundleId}</code>
    <span>PhosKinTime <b>{m.phoskintimeVersion}</b></span>
    <span>commit <code title={m.gitCommit}>{m.gitCommit.slice(0, 7)}</code>{#if m.gitBranch} ({m.gitBranch}){/if}</span>
    <span>{m.workflows.join(', ')} · model <b>{m.modelId}</b>{#if m.modelVariant} / {m.modelVariant}{/if}</span>
    <span>config <code title={m.configSha256}>{m.configSha256.slice(0, 10)}</code></span>
    <span class="dim">schema {m.schemaVersion} via {bundle.contract}{bundle.draft ? ' (DRAFT)' : ''}</span>
  </div>
  {#if m.knownIssuesOpen && m.knownIssuesOpen.length}
    <div class="row">
      <span class="chip" data-testid="issues-chip">⚠ produced with open issues:
        {#each m.knownIssuesOpen as k, i}<button class="link" onclick={() => (openIssue = openIssue === k.id ? null : k.id)}>{k.id}</button>{i < m.knownIssuesOpen.length - 1 ? ', ' : ''}{/each}
      </span>
      {#if m.knownIssuesSource?.commit}<a href={issueUrl(m.knownIssuesSource.commit)} target="_blank" rel="noreferrer">KNOWN_ISSUES.md @ {m.knownIssuesSource.commit.slice(0, 7)}</a>{/if}
    </div>
    {#if openIssue}
      {@const k = m.knownIssuesOpen.find((x) => x.id === openIssue)}
      <div class="issue" data-testid="issue-text"><b>{k?.id}</b> {k?.severity ? `[${k.severity}]` : ''} {k?.status ?? ''} — {k?.text ?? k?.title ?? 'No text bundled in the manifest; see the link.'}</div>
    {/if}
  {:else if m.knownIssuesOpen === null}
    <div class="row dim">This bundle does not record which known issues were open (no <code>known_issues_open</code> field).</div>
  {/if}
  {#each m.warnings as w}<div class="warn">{w.code ? `[${w.code}] ` : ''}{w.message}{w.issue ? ` (${w.issue})` : ''}</div>{/each}
  {#each bundle.notices as n}<div class="dim small">{n}</div>{/each}
  {#if bad.length}
    <div class="mismatch" data-testid="mismatch-list">Files that do not match the manifest: {#each bad as c}<code>{c.path}</code>{c.error ? ` (${c.error})` : ''} {/each}. Plots of these files may not show what the producer wrote.</div>
  {/if}
  {#if bundle.unlisted.length}<div class="dim small">Files present but not listed in the manifest (ignored): {bundle.unlisted.join(', ')}</div>{/if}
</div>

<style>
  .hdr { background: #fff; border: 1px solid #d6d9de; border-radius: 6px; padding: 8px 12px; margin: 10px 0; font-size: 0.86rem; }
  .row { display: flex; flex-wrap: wrap; gap: 12px; align-items: center; margin: 3px 0; }
  .badge { padding: 2px 8px; border-radius: 10px; background: #eee; font-weight: 600; }
  .ok { background: #d8f2df; color: #155d2b; } .bad { background: #fbd5d5; color: #8a1414; }
  .chip { background: #fff3cd; border: 1px solid var(--amber); border-radius: 12px; padding: 2px 10px; }
  .link { border: none; background: none; color: #7a4c00; text-decoration: underline; padding: 0; }
  .issue { background: #fffaf0; border-left: 3px solid var(--amber); padding: 4px 8px; margin: 4px 0; }
  .warn { background: #fff6dd; padding: 3px 8px; margin: 3px 0; border-radius: 3px; }
  .mismatch { background: #fdecec; padding: 4px 8px; margin: 3px 0; }
  .dim { color: #666; } .small { font-size: 0.78rem; }
</style>
