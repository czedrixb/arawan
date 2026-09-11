<template>
  <AppDialog
    v-if="state"
    :open="true"
    :title="state.title"
    :description="state.message"
    @update:open="(v: boolean) => !v && respond(false)"
    @cancel="respond(false)"
  >
    <div class="flex justify-end gap-3">
      <button type="button" class="press rounded-control border border-control-border px-4 py-2 text-sm font-medium" @click="respond(false)">
        {{ state.cancelLabel ?? 'Cancel' }}
      </button>
      <button
        type="button"
        class="press rounded-control px-4 py-2 text-sm font-medium text-white"
        :class="state.danger ? 'bg-danger-fg' : 'bg-primary'"
        @click="respond(true)"
      >
        {{ state.confirmLabel ?? 'Confirm' }}
      </button>
    </div>
  </AppDialog>
</template>

<script setup lang="ts">
const state = useConfirmState()

function respond(value: boolean) {
  state.value?.resolve(value)
  state.value = null
}
</script>
