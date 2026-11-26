<script lang="ts">
  import { Plot, AreaY, Line, RuleY, Text } from 'svelteplot'
  import { ridgeNormalised, smoothDensity1d } from '../../transforms/kde'
  import { quantile } from '../../transforms/stats'

  /** P12 ridgeline with PhosKinTime's KDE (_smooth_density_1d). */
  let { series, mode = 'normalised', height }: { series: { name: string; values: ArrayLike<number> }[]; mode?: 'normalised' | 'raw-log' | 'raw'; height?: number } = $props()
  const ridges = $derived(
    series.map((s) => {
      const r = ridgeNormalised(s.values)
      if (mode === 'normalised') return { name: s.name, pts: r.xNorm.map((x, i) => ({ name: s.name, x, d: r.density[i] })), q: [0.05, 0.5, 0.95].map((p) => (quantile(s.values, p) - r.vmin) / (r.vmax - r.vmin)), med: quantile(s.values, 0.5) }
      const k = smoothDensity1d(s.values)
      const keep = k.x.map((x, i) => ({ name: s.name, x, d: k.density[i] })).filter((p) => p.x >= r.vmin && p.x <= r.vmax && (mode !== 'raw-log' || p.x > 0))
      return { name: s.name, pts: keep, q: [0.05, 0.5, 0.95].map((p) => quantile(s.values, p)), med: quantile(s.values, 0.5) }
    }),
  )
  const flat = $derived(ridges.flatMap((r) => r.pts))
  const qs = $derived(ridges.map((r) => ({ name: r.name, x1: r.q[0], x2: r.q[2], x: r.q[1], med: r.med })))
</script>

<Plot height={height ?? Math.max(160, 34 * series.length + 60)} marginLeft={170} fy={{ label: '', domain: series.map((s) => s.name), axis: 'left' }} x={{ type: mode === 'raw-log' ? 'log' : 'linear', label: mode === 'normalised' ? 'Each row normalised to its own min–max (as PhosKinTime)' : mode === 'raw-log' ? 'Value (log scale, shared)' : 'Value (shared scale)' }} y={{ axis: false, domain: [0, 1.15] }}>
  <AreaY data={flat} x="x" y="d" fy="name" fill="#8fb3dc" fillOpacity={0.55} />
  <Line data={flat} x="x" y="d" fy="name" stroke="#2b4f7d" />
  <RuleY data={qs} x1="x1" x2="x2" y={0.05} fy="name" stroke="black" strokeWidth={2} />
  <Text data={qs} x="x2" y={0.3} fy="name" text={(d: any) => `median=${Number(d.med).toPrecision(3)}`} textAnchor="start" dx={6} fontSize={9} />
</Plot>
