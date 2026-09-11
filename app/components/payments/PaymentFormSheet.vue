<template>
  <AppSheet :open="open" title="Record payment" @update:open="$emit('update:open', $event)">
    <div v-if="loan.remaining_centavos == null" class="rounded-control bg-warning-bg p-4 text-sm text-warning-fg">
      This loan's balance needs review before a payment can be recorded. Confirm an opening balance first.
    </div>
    <form v-else class="flex flex-col gap-4" @submit.prevent="onSubmit">
      <div>
        <p class="text-sm text-text-secondary">{{ loan.borrower_display_name }}</p>
        <p class="text-sm text-text-secondary">
          Remaining: <MoneyText :centavos="loan.remaining_centavos" class="font-semibold text-text-primary" />
        </p>
      </div>
      <div>
        <label for="payment-amount" class="mb-1 block text-sm text-text-secondary">Amount (₱)</label>
        <input
          id="payment-amount"
          v-model="amount.text.value"
          type="text"
          inputmode="decimal"
          required
          class="w-full rounded-control border border-control-border px-3 py-2.5 text-base"
          @input="amount.onInput(($event.target as HTMLInputElement).value)"
          @blur="amount.onBlur"
        />
        <p v-if="amount.error.value" class="mt-1 text-xs text-danger-fg">{{ amount.error.value }}</p>
      </div>
      <div>
        <label for="payment-date" class="mb-1 block text-sm text-text-secondary">Date</label>
        <input id="payment-date" v-model="paidOn" type="date" required class="w-full rounded-control border border-control-border px-3 py-2.5 text-base" />
      </div>
      <div>
        <label for="payment-note" class="mb-1 block text-sm text-text-secondary">Note (optional)</label>
        <input id="payment-note" v-model="note" type="text" class="w-full rounded-control border border-control-border px-3 py-2.5 text-base" />
      </div>
      <p v-if="submitError" role="alert" class="text-sm text-danger-fg">{{ submitError }}</p>
      <p v-if="success" role="status" class="text-sm text-success-fg">Payment saved.</p>
    </form>
    <template #footer>
      <button
        v-if="loan.remaining_centavos != null"
        type="submit"
        :disabled="submitting"
        class="press w-full rounded-control bg-primary px-4 py-3 text-sm font-semibold text-white disabled:opacity-60"
        @click="onSubmit"
      >
        {{ submitting ? 'Saving…' : 'Save payment' }}
      </button>
    </template>
  </AppSheet>
</template>

<script setup lang="ts">
const props = defineProps<{ open: boolean; loan: any }>()
const emit = defineEmits<{ 'update:open': [boolean] }>()

const amountCentavos = ref<number | null>(null)
const amount = useMoneyInput(amountCentavos)
const paidOn = ref(todayIso())
const note = ref('')
const submitting = ref(false)
const submitError = ref<string | null>(null)
const success = ref(false)
// Generated once per sheet-open (spec §6 record payment): a network
// timeout retry replays this same key instead of double-paying.
let idempotencyKey = crypto.randomUUID()

watch(
  () => props.open,
  (isOpen) => {
    if (!isOpen) return
    idempotencyKey = crypto.randomUUID()
    success.value = false
    submitError.value = null
    paidOn.value = todayIso()
    note.value = ''
    const remaining = props.loan.remaining_centavos
    const daily = props.loan.daily_due_centavos
    amountCentavos.value = remaining != null && daily != null ? Math.min(daily, remaining) : null
    amount.text.value = amountCentavos.value != null ? (amountCentavos.value / 100).toFixed(2) : ''
  },
)

async function onSubmit() {
  if (!amountCentavos.value) return
  submitting.value = true
  submitError.value = null
  try {
    await recordPayment(props.loan.id, {
      amountCentavos: amountCentavos.value,
      paidOn: paidOn.value,
      note: note.value || null,
      idempotencyKey,
    })
    success.value = true
    useToast().show('Payment saved')
    setTimeout(() => emit('update:open', false), 700)
  } catch (err: any) {
    submitError.value = err?.data?.statusMessage ?? 'Could not save this payment.'
  } finally {
    submitting.value = false
  }
}
</script>
