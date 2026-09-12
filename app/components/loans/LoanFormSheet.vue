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
          <div v-if="selectedBorrower" class="flex items-center justify-between gap-2 rounded-control border border-primary bg-accent-soft px-3 py-2.5 text-sm text-primary">
            <span class="truncate">✓ {{ selectedBorrower.display_name }}</span>
            <button type="button" class="press shrink-0 rounded-control border border-primary/40 px-2 py-1 text-xs font-medium" @click="clearSelectedBorrower">
              Change
            </button>
          </div>
          <template v-else>
            <input
              ref="borrowerInputRef"
              v-model="borrowerQuery"
              type="text"
              placeholder="Search borrowers"
              role="combobox"
              :aria-expanded="listOpen"
              class="w-full rounded-control border border-control-border px-3 py-2.5 text-base"
              @focus="listOpen = true"
            />
            <ul v-if="listOpen && borrowerResults?.length" role="listbox" class="mt-2 max-h-40 overflow-y-auto rounded-control border border-border">
              <li v-for="b in borrowerResults" :key="b.id" role="option" :aria-selected="false">
                <button
                  type="button"
                  class="press flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-surface-subtle focus-visible:bg-surface-subtle"
                  @click="selectBorrower(b)"
                >
                  <span class="truncate">{{ b.display_name }}</span>
                </button>
              </li>
            </ul>
            <p v-else-if="listOpen && borrowerQuery" class="mt-2 text-sm text-text-secondary">No matches.</p>
          </template>
        </div>

        <div v-else class="mt-3 flex flex-col gap-3">
          <input v-model="newBorrower.displayName" type="text" placeholder="Full name" required class="w-full rounded-control border border-control-border px-3 py-2.5 text-base" />
          <input v-model="newBorrower.phone" type="tel" placeholder="Phone (optional)" class="w-full rounded-control border border-control-border px-3 py-2.5 text-base" />
        </div>
      </section>

      <!-- Loan details -->
      <section>
        <h3 class="mb-2 text-sm font-semibold text-text-primary">Loan details</h3>
        <div>
          <label for="loan-principal" class="mb-1 block text-sm text-text-secondary">Principal (₱)</label>
          <input id="loan-principal" :value="principal.text.value" type="text" inputmode="decimal" required class="w-full rounded-control border border-control-border px-3 py-2.5 text-base" @input="onPrincipalInput(($event.target as HTMLInputElement).value)" @blur="principal.onBlur" />
        </div>

        <div class="mt-3 grid grid-cols-2 gap-3">
          <div>
            <div class="mb-1 flex items-center justify-between">
              <label for="loan-interest" class="text-sm text-text-secondary">Interest (₱)</label>
              <button v-if="interestTouched" type="button" class="press text-xs font-medium text-primary" @click="resetInterest">Reset</button>
            </div>
            <input id="loan-interest" :value="interest.text.value" type="text" inputmode="decimal" class="w-full rounded-control border border-control-border px-3 py-2.5 text-base" @input="onInterestInput(($event.target as HTMLInputElement).value)" @blur="interest.onBlur" />
            <p class="mt-1 text-xs text-text-secondary">Auto: 20% of principal</p>
          </div>
          <div>
            <div class="mb-1 flex items-center justify-between">
              <label for="loan-daily-due" class="text-sm text-text-secondary">Daily due (₱)</label>
              <button v-if="dailyTouched" type="button" class="press text-xs font-medium text-primary" @click="resetDaily">Reset</button>
            </div>
            <input id="loan-daily-due" :value="daily.text.value" type="text" inputmode="decimal" required class="w-full rounded-control border border-control-border px-3 py-2.5 text-base" @input="onDailyInput(($event.target as HTMLInputElement).value)" @blur="daily.onBlur" />
            <p class="mt-1 text-xs text-text-secondary">Auto: (principal + interest) ÷ 60</p>
          </div>
        </div>
      </section>

      <!-- Dates -->
      <section>
        <h3 class="mb-2 text-sm font-semibold text-text-primary">Dates</h3>
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label for="loan-borrowed-on" class="mb-1 block text-sm text-text-secondary">Borrowed on</label>
            <input id="loan-borrowed-on" v-model="borrowedOn" type="date" required class="w-full rounded-control border border-control-border px-3 py-2.5 text-base" />
          </div>
          <div>
            <label for="loan-payment-start" class="mb-1 block text-sm text-text-secondary">Payment start</label>
            <input id="loan-payment-start" v-model="paymentStartOn" type="date" required class="w-full rounded-control border border-control-border px-3 py-2.5 text-base" @input="paymentStartTouched = true" />
            <p class="mt-1 text-xs text-text-secondary">Auto: day after borrowed on</p>
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
          <label for="loan-due-on" class="mb-1 block text-sm text-text-secondary">Due date</label>
          <input id="loan-due-on" v-model="dueOn" type="date" required class="w-full rounded-control border border-control-border px-3 py-2.5 text-base" @input="dueOnTouched = true" />
          <p class="mt-1 text-xs text-text-secondary">Auto: 60th collection day from payment start</p>
        </div>
      </section>

      <!-- Review -->
      <section class="rounded-control bg-surface-subtle p-4 text-sm">
        <h3 class="mb-2 font-semibold text-text-primary">Preview</h3>
        <dl class="grid grid-cols-2 gap-y-1">
          <dt class="text-text-secondary">Total payable</dt>
          <dd class="text-right tabular-money">{{ formatCentavos(preview.totalPayableCentavos) }}</dd>
          <dt class="text-text-secondary">Term</dt>
          <dd class="text-right">60 days</dd>
          <dt class="text-text-secondary">Installments</dt>
          <dd class="text-right">{{ preview.installmentCount }}</dd>
          <dt class="text-text-secondary">Final installment</dt>
          <dd class="text-right tabular-money">{{ formatCentavos(preview.finalInstallmentCentavos) }}</dd>
          <dt class="text-text-secondary">Due date</dt>
          <dd class="text-right">{{ formatDateDisplay(preview.proposedDueOn) }}</dd>
        </dl>
        <p v-if="dailyUndershoots" class="mt-2 text-xs text-danger-fg">60 payments won't cover the total — raise the daily due.</p>
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
const borrowerInputRef = ref<HTMLInputElement | null>(null)
const listOpen = ref(false)
const selectedBorrower = ref<Borrower | null>(null)
const newBorrower = reactive({ displayName: '', phone: '' })

const { data: borrowerResults, execute: fetchBorrowers } = useCachedFetch<Borrower[]>('/api/borrowers', {
  query: { q: borrowerQuery },
  key: () => `borrowers:${borrowerQuery.value}`,
  immediate: false,
})
// Manual debounce (spec §2 point 6: search updates after ~250ms) -- a single
// timer drives the one fetch (a prior version fired both an immediate
// `watch`-triggered request and a second debounced one per keystroke pause).
let borrowerSearchTimer: ReturnType<typeof setTimeout> | undefined
watch(borrowerQuery, () => {
  clearTimeout(borrowerSearchTimer)
  borrowerSearchTimer = setTimeout(() => refreshNuxtData(`borrowers:${borrowerQuery.value}`), 250)
})

function selectBorrower(b: Borrower) {
  selectedBorrower.value = b
  borrowerQuery.value = b.display_name
  listOpen.value = false
}
function clearSelectedBorrower() {
  selectedBorrower.value = null
  borrowerQuery.value = ''
  listOpen.value = true
  nextTick(() => borrowerInputRef.value?.focus())
}

const principalCentavos = ref<number | null>(null)
const dailyDueCentavos = ref<number | null>(null)
const interestCentavosModel = ref<number | null>(0)
const principal = useMoneyInput(principalCentavos)
const daily = useMoneyInput(dailyDueCentavos)
const interest = useMoneyInput(interestCentavosModel)

// Every new loan carries the house's standard terms: 20% interest, a fixed
// 60-day term. Interest and daily due auto-fill from those terms until the
// user overrides them; the mode is always 'added' unless interest is zeroed
// (see onSubmit -- loanInputSchema requires interestCentavos > 0 for 'added').
const interestTouched = ref(false)
const dailyTouched = ref(false)

function onPrincipalInput(value: string) {
  principal.onInput(value)
  if (!interestTouched.value) interestCentavosModel.value = computeStandardInterest(principalCentavos.value ?? 0)
  if (!dailyTouched.value) dailyDueCentavos.value = computeStandardDailyDue(computeTotalPayable({
    principalCentavos: principalCentavos.value ?? 0,
    interestMode: 'added',
    interestCentavos: interestCentavosModel.value ?? 0,
  }))
}
function onInterestInput(value: string) {
  interestTouched.value = true
  interest.onInput(value)
  if (!dailyTouched.value) dailyDueCentavos.value = computeStandardDailyDue(computeTotalPayable({
    principalCentavos: principalCentavos.value ?? 0,
    interestMode: 'added',
    interestCentavos: interestCentavosModel.value ?? 0,
  }))
}
function onDailyInput(value: string) {
  dailyTouched.value = true
  daily.onInput(value)
}
function resetInterest() {
  interestTouched.value = false
  interestCentavosModel.value = computeStandardInterest(principalCentavos.value ?? 0)
  if (!dailyTouched.value) dailyDueCentavos.value = computeStandardDailyDue(computeTotalPayable({
    principalCentavos: principalCentavos.value ?? 0,
    interestMode: 'added',
    interestCentavos: interestCentavosModel.value ?? 0,
  }))
}
function resetDaily() {
  dailyTouched.value = false
  dailyDueCentavos.value = computeStandardDailyDue(computeTotalPayable({
    principalCentavos: principalCentavos.value ?? 0,
    interestMode: 'added',
    interestCentavos: interestCentavosModel.value ?? 0,
  }))
}

const borrowedOn = ref(todayIso())
const paymentStartOn = ref(addDaysIso(todayIso(), 1))
const paymentStartTouched = ref(false)
const dueOn = ref(todayIso())
const dueOnTouched = ref(false)
watch(borrowedOn, (v) => {
  if (!paymentStartTouched.value) paymentStartOn.value = addDaysIso(v, 1)
})

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
    interestMode: 'added',
    interestCentavos: interestCentavosModel.value ?? 0,
    paymentStartOn: paymentStartOn.value,
    collectionWeekdays: collectionWeekdays.value.length ? collectionWeekdays.value : [1, 2, 3, 4, 5, 6, 7],
  }),
)
watch(preview, (p) => {
  if (!dueOnTouched.value) dueOn.value = p.proposedDueOn
})
const dailyUndershoots = computed(() => (dailyDueCentavos.value ?? 0) * 60 < preview.value.totalPayableCentavos)

const isDirty = computed(
  () =>
    !!newBorrower.displayName ||
    !!selectedBorrower.value ||
    !!principalCentavos.value ||
    !!dailyDueCentavos.value,
)

const submitting = ref(false)
const submitError = ref<string | null>(null)
const toast = useToast()

/** Restores every field to the standard-terms defaults each time the sheet opens. */
watch(
  () => props.open,
  (open) => {
    if (!open) return
    borrowerMode.value = 'existing'
    borrowerQuery.value = ''
    selectedBorrower.value = null
    listOpen.value = true
    newBorrower.displayName = ''
    newBorrower.phone = ''
    principalCentavos.value = null
    dailyDueCentavos.value = null
    interestCentavosModel.value = 0
    interestTouched.value = false
    dailyTouched.value = false
    const today = todayIso()
    borrowedOn.value = today
    paymentStartOn.value = addDaysIso(today, 1)
    paymentStartTouched.value = false
    collectionWeekdays.value = [1, 2, 3, 4, 5, 6, 7]
    dueOnTouched.value = false
    dueOn.value = preview.value.proposedDueOn // reflects the refs just reset, above
    submitError.value = null
    fetchBorrowers()
  },
)

async function onSubmit() {
  submitError.value = null
  const borrower =
    borrowerMode.value === 'existing'
      ? selectedBorrower.value
        ? { borrowerId: selectedBorrower.value.id }
        : null
      : { newBorrower: { displayName: newBorrower.displayName, phone: newBorrower.phone || null } }
  if (!borrower) {
    submitError.value = 'Select a borrower or enter a new one.'
    return
  }
  submitting.value = true
  try {
    const interestCentavos = interestCentavosModel.value ?? 0
    await createLoan({
      borrower,
      principalCentavos: principalCentavos.value,
      dailyDueCentavos: dailyDueCentavos.value,
      interestMode: interestCentavos > 0 ? 'added' : 'none',
      interestCentavos,
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
