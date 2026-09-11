<template>
  <DialogRoot :open="open" @update:open="onUpdateOpen">
    <DialogPortal>
      <Transition name="fade">
        <DialogOverlay class="fixed inset-0 z-40 bg-black/30" />
      </Transition>
      <DialogContent
        class="fixed left-1/2 top-1/2 z-50 w-[min(420px,calc(100vw-32px))] -translate-x-1/2 -translate-y-1/2 rounded-card bg-surface p-6 shadow-overlay"
        @escape-key-down="$emit('cancel')"
      >
        <DialogTitle class="text-lg font-semibold text-text-primary">{{ title }}</DialogTitle>
        <DialogDescription v-if="description" class="mt-1 text-sm text-text-secondary">
          {{ description }}
        </DialogDescription>
        <div class="mt-4">
          <slot />
        </div>
      </DialogContent>
    </DialogPortal>
  </DialogRoot>
</template>

<script setup lang="ts">
// reka-ui's Dialog gives focus trapping, Escape, and focus return for
// free (spec §13) -- we only supply positioning/visual styling.
import { DialogContent, DialogDescription, DialogOverlay, DialogPortal, DialogRoot, DialogTitle } from 'reka-ui'

defineProps<{ open: boolean; title: string; description?: string }>()
const emit = defineEmits<{ 'update:open': [boolean]; cancel: [] }>()

function onUpdateOpen(value: boolean) {
  emit('update:open', value)
  if (!value) emit('cancel')
}
</script>
