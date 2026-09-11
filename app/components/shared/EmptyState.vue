<template>
  <div class="flex flex-col items-center gap-3 px-6 py-12 text-center">
    <p class="text-sm text-text-secondary">{{ message }}</p>
    <button v-if="actionLabel" type="button" class="press rounded-control bg-primary px-4 py-2 text-sm font-medium text-white" @click="$emit('action')">
      {{ actionLabel }}
    </button>
  </div>
</template>

<script setup lang="ts">
defineProps<{ message: string; actionLabel?: string }>()
defineEmits<{ action: [] }>()
</script>
