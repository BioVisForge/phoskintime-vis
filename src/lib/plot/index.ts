/**
 * Plot layer used by every panel. Each export wraps the SveltePlot component of the same name:
 * the wrapper records what was drawn (FigureCollector, for TikZ/PGFPlots export) and, in export
 * mode, turns canvas layers into SVG when they are small enough to stay vector.
 * Panels import marks from here, never from 'svelteplot' directly.
 */
export { default as Plot } from './Plot.svelte'
export { default as Line } from './Line.svelte'
export { default as Dot } from './Dot.svelte'
export { default as AreaY } from './AreaY.svelte'
export { default as DifferenceY } from './DifferenceY.svelte'
export { default as BoxY } from './BoxY.svelte'
export { default as RuleX } from './RuleX.svelte'
export { default as RuleY } from './RuleY.svelte'
export { default as RegressionY } from './RegressionY.svelte'
export { default as Vector } from './Vector.svelte'
export { default as Cell } from './Cell.svelte'
export { default as Raster } from './Raster.svelte'
export { default as BarX } from './BarX.svelte'
export { default as RectY } from './RectY.svelte'
export { default as Text } from './Text.svelte'
export { default as CustomMark } from './CustomMark.svelte'
export { default as Rect } from './Rect.svelte'
export { default as Brush } from './Brush.svelte'
export { normalizeParallelX, usePlot } from 'svelteplot'
export * from './context'
export * from './spec'
