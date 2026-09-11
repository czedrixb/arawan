<template>
  <div class="fixed inset-0 flex flex-col items-center justify-center gap-4 bg-canvas safe-top safe-bottom">
    <img src="/icons/icon-192.png" width="96" height="96" alt="ARAWAN" class="h-24 w-24" :class="{ 'animate-pulse-logo': !reducedMotion }" />
    <p v-if="showStillLoading && !showRetry" class="text-sm text-text-secondary" role="status">Still loading…</p>
    <div v-if="showRetry" class="flex flex-col items-center gap-3 text-center">
      <p class="text-sm text-text-secondary" role="alert">This is taking longer than expected.</p>
      <div class="flex gap-3">
        <button type="button" class="press rounded-control border border-control-border px-4 py-2 text-sm font-medium" @click="retry">
          Retry
        </button>
        <NuxtLink to="/login" class="press rounded-control bg-primary px-4 py-2 text-sm font-medium text-white">
          Sign in
        </NuxtLink>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
// Spec §12 launch state machine: at ~2s show "Still loading...", at a
// bounded timeout (10s) offer Retry + sign-in recovery -- never an
// endless spinner. This only renders while useAuthReady() is false, i.e.
// during the initial session check (app/plugins/auth-ready.client.ts).
const showStillLoading = ref(false)
const showRetry = ref(false)
const reducedMotion = useReducedMotion()

let stillLoadingTimer: ReturnType<typeof setTimeout> | undefined
let retryTimer: ReturnType<typeof setTimeout> | undefined

onMounted(() => {
  stillLoadingTimer = setTimeout(() => (showStillLoading.value = true), 2000)
  retryTimer = setTimeout(() => (showRetry.value = true), 10_000)
})
onUnmounted(() => {
  clearTimeout(stillLoadingTimer)
  clearTimeout(retryTimer)
})

function retry() {
  // A full reload is the simplest reliable recovery from a genuinely
  // stuck session check (e.g. a hung network request).
  window.location.reload()
}
</script>

<style scoped>
@keyframes pulse-logo {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.6;
  }
}
.animate-pulse-logo {
  animation: pulse-logo 1.8s ease-in-out infinite;
}
</style>
