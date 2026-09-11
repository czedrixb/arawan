<template>
  <AppDialog
    :open="open"
    title="Reverse this payment?"
    :description="`This reverses ${amountLabel} paid on ${dateLabel}. This can be undone by recording a new payment, but the original entry stays in the audit trail.`"
    @update:open="$emit('update:open', $event)"
  >
    <form class="flex flex-col gap-4" @submit.prevent="onSubmit">
      <div>
        <label class="mb-1 block text-sm text-text-secondary">Reason</label>
        <input v-model="reason" type="text" required class="w-full rounded-control border border-control-border px-3 py-2.5 text-base" placeholder="e.g. entered wrong amount" />
      </div>
      <p v-if="submitError" role="alert" class="text-sm text-danger-fg">{{ submitError }}</p>
      <div class="flex justify-end gap-3">
        <button type="button" class="press rounded-control border border-control-border px-4 py-2 text-sm font-medium" @click="$emit('update:open', false)">Cancel</button>
        <button type="submit" :disabled="submitting" class="press rounded-control bg-danger-fg px-4 py-2 text-sm font-medium text-white disabled:opacity-60">
          {{ submitting ? 'Reversing…' : 'Reverse payment' }}
        </button>
      </div>
    </form>
  </AppDialog>
</template>

<script setup lang="ts">
const props = defineProps<{ open: boolean; loanId: string; payment: any }>()
const emit = defineEmits<{ 'update:open': [boolean] }>()

const reason = ref('')
const submitting = ref(false)
const submitError = ref<string | null>(null)

const amountLabel = computed(() => formatCentavos(props.payment?.amount_centavos))
const dateLabel = computed(() => formatDateDisplay(props.payment?.paid_on))

async function onSubmit() {
  submitting.value = true
  submitError.value = null
  try {
    await reversePayment(props.loanId, props.payment.id, { reason: reason.value, idempotencyKey: crypto.randomUUID() })
    useToast().show('Payment reversed')
    emit('update:open', false)
  } catch (err: any) {
    submitError.value = err?.data?.statusMessage ?? 'Could not reverse this payment.'
  } finally {
    submitting.value = false
  }
}
</script>
