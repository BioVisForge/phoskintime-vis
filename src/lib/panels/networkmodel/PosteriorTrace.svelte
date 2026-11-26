<script lang="ts">
  import P from './PosteriorPlot.svelte'
  import type { PanelProps } from '../types'
  let { bundle, report }: PanelProps = $props()
</script>
<P {bundle} {report} kind="trace" />
