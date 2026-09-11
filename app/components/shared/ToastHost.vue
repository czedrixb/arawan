<template>
  <div class="safe-bottom pointer-events-none fixed inset-x-0 bottom-4 z-[60] flex flex-col items-center gap-2 px-4" aria-live="polite" role="status">
    <TransitionGroup name="fade">
      <div
        v-for="toast in toasts"
        :key="toast.id"
        class="pointer-events-auto rounded-control bg-text-primary px-4 py-2 text-sm text-white shadow-overlay"
      >
        {{ toast.message }}
      </div>
    </TransitionGroup>
  </div>
</template>

<script setup lang="ts">
const toasts = useToastState()
</script>
