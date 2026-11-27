/**
 * Data colours, shared by the UI, PNG, PDF, SVG and TikZ exports.
 *
 * Categorical: Okabe–Ito, reordered so adjacent slots stay separable under colour-vision
 * deficiency (validated with the dataviz skill's validate_palette.js on white: CVD ΔE ≥ 9.6,
 * normal-vision ΔE ≥ 20; orange and sky blue are below 3:1 contrast on white, so every chart
 * keeps a legend and a data table). Slots 7–8 (yellow, grey) only appear with > 6 categories.
 * Sequential: viridis. Diverging: RdBu centred at 0 (blue = negative is reversed where a
 * panel says so).
 */
export const okabeIto = ['#0072B2', '#E69F00', '#009E73', '#D55E00', '#56B4E9', '#CC79A7', '#F0E442', '#999999']

export const okabeItoNames: Record<string, string> = {
  '#0072B2': 'OIblue',
  '#E69F00': 'OIorange',
  '#009E73': 'OIgreen',
  '#D55E00': 'OIvermillion',
  '#56B4E9': 'OIskyblue',
  '#CC79A7': 'OIpurple',
  '#F0E442': 'OIyellow',
  '#999999': 'OIgrey',
}
