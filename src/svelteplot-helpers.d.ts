declare module 'svelteplot/helpers/math.js' {
  export function confidenceInterval(
    data: { x: number; y: number }[],
    predict: (x: number) => number,
    confidenceLevel: number,
  ): (x: number) => { x: number; left: number; right: number }
}
declare module '*.ttf?inline' {
  const url: string
  export default url
}
