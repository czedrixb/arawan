<template>
  <AppSheet :open="open" title="Confirm opening balance" @update:open="$emit('update:open', $event)">
    <form class="flex flex-col gap-4" @submit.prevent="onSubmit">
      <p class="text-sm text-text-secondary">
        Record what was already collected on this loan before it moved into ARAWAN, and as of which date. A confirmed
        zero is valid -- leaving it unset keeps the balance unknown.
      </p>
      <div>
        <label for="opening-collected" class="mb-1 block text-sm text-text-secondary">Collected so far (₱)</label>
        <input
          id="opening-collected"
          v-model="collected.text.value"
          type="text"
          inputmode="decimal"
          required
          class="w-full rounded-control border border-control-border px-3 py-2.5 text-base"
          @input="collected.onInput(($event.target as HTMLInputElement).value)"
          @blur="collected.onBlur"
        />
      </div>
      <div>
        <label for="opening-as-of" class="mb-1 block text-sm text-text-secondary">As of</label>
        <input id="opening-as-of" v-model="asOf" type="date" required class="w-full rounded-control border border-control-border px-3 py-2.5 text-base" />
      </div>
      <div>
        <label for="opening-reason" class="mb-1 block text-sm text-text-secondary">Reason / note</label>
        <input id="opening-reason" v-model="reason" type="text" required class="w-full rounded-control border border-control-border px-3 py-2.5 text-base" placeholder="e.g. migrated from workbook" />
      </div>
      <p v-if="submitError" role="alert" class="text-sm text-danger-fg">{{ submitError }}</p>
    </form>
    <template #footer>
      <button type="submit" :disabled="submitting" class="press w-full rounded-control bg-primary px-4 py-3 text-sm font-semibold text-white disabled:opacity-60" @click="onSubmit">
        {{ submitting ? 'Saving…' : 'Confirm balance' }}
      </button>
    </template>
  </AppSheet>
</template>

<script setup lang="ts">
const props = defineProps<{ open: boolean; loanId: string }>()
const emit = defineEmits<{ 'update:open': [boolean] }>()

const collectedCentavos = ref<number | null>(0)
const collected = useMoneyInput(collectedCentavos)
const asOf = ref(todayIso())
const reason = ref('')
const submitting = ref(false)
const submitError = ref<string | null>(null)

async function onSubmit() {
  if (collectedCentavos.value == null) return
  submitting.value = true
  submitError.value = null
  try {
    await confirmOpeningBalance(props.loanId, { collectedCentavos: collectedCentavos.value, asOf: asOf.value, reason: reason.value })
    useToast().show('Opening balance confirmed')
    emit('update:open', false)
  } catch (err: any) {
    submitError.value = err?.data?.statusMessage ?? 'Could not save this opening balance.'
  } finally {
    submitting.value = false
  }
}
</script>
