<template>
  <DropdownMenuRoot>
    <DropdownMenuTrigger as-child>
      <slot name="trigger" />
    </DropdownMenuTrigger>
    <DropdownMenuPortal>
      <DropdownMenuContent
        align="end"
        :side-offset="4"
        class="z-50 min-w-[180px] overflow-hidden rounded-control border border-border bg-surface py-1 shadow-overlay"
      >
        <DropdownMenuItem
          v-for="item in items"
          :key="item.label"
          class="press block w-full cursor-pointer px-3 py-2 text-left text-sm outline-none data-[highlighted]:bg-surface-subtle"
          :class="item.danger ? 'text-danger-fg' : 'text-text-primary'"
          @select="item.onSelect"
        >
          {{ item.label }}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenuPortal>
  </DropdownMenuRoot>
</template>

<script setup lang="ts">
// Desktop row-actions menu (Records table) -- reka-ui's DropdownMenu gives
// focus trap, Escape, arrow-key roving and outside-click close for free,
// same family already used by AppDialog.vue/AppSheet.vue.
import { DropdownMenuContent, DropdownMenuItem, DropdownMenuPortal, DropdownMenuRoot, DropdownMenuTrigger } from 'reka-ui'

defineProps<{ items: { label: string; onSelect: () => void; danger?: boolean }[] }>()
</script>
