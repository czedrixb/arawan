<template>
  <div class="flex items-center gap-1.5">
    <template v-if="!editing">
      <p class="truncate text-base font-semibold text-text-primary">{{ loan.borrower_display_name }}</p>
      <button type="button" class="press rounded-full p-1 text-text-secondary hover:bg-surface-subtle" aria-label="Edit borrower name" @click="startEdit">
        <PhPencilSimple :size="14" />
      </button>
    </template>
    <template v-else>
      <input
        ref="inputEl"
        v-model="value"
        type="text"
        class="w-full rounded-control border border-control-border px-2 py-1 text-base"
        @keydown.enter="save"
        @keydown.escape="cancel"
        @blur="save"
      />
      <span v-if="saveState === 'saving'" class="text-xs text-text-secondary">Saving…</span>
      <span v-else-if="saveState === 'error'" class="text-xs text-danger-fg">Error</span>
    </template>
  </div>
</template>

<script setup lang="ts">
// Spec §6 Records desktop: "inline editing of simple fields with a
// pencil/Enter action ... save on Enter, cancel on Escape."
import { PhPencilSimple } from '@phosphor-icons/vue'

const props = defineProps<{ loan: any }>()
const editing = ref(false)
const value = ref('')
const saveState = ref<'idle' | 'saving' | 'error'>('idle')
const inputEl = ref<HTMLInputElement>()

function startEdit() {
  value.value = props.loan.borrower_display_name
  editing.value = true
  saveState.value = 'idle'
  nextTick(() => inputEl.value?.focus())
}
function cancel() {
  editing.value = false
}
async function save() {
  // Enter triggers @keydown.enter AND the blur it causes triggers
  // @blur -- both call save(). Without this guard both fire the same
  // PATCH concurrently with the same (pre-edit) version; the loser gets
  // a 409 and the rename appears to silently fail depending on timing.
  if (!editing.value || saveState.value === 'saving') return
  if (value.value.trim() === props.loan.borrower_display_name) {
    editing.value = false
    return
  }
  saveState.value = 'saving'
  try {
    await $fetch(`/api/borrowers/${props.loan.borrower_id}`, {
      method: 'PATCH',
      body: { displayName: value.value.trim(), version: props.loan.borrower_version },
    })
    await syncRecordData({ loanId: props.loan.id })
    editing.value = false
    saveState.value = 'idle'
  } catch {
    saveState.value = 'error'
  }
}
</script>
