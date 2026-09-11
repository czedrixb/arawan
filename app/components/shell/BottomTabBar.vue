<template>
  <nav
    class="safe-bottom fixed inset-x-0 bottom-0 z-30 flex border-t border-border bg-surface lg:hidden"
    :class="{ 'translate-y-full': keyboardOpen }"
    style="transition: transform 160ms ease-out"
    aria-label="Primary"
  >
    <NuxtLink
      v-for="tab in tabs"
      :key="tab.to"
      :to="tab.to"
      class="press flex flex-1 flex-col items-center gap-1 py-2 text-xs touch-manipulation"
      :class="isActive(tab.to) ? 'text-primary' : 'text-text-secondary'"
      @touchend.prevent="navigateTo(tab.to)"
    >
      <component :is="tab.icon" :size="22" :weight="isActive(tab.to) ? 'fill' : 'regular'" />
      {{ tab.label }}
    </NuxtLink>
  </nav>
</template>

<script setup lang="ts">
// touchend.prevent + touch-manipulation cuts the ~300ms mobile tap delay
// (spec §2 point 5). Hiding while an input has focus works around a real
// bug: a fixed bottom bar keeps its hit area after the on-screen keyboard
// shrinks the viewport, causing phantom navigations underneath the
// keyboard -- observed and fixed the same way in the reference project.
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

const keyboardOpen = ref(false)
function onFocusIn(e: FocusEvent) {
  const el = e.target as HTMLElement
  keyboardOpen.value = el.tagName === 'INPUT' || el.tagName === 'TEXTAREA'
}
function onFocusOut() {
  requestAnimationFrame(() => {
    const active = document.activeElement
    keyboardOpen.value = !!active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA')
  })
}
onMounted(() => {
  document.addEventListener('focusin', onFocusIn)
  document.addEventListener('focusout', onFocusOut)
})
onUnmounted(() => {
  document.removeEventListener('focusin', onFocusIn)
  document.removeEventListener('focusout', onFocusOut)
})
</script>
