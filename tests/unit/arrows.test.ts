import { describe, expect, it } from 'vitest'
import { pixelAngle } from '../../src/lib/plot/arrows'

/** d3-style linear scale: domain [d0, d1] -> range [r0, r1] */
const lin = (d0: number, d1: number, r0: number, r1: number) => (v: number) => r0 + ((v - d0) / (d1 - d0)) * (r1 - r0)
const seg = (x0: number, y0: number, x1: number, y1: number) => ({ x0, y0, x1, y1, x: (x0 + x1) / 2, y: (y0 + y1) / 2 })
const dataSpace = (d: ReturnType<typeof seg>) => (Math.atan2(d.x1 - d.x0, d.y1 - d.y0) * 180) / Math.PI

describe('PixelArrows direction (P11): angle from pixel space', () => {
  // x spans 0..1 over 400 px, y spans 0..1000 over 300 px (screen y downwards): very unequal scales
  const fx = lin(0, 1, 0, 400)
  const fy = lin(0, 1000, 300, 0)

  it('a segment drawn at 45° up-right points at 45°, although its data-space angle is ~0.03°', () => {
    // dx = 0.25 (100 px), dy = 333.33 (100 px up)
    const d = seg(0.25, 400, 0.5, 400 + 1000 / 3)
    expect(pixelAngle(fx, fy, d)).toBeCloseTo(45, 9)
    expect(dataSpace(d)).toBeLessThan(0.1) // the distorted answer the pixel-space rule avoids
  })

  it('cardinal directions follow the drawn path', () => {
    expect(pixelAngle(fx, fy, seg(0.1, 500, 0.1, 900))).toBeCloseTo(0, 9) // up
    expect(pixelAngle(fx, fy, seg(0.1, 500, 0.9, 500))).toBeCloseTo(90, 9) // right
    expect(Math.abs(pixelAngle(fx, fy, seg(0.1, 900, 0.1, 500)))).toBeCloseTo(180, 9) // down
    expect(pixelAngle(fx, fy, seg(0.9, 500, 0.1, 500))).toBeCloseTo(-90, 9) // left
  })

  it('matches the on-screen direction for arbitrary segments and reversed (decreasing) scales', () => {
    const fxr = lin(0, 1, 400, 0) // reversed x axis
    for (const [x0, y0, x1, y1] of [[0.2, 100, 0.3, 700], [0.7, 900, 0.1, 50], [0.5, 500, 0.52, 480]]) {
      for (const f of [fx, fxr]) {
        const d = seg(x0, y0, x1, y1)
        const px = f(x1) - f(x0)
        const py = fy(y1) - fy(y0)
        const rad = (pixelAngle(f, fy, d) * Math.PI) / 180
        // unit vector of the rotation (clockwise from north, screen coordinates) is parallel to the drawn segment
        const ux = Math.sin(rad)
        const uy = -Math.cos(rad)
        const n = Math.hypot(px, py)
        expect(ux).toBeCloseTo(px / n, 9)
        expect(uy).toBeCloseTo(py / n, 9)
      }
    }
  })
})
