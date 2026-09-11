<template>
  <aside class="safe-top hidden w-56 flex-col border-r border-border bg-surface lg:flex" aria-label="Primary">
    <div class="flex items-center gap-2 px-5 py-5">
      <img src="/icons/icon-192.png" width="28" height="28" alt="" class="h-7 w-7" />
      <span class="text-base font-semibold text-text-primary">ARAWAN</span>
    </div>
    <nav class="flex flex-col gap-1 px-3">
      <NuxtLink
        v-for="tab in tabs"
        :key="tab.to"
        :to="tab.to"
        class="press flex items-center gap-3 rounded-control px-3 py-2.5 text-sm font-medium"
        :class="isActive(tab.to) ? 'bg-accent-soft text-primary' : 'text-text-secondary hover:bg-surface-subtle'"
      >
        <component :is="tab.icon" :size="20" :weight="isActive(tab.to) ? 'fill' : 'regular'" />
        {{ tab.label }}
      </NuxtLink>
    </nav>
  </aside>
</template>

<script setup lang="ts">
import { PhHouse, PhListBullets, PhGearSix } from '@phosphor-icons/vue'

const route = useRoute()
const tabs = [
  { to: '/', label: 'Overview', icon: PhHouse },
  { to: '/records', label: 'Records', icon: PhListBullets },
  { to: '/settings', label: 'Settings', icon: PhGearSix },
]
function isActive(to: string) {
  return to === '/' ? route.path === '/' : route.path.startsWith(to)
}
</script>
