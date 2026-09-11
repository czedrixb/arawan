<template>
  <header class="flex items-center justify-between gap-3 px-4 pt-4 lg:px-8 lg:pt-8">
    <div>
      <h1 class="text-[28px] font-bold leading-tight text-text-primary lg:text-[28px]">{{ title }}</h1>
      <p v-if="subtitle" class="text-sm text-text-secondary">{{ subtitle }}</p>
    </div>
    <slot name="actions" />
  </header>
</template>

<script setup lang="ts">
defineProps<{ title: string; subtitle?: string }>()
</script>
