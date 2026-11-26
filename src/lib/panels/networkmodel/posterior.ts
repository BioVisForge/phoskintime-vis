import type { LoadedBundle } from '../../model/bundle'
import type { NpyArray } from '../../model/types'
import { parameterValues } from '../../derive/compare'

/** Posterior draws plus the parameter names of their last axis (the parameters-table order). */
export async function loadPosterior(b: LoadedBundle): Promise<{ arr: NpyArray; names: string[]; mismatch: string | null }> {
  const [arr, params] = await Promise.all([b.array('posterior_draws'), parameterValues(b)])
  const n = arr.shape[2]
  const names = params.map((p) => p.name)
  const mismatch = names.length !== n ? `Posterior has ${n} parameters but the parameters table has ${names.length}; columns are labelled by index.` : null
  return { arr, names: mismatch ? Array.from({ length: n }, (_, i) => `param[${i}]`) : names, mismatch }
}
