<script lang="ts"></script>

<div class="loading skeleton" role="status" aria-label="Loading"></div>
<style>
  .skeleton { height: 220px; border-radius: 5px; background: linear-gradient(90deg, var(--pkv-surface-2) 0%, var(--pkv-border) 50%, var(--pkv-surface-2) 100%); background-size: 200% 100%; animation: shimmer 1.4s ease-in-out infinite; }
  @keyframes shimmer { from { background-position: 100% 0; } to { background-position: -100% 0; } }
  @media (prefers-reduced-motion: reduce) { .skeleton { animation: none; } }
</style>
