import { finite, std } from './stats'

/**
 * Port of networkmodel/BayesianInference.py `_smooth_density_1d` (e634e17): Gaussian KDE on a
 * 256-point grid over [min - 0.1*span, max + 0.1*span], Silverman bandwidth
 * 1.06 * sd(ddof=1) * n^(-1/5) floored at max(span/200, 1e-8), density normalised to peak 1.
 */
export function smoothDensity1d(values: ArrayLike<number>, gridSize = 256): { x: number[]; density: number[] } {
  const v = finite(values)
  if (!v.length) return { x: [0, 1], density: [0, 0] }
  const allClose = v.every((a) => Math.abs(a - v[0]) <= 1e-8 + 1e-5 * Math.abs(v[0]))
  if (v.length === 1 || allClose) {
    const c = v[0]
    const span = Math.max(Math.abs(c) * 0.05, 1e-3)
    const x = linspace(c - span, c + span, gridSize)
    const d = x.map((xi) => Math.exp(-0.5 * ((xi - c) / (span / 4)) ** 2))
    const mx = Math.max(Math.max(...d), 1e-12)
    return { x, density: d.map((di) => di / mx) }
  }
  let vmin = Infinity
  let vmax = -Infinity
  for (const a of v) {
    if (a < vmin) vmin = a
    if (a > vmax) vmax = a
  }
  const span = vmax - vmin
  const pad = 0.1 * span
  const x = linspace(vmin - pad, vmax + pad, gridSize)
  const sd = std(v, 1)
  const n = v.length
  let bw = 1.06 * sd * n ** (-1 / 5)
  bw = Math.max(bw, span / 200, 1e-8)
  const norm = bw * Math.sqrt(2 * Math.PI)
  const density = x.map((xi) => {
    let s = 0
    for (const a of v) {
      const z = (xi - a) / bw
      s += Math.exp(-0.5 * z * z)
    }
    return s / n / norm
  })
  const mx = Math.max(...density)
  return { x, density: mx > 0 ? density.map((d) => d / mx) : density }
}

/** numpy.linspace(a, b, n) with endpoint=True. */
export function linspace(a: number, b: number, n: number): number[] {
  if (n === 1) return [a]
  const step = (b - a) / (n - 1)
  const out = new Array(n)
  for (let i = 0; i < n; i++) out[i] = a + i * step
  out[n - 1] = b
  return out
}

/**
 * Ridge for one parameter as `_plot_ridgeline_parameter_distributions` draws it: grid normalised
 * to the posterior's own [min, max] and clipped to [0, 1] (np.clip; no reflection).
 */
export function ridgeNormalised(values: ArrayLike<number>): { xNorm: number[]; density: number[]; vmin: number; vmax: number } {
  const v = finite(values)
  const vmin = Math.min(...v)
  const vmax = Math.max(...v)
  if (Math.abs(vmax - vmin) <= 1e-8 + 1e-5 * Math.abs(vmin)) {
    const xNorm = linspace(0.45, 0.55, 256)
    const d = xNorm.map((x) => Math.exp(-0.5 * ((x - 0.5) / 0.015) ** 2))
    const mx = Math.max(Math.max(...d), 1e-12)
    return { xNorm, density: d.map((x) => x / mx), vmin, vmax }
  }
  const { x, density } = smoothDensity1d(v)
  return { xNorm: x.map((xi) => Math.min(1, Math.max(0, (xi - vmin) / (vmax - vmin)))), density, vmin, vmax }
}
