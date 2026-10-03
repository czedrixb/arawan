<template><label class="text-sm text-text-secondary">{{ label }} (₱)<input :data-testid="testid" :value="money.text.value" inputmode="decimal" class="mt-1 w-full rounded-control border border-control-border px-3 py-2.5 text-base" @input="money.onInput(($event.target as HTMLInputElement).value)" @blur="money.onBlur" /></label></template>
<script setup lang="ts">
defineProps<{label:string;testid?:string}>()
const model = defineModel<number>({ required: true })
const money = useMoneyInput(model)
if (model.value === 0) money.text.value = ''
</script>
