<script lang="ts">
  import { Plot, AreaY, Line, RuleY, Text } from '../../plot'
  import { ridgeNormalised, smoothDensity1d } from '../../transforms/kde'
  import { quantile } from '../../transforms/stats'

  /**
   * P12 ridgeline with PhosKinTime's KDE (_smooth_density_1d). Ridges are drawn the way
   * _plot_ridgeline_parameter_distributions draws them: one axis, each ridge offset to its own
   * baseline (y + 0.75 · density). One plot with three marks instead of one facet per parameter
   * (25 fy facets took about 21 s to render; see docs/plot-patterns.md).
   */
  let { series, mode = 'normalised', height }: { series: { name: string; values: ArrayLike<number> }[]; mode?: 'normalised' | 'raw-log' | 'raw'; height?: number } = $props()
  const H = 0.75 // ridge_height
  const ridges = $derived(
    series.map((s, i) => {
      const base = series.length - 1 - i // first series on top, as PhosKinTime (y_positions reversed)
      const r = ridgeNormalised(s.values)
      const qs = [0.05, 0.5, 0.95].map((p) => quantile(s.values, p))
      if (mode === 'normalised') {
        const n = (v: number) => (v - r.vmin) / (r.vmax - r.vmin)
        return { name: s.name, base, pts: r.xNorm.map((x, k) => ({ name: s.name, x, y0: base, y: base + H * r.density[k] })), q: qs.map(n), med: qs[1] }
      }
      const k = smoothDensity1d(s.values)
      const keep = k.x.map((x, j) => ({ name: s.name, x, y0: base, y: base + H * k.density[j] })).filter((p) => p.x >= r.vmin && p.x <= r.vmax && (mode !== 'raw-log' || p.x > 0))
      return { name: s.name, base, pts: keep, q: qs, med: qs[1] }
    }),
  )
  const flat = $derived(ridges.flatMap((r) => r.pts))
  const qbars = $derived(ridges.map((r) => ({ name: r.name, y: r.base + 0.05, x1: r.q[0], x2: r.q[2], med: r.med })))
  const names = $derived(new Map(ridges.map((r) => [r.base, r.name])))
</script>

<Plot
  height={height ?? Math.max(160, 30 * series.length + 70)}
  marginLeft={190}
  x={{ type: mode === 'raw-log' ? 'log' : 'linear', label: mode === 'normalised' ? 'Each row normalised to its own min–max (as PhosKinTime)' : mode === 'raw-log' ? 'Value (log scale, shared)' : 'Value (shared scale)' }}
  y={{ domain: [-0.1, series.length], ticks: ridges.map((r) => r.base), tickFormat: (d: any) => names.get(d) ?? '', label: '' }}>
  <AreaY data={flat} x="x" y1="y0" y2="y" z="name" fill="#8fb3dc" fillOpacity={0.55} />
  <Line data={flat} x="x" y="y" z="name" stroke="#2b4f7d" strokeWidth={1} />
  <RuleY data={qbars} y="y" x1="x1" x2="x2" stroke="var(--pkv-ink)" strokeWidth={2} />
  <Text data={qbars} x="x2" y="y" text={(d: any) => `median=${Number(d.med).toPrecision(3)}`} textAnchor="start" dx={6} dy={-6} fontSize={9} />
</Plot>
