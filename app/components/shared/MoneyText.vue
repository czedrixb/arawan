<template>
  <span class="tabular-money" :class="unknownClass">{{ display }}</span>
</template>

<script setup lang="ts">
const props = defineProps<{ centavos: number | null | undefined; unknownLabel?: string }>()
const display = computed(() =>
  props.centavos == null ? props.unknownLabel ?? 'Balance needs review' : formatCentavos(props.centavos),
)
const unknownClass = computed(() => (props.centavos == null ? 'text-text-secondary italic' : ''))
</script>
