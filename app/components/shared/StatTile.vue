<template>
  <component
    :is="to ? NuxtLink : 'div'"
    :to="to"
    class="rounded-card border border-border bg-surface p-4 shadow-card"
    :class="to ? 'press block' : ''"
  >
    <p class="text-xs text-text-secondary">{{ label }}</p>
    <p class="mt-1 text-xl font-semibold tabular-money" :class="toneClass">{{ value }}</p>
  </component>
</template>

<script setup lang="ts">
import { NuxtLink } from '#components'
import type { RouteLocationRaw } from 'vue-router'

const props = defineProps<{ label: string; value: string; to?: RouteLocationRaw; tone?: 'danger' | 'warning' }>()
const toneClass = computed(() => (props.tone === 'danger' ? 'text-danger-fg' : props.tone === 'warning' ? 'text-warning-fg' : 'text-text-primary'))
</script>
