<script lang="ts">
  import S from '../shared/Sensitivity.svelte'
  import type { PanelProps } from '../types'
  let { bundle, report }: PanelProps = $props()
</script>
<S {bundle} {report} workflow="protwise" />
