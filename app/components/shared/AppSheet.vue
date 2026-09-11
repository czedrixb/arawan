<template>
  <DialogRoot :open="open" @update:open="onUpdateOpen">
    <DialogPortal>
      <Transition name="fade">
        <DialogOverlay class="fixed inset-0 z-40 bg-black/30" />
      </Transition>
      <Transition :name="reducedMotion ? 'fade' : 'sheet'">
        <DialogContent
          v-if="open"
          class="safe-bottom fixed inset-x-0 bottom-0 z-50 flex max-h-[90dvh] flex-col rounded-t-sheet bg-surface shadow-overlay lg:inset-auto lg:left-1/2 lg:top-1/2 lg:max-h-[85dvh] lg:w-[min(520px,calc(100vw-32px))] lg:-translate-x-1/2 lg:-translate-y-1/2 lg:rounded-card"
          @escape-key-down="requestClose"
        >
          <div class="flex items-center justify-between border-b border-border px-5 py-4">
            <DialogTitle class="text-lg font-semibold text-text-primary">{{ title }}</DialogTitle>
            <DialogClose aria-label="Close" class="press rounded-full p-2 text-text-secondary hover:bg-surface-subtle" @click="requestClose">
              <PhX :size="18" />
            </DialogClose>
          </div>
          <div class="flex-1 overflow-y-auto px-5 py-4">
            <slot />
          </div>
          <div v-if="$slots.footer" class="safe-bottom border-t border-border px-5 py-4">
            <slot name="footer" />
          </div>
        </DialogContent>
      </Transition>
    </DialogPortal>
  </DialogRoot>
</template>

<script setup lang="ts">
// Bottom sheet on mobile, centered dialog on desktop -- one accessible
// primitive (reka-ui Dialog: focus trap, Escape, focus return) styled two
// ways via a `lg:` breakpoint, per spec §6 add/edit loan and §13.
import { DialogClose, DialogContent, DialogOverlay, DialogPortal, DialogRoot, DialogTitle } from 'reka-ui'
import { PhX } from '@phosphor-icons/vue'

const props = defineProps<{ open: boolean; title: string; isDirty?: boolean }>()
const emit = defineEmits<{ 'update:open': [boolean] }>()
const confirm = useConfirm()
const reducedMotion = useReducedMotion()

async function requestClose() {
  if (props.isDirty) {
    const discard = await confirm({
      title: 'Discard changes?',
      message: 'You have unsaved changes. Closing now will discard them.',
      confirmLabel: 'Discard',
      cancelLabel: 'Keep editing',
      danger: true,
    })
    if (!discard) return
  }
  emit('update:open', false)
}

function onUpdateOpen(value: boolean) {
  if (value) emit('update:open', true)
  else requestClose()
}
</script>
