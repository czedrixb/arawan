<template>
  <AppSheet v-model:open="openModel" title="Add loan" :is-dirty="isDirty">
    <form class="flex flex-col gap-6" @submit.prevent="onSubmit">
      <!-- Borrower -->
      <section>
        <h3 class="mb-2 text-sm font-semibold text-text-primary">Borrower</h3>
        <div class="flex gap-2">
          <button type="button" class="press flex-1 rounded-control border px-3 py-2 text-sm" :class="borrowerMode === 'existing' ? 'border-primary bg-accent-soft text-primary' : 'border-control-border'" @click="borrowerMode = 'existing'">
            Existing borrower
          </button>
          <button type="button" class="press flex-1 rounded-control border px-3 py-2 text-sm" :class="borrowerMode === 'new' ? 'border-primary bg-accent-soft text-primary' : 'border-control-border'" @click="borrowerMode = 'new'">
            New borrower
          </button>
        </div>

        <div v-if="borrowerMode === 'existing'" class="mt-3">
          <input
            v-model="borrowerQuery"
            type="text"
            placeholder="Search borrowers"
            class="w-full rounded-control border border-control-border px-3 py-2.5 text-base"
          />
          <ul v-if="borrowerResults?.length" class="mt-2 max-h-40 overflow-y-auto rounded-control border border-border">
            <li v-for="b in borrowerResults" :key="b.id">
              <button
                type="button"
                class="press w-full px-3 py-2 text-left text-sm hover:bg-surface-subtle"
                :class="{ 'bg-accent-soft': selectedBorrowerId === b.id }"
                @click="selectedBorrowerId = b.id"
              >
                {{ b.display_name }}
              </button>
            </li>
          </ul>
          <p v-else-if="borrowerQuery" class="mt-2 text-sm text-text-secondary">No matches.</p>
        </div>

        <div v-else class="mt-3 flex flex-col gap-3">
          <input v-model="newBorrower.displayName" type="text" placeholder="Full name" required class="w-full rounded-control border border-control-border px-3 py-2.5 text-base" />
          <input v-model="newBorrower.phone" type="tel" placeholder="Phone (optional)" class="w-full rounded-control border border-control-border px-3 py-2.5 text-base" />
        </div>
      </section>

      <!-- Loan details -->
      <section>
        <h3 class="mb-2 text-sm font-semibold text-text-primary">Loan details</h3>
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="mb-1 block text-sm text-text-secondary">Principal (₱)</label>
            <input v-model="principal.text.value" type="text" inputmode="decimal" required class="w-full rounded-control border border-control-border px-3 py-2.5 text-base" @input="principal.onInput(($event.target as HTMLInputElement).value)" @blur="principal.onBlur" />
          </div>
          <div>
            <label class="mb-1 block text-sm text-text-secondary">Daily due (₱)</label>
            <input v-model="daily.text.value" type="text" inputmode="decimal" required class="w-full rounded-control border border-control-border px-3 py-2.5 text-base" @input="daily.onInput(($event.target as HTMLInputElement).value)" @blur="daily.onBlur" />
          </div>
        </div>

        <label class="mb-1 mt-3 block text-sm text-text-secondary">Interest</label>
        <div class="flex flex-col gap-2">
          <label v-for="mode in interestModes" :key="mode.value" class="flex items-center gap-2 text-sm">
            <input v-model="interestMode" type="radio" name="interest-mode" :value="mode.value" />
            {{ mode.label }}
          </label>
        </div>
        <div v-if="interestMode === 'added'" class="mt-2">
          <label class="mb-1 block text-sm text-text-secondary">Fixed interest (₱)</label>
          <input v-model="interest.text.value" type="text" inputmode="decimal" class="w-full rounded-control border border-control-border px-3 py-2.5 text-base" @input="interest.onInput(($event.target as HTMLInputElement).value)" @blur="interest.onBlur" />
        </div>
      </section>

      <!-- Dates -->
      <section>
        <h3 class="mb-2 text-sm font-semibold text-text-primary">Dates</h3>
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="mb-1 block text-sm text-text-secondary">Borrowed on</label>
            <input v-model="borrowedOn" type="date" required class="w-full rounded-control border border-control-border px-3 py-2.5 text-base" />
          </div>
          <div>
            <label class="mb-1 block text-sm text-text-secondary">Payment start</label>
            <input v-model="paymentStartOn" type="date" required class="w-full rounded-control border border-control-border px-3 py-2.5 text-base" />
          </div>
        </div>
        <label class="mb-1 mt-3 block text-sm text-text-secondary">Collection days</label>
        <div class="flex gap-1">
          <button
            v-for="d in weekdayLabels"
            :key="d.value"
            type="button"
            class="press h-9 w-9 rounded-full border text-xs"
            :class="collectionWeekdays.includes(d.value) ? 'border-primary bg-primary text-white' : 'border-control-border'"
            @click="toggleWeekday(d.value)"
          >
            {{ d.label }}
          </button>
        </div>
        <div class="mt-3">
          <label class="mb-1 block text-sm text-text-secondary">Due date</label>
          <input v-model="dueOn" type="date" required class="w-full rounded-control border border-control-border px-3 py-2.5 text-base" @input="dueOnTouched = true" />
        </div>
      </section>

      <!-- Review -->
      <section class="rounded-control bg-surface-subtle p-4 text-sm">
        <h3 class="mb-2 font-semibold text-text-primary">Preview</h3>
        <dl class="grid grid-cols-2 gap-y-1">
          <dt class="text-text-secondary">Total payable</dt>
          <dd class="text-right tabular-money">{{ formatCentavos(preview.totalPayableCentavos) }}</dd>
          <dt class="text-text-secondary">Installments</dt>
          <dd class="text-right">{{ preview.installmentCount }}</dd>
          <dt class="text-text-secondary">Final installment</dt>
          <dd class="text-right tabular-money">{{ formatCentavos(preview.finalInstallmentCentavos) }}</dd>
        </dl>
      </section>

      <p v-if="submitError" role="alert" class="text-sm text-danger-fg">{{ submitError }}</p>
    </form>

    <template #footer>
      <button type="submit" :disabled="submitting" class="press w-full rounded-control bg-primary px-4 py-3 text-sm font-semibold text-white disabled:opacity-60" @click="onSubmit">
        {{ submitting ? 'Saving…' : 'Save loan' }}
      </button>
    </template>
  </AppSheet>
</template>

<script setup lang="ts">
const props = defineProps<{ open: boolean }>()
const emit = defineEmits<{ 'update:open': [boolean]; created: [] }>()
const openModel = computed({ get: () => props.open, set: (v) => emit('update:open', v) })

const borrowerMode = ref<'existing' | 'new'>('existing')
const borrowerQuery = ref('')
const selectedBorrowerId = ref<string | null>(null)
const newBorrower = reactive({ displayName: '', phone: '' })

const { data: borrowerResults } = useCachedFetch<Borrower[]>('/api/borrowers', {
  query: { q: borrowerQuery },
  watch: [borrowerQuery],
  key: () => `borrowers:${borrowerQuery.value}`,
  immediate: false,
})
// Manual debounce (spec §2 point 6: search updates after ~250ms) -- no
// VueUse dependency needed for one call site.
let borrowerSearchTimer: ReturnType<typeof setTimeout> | undefined
watch(borrowerQuery, (q) => {
  clearTimeout(borrowerSearchTimer)
  if (!q) return
  borrowerSearchTimer = setTimeout(() => refreshNuxtData(`borrowers:${q}`), 250)
})

const principalCentavos = ref<number | null>(null)
const dailyDueCentavos = ref<number | null>(null)
const interestCentavosModel = ref<number | null>(0)
const principal = useMoneyInput(principalCentavos)
const daily = useMoneyInput(dailyDueCentavos)
const interest = useMoneyInput(interestCentavosModel)

const interestMode = ref<'none' | 'added' | 'included'>('none')
const interestModes = [
  { value: 'none', label: 'No interest' },
  { value: 'added', label: 'Fixed interest, added to principal' },
  { value: 'included', label: 'Interest already included in the total' },
] as const

const today = todayIso()
const borrowedOn = ref(today)
const paymentStartOn = ref(today)
const dueOn = ref(today)
const dueOnTouched = ref(false)
const collectionWeekdays = ref<number[]>([1, 2, 3, 4, 5, 6, 7])
const weekdayLabels = [
  { value: 1, label: 'M' },
  { value: 2, label: 'T' },
  { value: 3, label: 'W' },
  { value: 4, label: 'T' },
  { value: 5, label: 'F' },
  { value: 6, label: 'S' },
  { value: 7, label: 'S' },
]
function toggleWeekday(day: number) {
  collectionWeekdays.value = collectionWeekdays.value.includes(day)
    ? collectionWeekdays.value.filter((d) => d !== day)
    : [...collectionWeekdays.value, day].sort()
}

const preview = computed(() =>
  previewSchedule({
    principalCentavos: principalCentavos.value ?? 0,
    dailyDueCentavos: dailyDueCentavos.value ?? 1,
    interestMode: interestMode.value,
    interestCentavos: interestCentavosModel.value ?? 0,
    paymentStartOn: paymentStartOn.value,
    collectionWeekdays: collectionWeekdays.value.length ? collectionWeekdays.value : [1, 2, 3, 4, 5, 6, 7],
  }),
)
watch(preview, (p) => {
  if (!dueOnTouched.value) dueOn.value = p.proposedDueOn
})

const isDirty = computed(
  () =>
    !!newBorrower.displayName ||
    !!selectedBorrowerId.value ||
    !!principalCentavos.value ||
    !!dailyDueCentavos.value,
)

const submitting = ref(false)
const submitError = ref<string | null>(null)
const toast = useToast()

async function onSubmit() {
  submitError.value = null
  const borrower =
    borrowerMode.value === 'existing'
      ? selectedBorrowerId.value
        ? { borrowerId: selectedBorrowerId.value }
        : null
      : { newBorrower: { displayName: newBorrower.displayName, phone: newBorrower.phone || null } }
  if (!borrower) {
    submitError.value = 'Select a borrower or enter a new one.'
    return
  }
  submitting.value = true
  try {
    await createLoan({
      borrower,
      principalCentavos: principalCentavos.value,
      dailyDueCentavos: dailyDueCentavos.value,
      interestMode: interestMode.value,
      interestCentavos: interestCentavosModel.value ?? 0,
      borrowedOn: borrowedOn.value,
      paymentStartOn: paymentStartOn.value,
      dueOn: dueOn.value,
      collectionWeekdays: collectionWeekdays.value,
    })
    toast.show('Loan created')
    emit('created')
  } catch (err: any) {
    submitError.value = err?.data?.statusMessage ?? 'Could not save this loan.'
  } finally {
    submitting.value = false
  }
}
</script>
