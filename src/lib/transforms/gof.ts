import { finite, linregress, mean, median, std } from './stats'

/** z values used by networkmodel/export.py plot_goodness_of_fit (lines 398-399 at e634e17). */
export const Z95 = 1.959963984540054
export const Z99 = 2.5758293035489004
/** protwise/plotting/plotting.py plot_gof (lines 320-321 at e634e17). */
export const PROTWISE_Z95 = 1.96
export const PROTWISE_Z99 = 2.576

/**
 * networkmodel `_robust_sigma` (export.py:311-331): 1.4826 * MAD of the residuals (centred on the
 * median residual); np.std (ddof 0) when fewer than 10 finite residuals or when MAD == 0;
 * floored at 1e-12.
 */
export function robustSigma(residuals: ArrayLike<number>): number {
  const r = finite(residuals)
  if (r.length < 10) {
    const s = std(r, 0)
    return s > 0 ? s : 1e-12
  }
  const med = median(r)
  const mad = median(r.map((v) => Math.abs(v - med)))
  let s = 1.4826 * mad
  if (s <= 0) s = std(r, 0)
  return s > 0 ? s : 1e-12
}

export interface GofStats {
  n: number
  sigma: number
  d95: number
  d99: number
  /** Squared Pearson r of linregress(obs, pred): PhosKinTime's "R²" (export.py:414-415). */
  r2: number
  /** RMSE about the identity line: sqrt(mean((pred - obs)^2)) (export.py:416). */
  rmse: number
  slope: number
  intercept: number
  min: number
  max: number
}

/** GOF statistics for paired (obs, pred) values; pairs with a null on either side are dropped. */
export function networkGof(obs: ArrayLike<number>, pred: ArrayLike<number>): GofStats {
  const x: number[] = []
  const y: number[] = []
  for (let i = 0; i < obs.length; i++) {
    if (Number.isFinite(obs[i]) && Number.isFinite(pred[i])) {
      x.push(obs[i])
      y.push(pred[i])
    }
  }
  const resid = y.map((v, i) => v - x[i])
  const sigma = robustSigma(resid)
  const lr = linregress(x, y)
  const rmse = Math.sqrt(mean(resid.map((v) => v * v)))
  let lo = Infinity
  let hi = -Infinity
  for (const v of x.concat(y)) {
    if (v < lo) lo = v
    if (v > hi) hi = v
  }
  return { n: x.length, sigma, d95: Z95 * sigma, d99: Z99 * sigma, r2: lr.r * lr.r, rmse, slope: lr.slope, intercept: lr.intercept, min: lo, max: hi }
}

/**
 * protwise plot_gof band offsets (plotting.py:319-321): std (ddof 0) of all observed values pooled
 * over genes, psites and time points (std of observations, not residuals).
 */
export function protwiseGofOffsets(observed: ArrayLike<number>): { std: number; d95: number; d99: number } {
  const s = std(finite(observed), 0)
  return { std: s, d95: PROTWISE_Z95 * s, d99: PROTWISE_Z99 * s }
}
