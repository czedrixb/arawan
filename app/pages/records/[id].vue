<template>
  <div>
    <!-- Mobile: full-screen scrim. Desktop: no scrim -- the list stays visible and usable beside the drawer. -->
    <div class="fixed inset-0 z-40 bg-black/20 lg:hidden" @click="close" />
    <div
      class="safe-top safe-bottom fixed inset-0 z-50 flex flex-col bg-surface lg:inset-y-0 lg:left-auto lg:right-0 lg:w-[460px] lg:border-l lg:border-border lg:shadow-overlay"
    >
      <AppSkeleton v-if="pending && !data" variant="card" />
      <ErrorState v-else-if="error" @retry="refresh()" />
      <template v-else-if="data">
        <div class="flex items-center justify-between border-b border-border px-5 py-4">
          <div class="min-w-0">
            <NameEditor :loan="data.loan" />
            <StatusPill :status="data.loan.display_status" class="mt-1" />
          </div>
          <div class="flex items-center gap-1">
            <button type="button" class="press rounded-full p-2 text-text-secondary hover:bg-surface-subtle" aria-label="More actions" @click="menuOpen = !menuOpen">
              <PhDotsThreeVertical :size="20" weight="bold" />
            </button>
            <button type="button" class="press rounded-full p-2 text-text-secondary hover:bg-surface-subtle" aria-label="Close" @click="close">
              <PhX :size="20" />
            </button>
          </div>
        </div>

        <div v-if="menuOpen" class="border-b border-border px-5 py-2">
          <button type="button" class="press block w-full py-2 text-left text-sm text-text-primary" @click="onArchiveToggle">
            {{ data.loan.archived_at ? 'Restore' : 'Archive' }}
          </button>
          <button v-if="data.loan.readiness === 'needs_review'" type="button" class="press block w-full py-2 text-left text-sm text-text-primary" @click="openingOpen = true">
            Confirm opening balance
          </button>
        </div>

        <div class="flex border-b border-border px-5" role="tablist">
          <button
            v-for="t in tabs"
            :key="t"
            type="button"
            role="tab"
            :aria-selected="tab === t"
            class="press border-b-2 px-3 py-3 text-sm font-medium"
            :class="tab === t ? 'border-primary text-primary' : 'border-transparent text-text-secondary'"
            @click="tab = t"
          >
            {{ t }}
          </button>
        </div>

        <div class="flex-1 overflow-y-auto px-5 py-4">
          <div v-if="tab === 'Loan details'" class="flex flex-col gap-4">
            <div v-if="data.loan.readiness === 'needs_review'" class="rounded-control bg-warning-bg p-4 text-sm text-warning-fg">
              This loan's terms or opening balance still need review. Financial totals are hidden until resolved.
            </div>
            <dl class="grid grid-cols-2 gap-y-3 text-sm">
              <dt class="text-text-secondary">Principal</dt>
              <dd class="text-right tabular-money"><MoneyText :centavos="data.loan.principal_centavos" /></dd>
              <dt class="text-text-secondary">Total payable</dt>
              <dd class="text-right tabular-money"><MoneyText :centavos="data.loan.total_payable_centavos" /></dd>
              <dt class="text-text-secondary">Daily due</dt>
              <dd class="text-right tabular-money"><MoneyText :centavos="data.loan.daily_due_centavos" /></dd>
              <dt class="text-text-secondary">Collected</dt>
              <dd class="text-right tabular-money"><MoneyText :centavos="data.loan.recognized_collected_centavos" /></dd>
              <dt class="text-text-secondary">Remaining</dt>
              <dd class="text-right tabular-money"><MoneyText :centavos="data.loan.remaining_centavos" /></dd>
              <dt class="text-text-secondary">Borrowed</dt>
              <dd class="text-right">{{ formatDateDisplay(data.loan.borrowed_on) }}</dd>
              <dt class="text-text-secondary">Payment start</dt>
              <dd class="text-right">{{ formatDateDisplay(data.loan.payment_start_on) }}</dd>
              <dt class="text-text-secondary">Due</dt>
              <dd class="text-right">{{ formatDateDisplay(data.loan.due_on) }}</dd>
            </dl>
            <div>
              <p class="mb-1 text-sm text-text-secondary">Progress</p>
              <ProgressBar :pct="data.loan.progress_pct" />
            </div>

            <div v-if="data.loan.legacy_percent_value != null || data.loan.legacy_completed_on" class="rounded-control bg-surface-subtle p-4 text-sm">
              <p class="mb-1 font-semibold text-text-primary">Source (legacy) values</p>
              <p v-if="data.loan.legacy_percent_value != null" class="text-text-secondary">"%" column: {{ data.loan.legacy_percent_value }} (meaning not yet resolved)</p>
              <p v-if="data.loan.legacy_completed_on" class="text-text-secondary">DATE COMPLETED: {{ formatDateDisplay(data.loan.legacy_completed_on) }}</p>
            </div>

            <div v-if="otherLoans.length" class="mt-2">
              <p class="mb-2 text-sm font-semibold text-text-primary">Other loans by {{ data.loan.borrower_display_name }}</p>
              <ul class="flex flex-col gap-2">
                <li v-for="other in otherLoans" :key="other.id">
                  <NuxtLink :to="`/records/${other.id}`" class="press flex items-center justify-between rounded-control border border-border px-3 py-2 text-sm">
                    <span>{{ formatDateDisplay(other.borrowed_on) }}</span>
                    <MoneyText :centavos="other.remaining_centavos" />
                    <StatusPill :status="other.display_status" />
                  </NuxtLink>
                </li>
              </ul>
            </div>
          </div>

          <div v-else>
            <PaymentLedger :loan-id="id" @reverse="onReverse" />
          </div>
        </div>

        <div v-if="data.loan.remaining_centavos != null && data.loan.remaining_centavos > 0" class="safe-bottom border-t border-border px-5 py-4">
          <button type="button" class="press w-full rounded-control bg-primary px-4 py-3 text-sm font-semibold text-white" @click="paymentOpen = true">
            Record payment
          </button>
        </div>
      </template>
    </div>

    <PaymentFormSheet v-if="data" :open="paymentOpen" :loan="data.loan" @update:open="paymentOpen = $event" />
    <OpeningBalanceForm v-if="data" :open="openingOpen" :loan-id="id" @update:open="openingOpen = $event" />
    <ReversalDialog v-if="reversingPayment" :open="!!reversingPayment" :loan-id="id" :payment="reversingPayment" @update:open="(v: boolean) => !v && (reversingPayment = null)" />
  </div>
</template>

<script setup lang="ts">
import { PhDotsThreeVertical, PhX } from '@phosphor-icons/vue'

const route = useRoute()
const id = computed(() => route.params.id as string)
const { data, pending, error, refresh } = useLoan(id)
const otherLoans = computed(() => data.value?.otherLoans ?? [])

const tab = ref<'Loan details' | 'Payments'>('Loan details')
const tabs = ['Loan details', 'Payments'] as const
const menuOpen = ref(false)
const paymentOpen = ref(false)
const openingOpen = ref(false)
const reversingPayment = ref<any>(null)

function close() {
  // Browser Back closes it (spec §5) -- go back if we navigated here
  // within the app, otherwise fall back to the records list directly.
  if (window.history.state?.back?.startsWith?.('/records')) router.back()
  else navigateTo('/records')
}
const router = useRouter()

function onReverse(entry: any) {
  reversingPayment.value = entry
}

async function onArchiveToggle() {
  menuOpen.value = false
  const loan = data.value!.loan
  const confirm = useConfirm()
  const ok = await confirm({
    title: loan.archived_at ? 'Restore this loan?' : 'Archive this loan?',
    message: loan.archived_at
      ? 'It will reappear in active Records.'
      : 'Archiving hides it from the default Records view. History is retained -- this does not mean it is repaid.',
  })
  if (!ok) return
  await setLoanArchived(loan.id, !loan.archived_at, loan.version)
  await refresh()
}
</script>
