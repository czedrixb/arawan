<template>
  <div v-if="!online" role="status" class="safe-top fixed inset-x-0 top-0 z-[70] bg-warning-bg px-4 py-2 text-center text-sm text-warning-fg">
    You're offline -- showing what's cached. Payments and other saves are unavailable.
    <button type="button" class="ml-2 underline" @click="retry">Retry</button>
  </div>
</template>

<script setup lang="ts">
// Spec §12: "Offline after a prior visit shows a branded connection
// message with Retry ... payment/import saves are unavailable and
// clearly labelled." This is the always-visible version of that; the
// service worker's navigateFallback additionally lets the shell itself
// still boot offline instead of a browser error page.
const online = useOnline()
function retry() {
  window.location.reload()
}
</script>
