import type { BundleMeta } from '../../model/types'

/**
 * A version adapter maps one upstream bundle_schema major version onto the internal model.
 * A new upstream major means a new adapter file, registered in adapters/index.ts; panels and
 * the model do not change.
 */
export interface VersionAdapter {
  id: string
  major: number
  /** Highest minor this adapter was written against. Newer minors load with a warning. */
  maxKnownMinor: number
  /** Directory under contracts/phoskintime/ whose schema validates this major. */
  contract: string
  /** True while the contract is the phoskintime-vis DRAFT rather than an upstream schema. */
  draft: boolean
  toMeta(manifest: Record<string, any>): BundleMeta
}
