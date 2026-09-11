<template>
  <AppLaunchScreen v-if="!ready" />
  <NuxtLayout v-else>
    <NuxtPage />
  </NuxtLayout>
</template>

<script setup lang="ts">
// Layer 2 of the three-layer splash (spec §12): this is the in-app
// fallback that covers every browser launch and the gap before the OS
// splash/manifest kick in on an installed PWA. Layer 1 (pre-boot paint)
// is app/spa-loading-template.html; layer 3 is the manifest/apple-touch
// startup images configured in nuxt.config.ts.
const ready = useAuthReady()
</script>
