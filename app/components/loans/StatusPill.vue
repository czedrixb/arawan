<template>
  <span
    class="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium"
    :style="{ color: meta.fg, backgroundColor: meta.bg }"
  >
    {{ meta.label }}
  </span>
</template>

<script setup lang="ts">
const props = defineProps<{ status: DisplayStatus }>()
const meta = computed(() => STATUS_META[props.status])
</script>
