<template>
  <div v-if="pct != null" class="flex items-center gap-2">
    <div class="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-subtle" role="progressbar" :aria-valuenow="pct" aria-valuemin="0" aria-valuemax="100">
      <div class="h-full rounded-full bg-primary" :style="{ width: `${Math.min(100, pct)}%` }" />
    </div>
    <span class="text-xs text-text-secondary tabular-money">{{ pct }}%</span>
  </div>
  <!-- Spec §13: progress bars expose values only when known -- never a fake/zero bar for an unresolved loan. -->
  <span v-else class="text-xs text-text-secondary italic">Progress needs review</span>
</template>

<script setup lang="ts">
defineProps<{ pct: number | null | undefined }>()
</script>
