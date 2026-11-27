/** A finite-difference segment and its anchor (the segment midpoint), in data units. */
export interface ArrowSegment {
  x0: number
  y0: number
  x1: number
  y1: number
  x: number
  y: number
}

/**
 * Clockwise rotation from north, in degrees, of the segment as DRAWN: the direction comes from
 * the pixel positions fx(x), fy(y), not from data units. With unequal x and y scales a data-space
 * atan2(dx, dy) points the wrong way. Screen y grows downwards.
 */
export function pixelAngle(fx: (v: number) => number, fy: (v: number) => number, d: ArrowSegment): number {
  return (Math.atan2(fx(d.x1) - fx(d.x0), -(fy(d.y1) - fy(d.y0))) * 180) / Math.PI
}
