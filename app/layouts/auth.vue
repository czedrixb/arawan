<template>
  <div class="flex min-h-dvh flex-col items-center justify-center bg-canvas px-6 safe-top safe-bottom">
    <img src="/brand/arawan-logo.png" alt="ARAWAN" class="mb-8 h-20 w-auto" />
    <div class="w-full max-w-sm">
      <slot />
    </div>
    <ToastHost />
    <OfflineBanner />
  </div>
</template>
