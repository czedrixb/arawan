<template>
  <div aria-hidden="true" role="presentation">
    <div v-if="variant === 'list'" class="flex flex-col gap-2">
      <div v-for="i in rows" :key="i" class="skeleton h-14 w-full" />
    </div>
    <div v-else-if="variant === 'stat-grid'" class="grid grid-cols-2 gap-3">
      <div v-for="i in rows" :key="i" class="skeleton h-20 w-full" />
    </div>
    <div v-else-if="variant === 'card'" class="skeleton h-40 w-full" />
    <div v-else class="skeleton h-4 w-full" />
  </div>
</template>

<script setup lang="ts">
withDefaults(defineProps<{ variant?: 'list' | 'stat-grid' | 'card' | 'line'; rows?: number }>(), {
  variant: 'list',
  rows: 4,
})
</script>
