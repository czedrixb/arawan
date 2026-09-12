<template>
  <AppSheet :open="open" title="Edit record" :is-dirty="isDirty" @update:open="emit('update:open', $event)">
    <form class="flex flex-col gap-5" @submit.prevent="onSubmit">
      <section>
        <h3 class="mb-2 text-sm font-semibold text-text-primary">Workbook columns</h3>
        <div class="flex flex-col gap-3">
          <div>
            <label for="edit-record-name" class="mb-1 block text-sm text-text-secondary">Name</label>
            <input id="edit-record-name" v-model="displayName" required maxlength="200" class="w-full rounded-control border border-control-border px-3 py-2.5 text-base" />
          </div>
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label for="edit-record-borrowed" class="mb-1 block text-sm text-text-secondary">Date Borrowed</label>
              <input id="edit-record-borrowed" v-model="borrowedOn" type="date" required class="w-full rounded-control border border-control-border px-3 py-2.5 text-base" />
            </div>
            <div>
              <label for="edit-record-payment-start" class="mb-1 block text-sm text-text-secondary">Payment Start</label>
              <input id="edit-record-payment-start" v-model="paymentStartOn" type="date" required class="w-full rounded-control border border-control-border px-3 py-2.5 text-base" />
            </div>
          </div>
          <div>
            <label for="edit-record-completed" class="mb-1 block text-sm text-text-secondary">Date Completed</label>
            <input id="edit-record-completed" v-model="dueOn" type="date" required class="w-full rounded-control border border-control-border px-3 py-2.5 text-base" />
          </div>
        </div>
      </section>

      <section>
        <h3 class="mb-2 text-sm font-semibold text-text-primary">Loan amounts</h3>
        <p v-if="financialTermsLocked" class="mb-3 rounded-control bg-surface-subtle p-3 text-xs text-text-secondary">Amounts are locked because this loan has payment or opening balance history.</p>
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label for="edit-record-amount" class="mb-1 block text-sm text-text-secondary">Amount (₱)</label>
            <input id="edit-record-amount" :value="principal.text.value" :disabled="financialTermsLocked" inputmode="decimal" class="w-full rounded-control border border-control-border px-3 py-2.5 text-base disabled:opacity-60" @input="principal.onInput(($event.target as HTMLInputElement).value)" @blur="principal.onBlur" />
          </div>
          <div>
            <label for="edit-record-daily" class="mb-1 block text-sm text-text-secondary">Daily (₱)</label>
            <input id="edit-record-daily" :value="daily.text.value" :disabled="financialTermsLocked" inputmode="decimal" class="w-full rounded-control border border-control-border px-3 py-2.5 text-base disabled:opacity-60" @input="daily.onInput(($event.target as HTMLInputElement).value)" @blur="daily.onBlur" />
          </div>
          <div class="col-span-2">
            <label for="edit-record-interest" class="mb-1 block text-sm text-text-secondary">Interest (₱)</label>
            <input id="edit-record-interest" :value="interest.text.value" :disabled="financialTermsLocked" inputmode="decimal" class="w-full rounded-control border border-control-border px-3 py-2.5 text-base disabled:opacity-60" @input="interest.onInput(($event.target as HTMLInputElement).value)" @blur="interest.onBlur" />
          </div>
        </div>
      </section>

      <p v-if="dateError" role="alert" class="text-sm text-danger-fg">{{ dateError }}</p>
      <p v-if="submitError" role="alert" class="text-sm text-danger-fg">{{ submitError }}</p>
    </form>

    <template #footer>
      <button type="button" :disabled="submitting" class="press w-full rounded-control bg-primary px-4 py-3 text-sm font-semibold text-white disabled:opacity-60" @click="onSubmit">
        {{ submitting ? 'Saving…' : 'Save changes' }}
      </button>
    </template>
  </AppSheet>
</template>

<script setup lang="ts">
const props = defineProps<{ open: boolean; loan: LoanSummary | null }>()
const emit = defineEmits<{ 'update:open': [boolean]; saved: [] }>()

const displayName = ref('')
const borrowedOn = ref('')
const paymentStartOn = ref('')
const dueOn = ref('')
const principalCentavos = ref<number | null>(null)
const dailyDueCentavos = ref<number | null>(null)
const interestCentavos = ref<number | null>(0)
const principal = useMoneyInput(principalCentavos)
const daily = useMoneyInput(dailyDueCentavos)
const interest = useMoneyInput(interestCentavos)
const original = ref('')
const submitting = ref(false)
const submitError = ref<string | null>(null)
const financialTermsLocked = computed(() => !!props.loan && props.loan.financial_terms_locked === true)
const isDirty = computed(() => !!original.value && original.value !== JSON.stringify(currentValues()))
const dateError = computed(() => {
  if (borrowedOn.value && paymentStartOn.value && paymentStartOn.value < borrowedOn.value) return 'Payment Start must be on or after Date Borrowed.'
  if (paymentStartOn.value && dueOn.value && dueOn.value < paymentStartOn.value) return 'Date Completed must be on or after Payment Start.'
  return null
})

watch(() => [props.open, props.loan?.id] as const, ([open]) => {
  if (!open || !props.loan) return
  displayName.value = props.loan.borrower_display_name
  borrowedOn.value = props.loan.borrowed_on ?? ''
  paymentStartOn.value = props.loan.payment_start_on ?? ''
  dueOn.value = props.loan.due_on ?? ''
  principalCentavos.value = props.loan.principal_centavos
  dailyDueCentavos.value = props.loan.daily_due_centavos
  interestCentavos.value = props.loan.interest_centavos ?? 0
  submitError.value = null
  nextTick(() => { original.value = JSON.stringify(currentValues()) })
}, { immediate: true })

function currentValues() {
  return {
    displayName: displayName.value.trim(), borrowedOn: borrowedOn.value,
    paymentStartOn: paymentStartOn.value, dueOn: dueOn.value,
    principalCentavos: principalCentavos.value, dailyDueCentavos: dailyDueCentavos.value,
    interestCentavos: interestCentavos.value,
  }
}

async function onSubmit() {
  if (!props.loan || submitting.value) return
  submitError.value = null
  if (dateError.value) { submitError.value = dateError.value; return }
  if (principalCentavos.value === null || dailyDueCentavos.value === null || interestCentavos.value === null) {
    submitError.value = 'Enter valid loan amounts.'
    return
  }
  submitting.value = true
  try {
    await $fetch(`/api/loans/${props.loan.id}/details`, {
      method: 'PATCH',
      body: {
        version: props.loan.version,
        borrowerVersion: props.loan.borrower_version,
        ...currentValues(),
      },
    })
    await syncRecordData({ loanId: props.loan.id })
    emit('saved')
    emit('update:open', false)
    useToast().show('Record updated')
  } catch (err: any) {
    submitError.value = err?.data?.statusMessage ?? 'Could not update this record.'
  } finally {
    submitting.value = false
  }
}
</script>
