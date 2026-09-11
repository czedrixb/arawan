<template>
  <div class="flex flex-col items-center gap-3 px-6 py-12 text-center" role="alert">
    <p class="text-sm text-danger-fg">{{ message }}</p>
    <button type="button" class="press rounded-control border border-control-border px-4 py-2 text-sm font-medium" @click="$emit('retry')">
      Try again
    </button>
  </div>
</template>

<script setup lang="ts">
withDefaults(defineProps<{ message?: string }>(), { message: 'Something went wrong.' })
defineEmits<{ retry: [] }>()
</script>
