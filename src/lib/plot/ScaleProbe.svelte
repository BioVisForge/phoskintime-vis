<script lang="ts">
  import { usePlot } from 'svelteplot'
  import type { PlotSpec } from './spec'

  /** Copies the Plot's resolved scales (types, domains, ranges) into the figure spec. */
  let { spec }: { spec: PlotSpec } = $props()
  const plot = usePlot()
  $effect(() => {
    const out: PlotSpec['scales'] = {}
    for (const [k, s] of Object.entries(plot.scales as Record<string, any>)) {
      if (!s || s.isDummy) continue
      out[k] = { type: s.type, domain: [...(s.domain ?? [])], range: [...(s.range ?? [])], fn: s.fn, label: s.autoTitle }
    }
    spec.scales = out
    spec.width = plot.width
    spec.height = plot.height
    spec.body = plot.body
    const o = plot.options as any
    spec.margins = { left: +o.marginLeft || 0, right: +o.marginRight || 0, top: +o.marginTop || 0, bottom: +o.marginBottom || 0 }
  })
</script>
