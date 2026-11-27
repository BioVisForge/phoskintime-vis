<script lang="ts">
  import Embedding from './Embedding.svelte'
  import type { PanelProps } from '../types'
  let { bundle, report }: PanelProps = $props()
</script>
<Embedding {bundle} {report} method="tsne" />
