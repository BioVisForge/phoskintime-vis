<script lang="ts">
  import G from '../shared/Gof.svelte'
  import type { PanelProps } from '../types'
  let { bundle, report }: PanelProps = $props()
</script>
<G {bundle} {report} workflow="networkmodel" />
