import { validators } from './generated/index'
import { adapterFor, supportedMajors } from './adapters/index'
import { parseVersion } from './version'
import type { BundleMeta } from '../model/types'

export class ContractError extends Error {
  constructor(
    message: string,
    readonly kind: 'unsupported-version' | 'invalid-manifest' | 'unreadable',
    readonly details: string[] = [],
  ) {
    super(message)
  }
}

export interface ContractResult {
  meta: BundleMeta
  contract: string
  draft: boolean
  notices: string[]
}

/** Check a parsed manifest against the vendored schema for its version and adapt it. */
export function applyContract(manifest: unknown): ContractResult {
  if (!manifest || typeof manifest !== 'object') throw new ContractError('manifest.json is not a JSON object.', 'unreadable')
  const m = manifest as Record<string, any>
  const v = parseVersion(m.bundle_schema)
  if (!v) throw new ContractError(`manifest.json has no valid "bundle_schema" (found ${JSON.stringify(m.bundle_schema)}).`, 'invalid-manifest')
  const adapter = adapterFor(v.major)
  if (!adapter) {
    throw new ContractError(
      `Unsupported bundle schema ${v.raw}. This viewer supports major version(s) ${supportedMajors().join(', ')}.x. ` +
        `Open it with a newer PhosKinTime-Vis release, or re-export the bundle with a schema this viewer supports.`,
      'unsupported-version',
    )
  }
  const validate = validators[adapter.contract] as ((d: unknown) => boolean) & { errors?: { instancePath: string; message?: string }[] | null }
  if (!validate) throw new ContractError(`No vendored schema for contract ${adapter.contract}.`, 'invalid-manifest')
  if (!validate(m)) {
    const details = (validate.errors ?? []).map((e) => `${e.instancePath || '/'} ${e.message ?? ''}`.trim())
    throw new ContractError(`manifest.json does not match bundle schema ${adapter.contract}.`, 'invalid-manifest', details)
  }
  const notices: string[] = []
  if (adapter.draft) notices.push(`Validated against the DRAFT contract ${adapter.contract} (no upstream schema published yet).`)
  if (v.minor > adapter.maxKnownMinor)
    notices.push(`Bundle schema ${v.raw} is newer than this viewer knows (${v.major}.${adapter.maxKnownMinor}); unknown fields are ignored.`)
  return { meta: adapter.toMeta(m), contract: adapter.contract, draft: adapter.draft, notices }
}
