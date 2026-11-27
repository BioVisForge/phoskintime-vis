import { describe, expect, it } from 'vitest'
import { smoothDensity1d } from '../../src/lib/transforms/kde'
import { finite, std } from '../../src/lib/transforms/stats'
import { linspace } from '../../src/lib/transforms/kde'

/** smoothDensity1d's general branch before the loop was rewritten: the oracle for bitwise equality */
function oldDensity(values: number[]) {
  const v = finite(values)
  let vmin = Infinity
  let vmax = -Infinity
  for (const a of v) {
    if (a < vmin) vmin = a
    if (a > vmax) vmax = a
  }
  const span = vmax - vmin
  const x = linspace(vmin - 0.1 * span, vmax + 0.1 * span, 256)
  const n = v.length
  const bw = Math.max(1.06 * std(v, 1) * n ** (-1 / 5), span / 200, 1e-8)
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

describe('smoothDensity1d: loop rewrite is bitwise identical', () => {
  let seed = 3
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647
  for (const n of [2, 3, 17, 500, 2000]) {
    it(`n = ${n} (with a NaN gap)`, () => {
      const vals = Array.from({ length: n }, () => Math.log(rnd() + 1e-9) * 3 + rnd())
      vals.push(NaN)
      const a = smoothDensity1d(vals)
      const b = oldDensity(vals)
      expect(a.x).toEqual(b.x)
      expect(a.density.map((d) => d.toString())).toEqual(b.density.map((d) => d.toString()))
    })
  }
})
