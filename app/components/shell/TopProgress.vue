<template>
  <Transition name="fade">
    <div v-if="active" class="fixed inset-x-0 top-0 z-50 h-0.5 overflow-hidden bg-transparent" role="status" aria-label="Loading">
      <div class="h-full w-1/3 bg-primary" :class="{ 'animate-slide': !reducedMotion }" />
    </div>
  </Transition>
</template>

<script setup lang="ts">
const { active } = useTopProgress()
const reducedMotion = useReducedMotion()
</script>

<style scoped>
@keyframes slide {
  0% {
    transform: translateX(-100%);
  }
  100% {
    transform: translateX(300%);
  }
}
.animate-slide {
  animation: slide 1s ease-in-out infinite;
}
</style>
