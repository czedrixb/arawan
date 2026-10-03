<template>
  <AppSheet v-model:open="openModel" title="Renew loan">
    <form data-testid="renewal-sheet-content" class="flex flex-col gap-5" @submit.prevent="submit">
      <MoneyField v-model="renewalPrincipal" label="Renewal principal" testid="renew-principal" />

      <section data-testid="renewal-calculation" class="rounded-control border border-primary/30 bg-accent-soft p-4 text-sm">
        <h3 class="mb-2 font-semibold">Renewal calculation</h3>
        <dl class="grid grid-cols-2 gap-y-2">
          <dt class="text-text-secondary">Old outstanding balance</dt><dd class="text-right"><MoneyText :centavos="adjustedOutstanding" /></dd>
          <dt class="text-text-secondary">Renewal principal</dt><dd class="text-right"><MoneyText :centavos="renewalPrincipal" /></dd>
          <dt class="border-t border-primary/20 pt-2 font-semibold">Cash released</dt><dd class="border-t border-primary/20 pt-2 text-right font-semibold"><MoneyText :centavos="cashReleased" /></dd>
        </dl>
        <p v-if="principalTooLow" data-testid="renew-principal-error" role="alert" class="mt-3 text-sm text-danger-fg">Renewal principal must be at least the adjusted outstanding balance of {{ formatCentavos(adjustedOutstanding) }}.</p>
      </section>

      <section class="rounded-control border border-control-border">
        <button type="button" data-testid="renew-adjust-toggle" class="flex w-full items-center justify-between px-4 py-3 text-left text-sm font-semibold" :aria-expanded="showAdjustments" @click="showAdjustments = !showAdjustments">
          <span>Adjust old balance and terms</span><span aria-hidden="true" class="text-text-secondary">{{ showAdjustments ? '−' : '+' }}</span>
        </button>
        <div v-if="showAdjustments" data-testid="renew-adjustments" class="flex flex-col gap-4 border-t border-control-border p-4">
          <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <MoneyField v-model="renewalPayment" label="Payment collected during renewal" testid="renew-payment" />
            <MoneyField v-model="waivedInterest" label="Interest waived" testid="renew-waiver" />
          </div>
          <p class="text-xs text-text-secondary">Blank amounts count as {{ formatCentavos(0) }}. Unpaid interest stays in the outstanding balance.</p>
          <label v-if="waivedInterest > 0" class="text-sm text-text-secondary">Waiver note
            <textarea v-model="waiverNote" data-testid="renew-waiver-note" required class="mt-1 w-full rounded-control border border-control-border px-3 py-2.5 text-base" />
          </label>
          <label class="text-sm text-text-secondary">Effective date
            <input v-model="effectiveOn" data-testid="renew-effective-on" type="date" :min="loan.borrowed_on || undefined" :max="todayIso()" required class="mt-1 w-full rounded-control border border-control-border px-3 py-2.5 text-base" />
          </label>
          <div>
            <p class="mb-2 text-sm font-semibold">Terms</p>
            <div class="grid grid-cols-2 gap-2">
              <button type="button" data-testid="renew-standard-term" class="rounded-control border px-3 py-2 text-sm" :class="newTerm === 'standard' ? selected : ''" :aria-pressed="newTerm === 'standard'" @click="newTerm='standard'">Standard 20%</button>
              <button type="button" data-testid="renew-no-interest-term" class="rounded-control border px-3 py-2 text-sm" :class="newTerm === 'none' ? selected : ''" :aria-pressed="newTerm === 'none'" @click="newTerm='none'">No interest</button>
            </div>
          </div>
          <label v-if="newTerm === 'none'" class="block text-sm text-text-secondary">No-interest due date
            <input v-model="noInterestDueOn" data-testid="renew-due-on" type="date" :min="effectiveOn" required class="mt-1 w-full rounded-control border border-control-border px-3 py-2.5 text-base" />
          </label>
          <div>
            <p class="mb-2 text-sm text-text-secondary">Collection days</p>
            <div class="flex gap-1">
              <button v-for="d in days" :key="d.value" type="button" :data-testid="`renew-weekday-${d.value}`" class="h-9 w-9 rounded-full border text-xs" :class="weekdays.includes(d.value) ? 'border-primary bg-primary text-white' : 'border-control-border'" :aria-pressed="weekdays.includes(d.value)" @click="toggleDay(d.value)">{{ d.label }}</button>
            </div>
          </div>
        </div>
      </section>

      <section class="rounded-control bg-surface-subtle p-4 text-sm">
        <h3 class="font-semibold">What happens next</h3>
        <p class="mt-1 text-text-secondary">The old loan will close and a new loan for {{ formatCentavos(renewalPrincipal) }} will be created with {{ termSummary }}.</p>
      </section>
      <p v-if="error" role="alert" class="text-sm text-danger-fg">{{ error }}</p>
    </form>
    <template #footer>
      <button data-testid="confirm-renewal" type="button" :disabled="submitting || renewalPrincipal <= 0 || principalTooLow || weekdays.length === 0" class="w-full rounded-control bg-primary px-4 py-3 text-sm font-semibold text-white disabled:opacity-50" @click="submit">{{ submitting ? 'Renewing…' : 'Close old loan and create renewal' }}</button>
    </template>
  </AppSheet>
</template>

<script setup lang="ts">
const props = defineProps<{ open: boolean; loan: LoanSummary }>()
const emit = defineEmits<{ 'update:open': [boolean] }>()
const route = useRoute()
const openModel = computed({ get: () => props.open, set: v => emit('update:open', v) })
const effectiveOn = ref(todayIso())
const renewalPrincipal = ref(0), renewalPayment = ref(0), waivedInterest = ref(0)
const waiverNote = ref(''), newTerm = ref<'standard'|'none'>('standard'), noInterestDueOn = ref(todayIso())
const weekdays = ref<number[]>([]), showAdjustments = ref(false), submitting = ref(false), error = ref('')
const selected = 'border-primary bg-accent-soft text-primary'
const days = [{value:1,label:'M'},{value:2,label:'T'},{value:3,label:'W'},{value:4,label:'T'},{value:5,label:'F'},{value:6,label:'S'},{value:7,label:'S'}]
const oldInterest = computed(() => props.loan.interest_centavos ?? 0)
const oldPrincipal = computed(() => props.loan.interest_mode === 'included' ? (props.loan.principal_centavos ?? 0)-oldInterest.value : (props.loan.principal_centavos ?? 0))
const collected = computed(() => props.loan.recognized_collected_centavos ?? 0)
const unpaidInterest = computed(() => Math.max(oldInterest.value-collected.value,0))
const remainingPrincipal = computed(() => Math.max(oldPrincipal.value-Math.max(collected.value-oldInterest.value,0),0))
const paymentToInterest = computed(() => Math.min(renewalPayment.value,unpaidInterest.value))
const paymentToPrincipal = computed(() => Math.max(renewalPayment.value-paymentToInterest.value,0))
const postPaymentInterest = computed(() => Math.max(unpaidInterest.value-paymentToInterest.value,0))
const effectiveWaiver = computed(() => Math.min(waivedInterest.value,postPaymentInterest.value))
const capitalizedInterest = computed(() => postPaymentInterest.value-effectiveWaiver.value)
const carriedPrincipal = computed(() => Math.max(remainingPrincipal.value-paymentToPrincipal.value,0))
const adjustedOutstanding = computed(() => carriedPrincipal.value+capitalizedInterest.value)
const principalTooLow = computed(() => renewalPrincipal.value > 0 && renewalPrincipal.value < adjustedOutstanding.value)
const cashReleased = computed(() => Math.max(renewalPrincipal.value-adjustedOutstanding.value,0))
const termSummary = computed(() => newTerm.value === 'standard' ? 'standard 20% / 60-payment terms' : 'no-interest terms')
function toggleDay(day:number){ weekdays.value=weekdays.value.includes(day)?weekdays.value.filter(d=>d!==day):[...weekdays.value,day].sort() }
function resetForm(){
  effectiveOn.value=todayIso(); noInterestDueOn.value=todayIso()
  renewalPrincipal.value=renewalPayment.value=waivedInterest.value=0
  waiverNote.value=''; newTerm.value='standard'
  weekdays.value=[...(props.loan.collection_weekdays ?? [1,2,3,4,5,6,7])]
  showAdjustments.value=false; error.value=''
}
watch(() => props.open, open => { if(open) resetForm() }, { immediate: true })
async function submit(){
  if (renewalPrincipal.value < adjustedOutstanding.value) { error.value=`Renewal principal must be at least ${formatCentavos(adjustedOutstanding.value)}.`; return }
  error.value=''; submitting.value=true
  try {
    const result:any = await renewLoan(props.loan.id,{ version:props.loan.version,idempotencyKey:crypto.randomUUID(),effectiveOn:effectiveOn.value,renewalPaymentCentavos:renewalPayment.value,waivedInterestCentavos:waivedInterest.value,waiverNote:waiverNote.value||null,additionalCashCentavos:cashReleased.value,collectionWeekdays:weekdays.value,newTerm:newTerm.value,noInterestDueOn:newTerm.value==='none'?noInterestDueOn.value:null })
    emit('update:open',false); useToast().show('Loan renewed'); await navigateTo({ path: `/records/${result.newLoan.id}`, query: route.query })
  } catch(e:any){ error.value=e?.data?.statusMessage ?? 'Could not renew this loan.' } finally { submitting.value=false }
}
</script>
