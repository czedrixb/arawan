<template>
  <div>
    <PageHeader title="Records">
      <template #actions>
        <div class="hidden gap-2 lg:flex">
          <button type="button" class="press rounded-control border border-control-border px-3 py-2 text-sm" @click="onExport">Export</button>
          <button type="button" class="press rounded-control bg-primary px-4 py-2 text-sm font-semibold text-white" @click="addOpen = true">+ Add loan</button>
        </div>
      </template>
    </PageHeader>

    <div class="mt-4 flex items-center gap-2 px-4 lg:px-8">
      <div class="relative flex-1">
        <input
          v-model="searchInput"
          type="search"
          placeholder="Search records"
          class="w-full rounded-control border border-control-border px-3 py-2.5 text-base"
          @input="onSearchInput"
        />
      </div>
      <button type="button" class="press flex items-center gap-1 rounded-control border border-control-border px-3 py-2.5 text-sm" @click="filterOpen = true">
        Filter <span v-if="activeFilterCount">({{ activeFilterCount }})</span>
      </button>
      <button type="button" class="press rounded-control bg-primary px-4 py-2.5 text-sm font-semibold text-white lg:hidden" @click="addOpen = true">+ Add</button>
    </div>

    <div class="mt-3 flex gap-2 px-4 lg:hidden">
      <button
        v-for="s in mobileSegments"
        :key="s.value"
        type="button"
        class="press rounded-full border px-3 py-1.5 text-xs"
        :class="filters.status === s.value ? 'border-primary bg-accent-soft text-primary' : 'border-control-border'"
        @click="update({ status: s.value })"
      >
        {{ s.label }}
      </button>
    </div>

    <div class="mt-4 px-4 lg:px-8">
      <AppSkeleton v-if="pending && !data" variant="list" :rows="6" />
      <ErrorState v-else-if="error" @retry="refresh()" />
      <template v-else-if="data">
        <EmptyState
          v-if="data.rows.length === 0 && hasActiveSearchOrFilter"
          message="No records match these filters."
          action-label="Clear filters"
          @action="clearFilters"
        />
        <EmptyState
          v-else-if="data.rows.length === 0"
          message="No loans yet. Add your first loan or import your ARAWAN file."
          action-label="Add loan"
          @action="addOpen = true"
        />
        <template v-else>
          <ul class="overflow-hidden rounded-card border border-border lg:hidden">
            <LoanListItem v-for="(loan, i) in data.rows" :key="loan.id" :loan="loan" :row-number="rowOffset + i + 1" @more="onMore" @edit="onEdit" @record-payment="onRecordPaymentFor" />
          </ul>
          <div class="hidden lg:block">
            <LoanTable :loans="data.rows" :row-offset="rowOffset" :sort="filters.sort ?? 'sequence_asc'" @sort="(s: LoanFilters['sort']) => update({ sort: s })" @edit="onEdit" @more="onMore" @record-payment="onRecordPaymentFor" @archive="onArchive" />
          </div>
          <div class="mt-3 flex items-center justify-between text-sm text-text-secondary">
            <span>{{ data.total }} records</span>
            <div class="flex items-center gap-2">
              <button type="button" class="press rounded-control border border-control-border px-2 py-1 disabled:opacity-40" :disabled="page <= 1" @click="update({ page: page - 1 })">‹</button>
              <span>Page {{ page }}</span>
              <button type="button" class="press rounded-control border border-control-border px-2 py-1 disabled:opacity-40" :disabled="page * pageSize >= data.total" @click="update({ page: page + 1 })">›</button>
            </div>
          </div>
        </template>
      </template>
    </div>

    <LoanFilters v-model:open="filterOpen" :model-filters="filters" @apply="update" />
    <LoanFormSheet v-model:open="addOpen" @created="addOpen = false" />
    <LoanEditSheet :open="!!editLoan" :loan="editLoan" @update:open="(open: boolean) => !open && (editLoan = null)" />
    <PaymentFormSheet v-if="paymentLoan" :open="!!paymentLoan" :loan="paymentLoan" @update:open="(v: boolean) => !v && (paymentLoan = null)" />

    <!--
      /records/:id renders here as a nested child route (spec §5/§6): a
      right drawer on desktop, a full-screen overlay on mobile. Because
      this list stays mounted while only the child slot changes, mobile
      Back naturally restores scroll position and filters with zero
      refetch -- no explicit <KeepAlive> needed.
    -->
    <NuxtPage />
  </div>
</template>

<script setup lang="ts">
import type { LoanFilters } from '#shared/schemas/loan'

const { filters, update, activeFilterCount } = useRecordFilters()
const searchInput = ref(filters.value.q ?? '')
const page = computed(() => filters.value.page ?? 1)
const pageSize = computed(() => filters.value.pageSize ?? 25)
// Records' "#" column is a positional row number, not the DB's permanent
// source_sequence -- see LoanTable.vue/LoanListItem.vue for why.
const rowOffset = computed(() => (page.value - 1) * pageSize.value)

const { data, pending, error, refresh } = useLoanList(filters)

let searchTimer: ReturnType<typeof setTimeout> | undefined
function onSearchInput() {
  clearTimeout(searchTimer)
  searchTimer = setTimeout(() => update({ q: searchInput.value || undefined }), 250)
}

// Spec §6: "Empty search result retains the query and offers Clear
// filters" -- a zero-result search/filter gets its own distinct empty
// state from a genuinely empty account, and only an explicit Clear
// action resets it (never auto-cleared).
const hasActiveSearchOrFilter = computed(() => !!filters.value.q || activeFilterCount.value > 0)
function clearFilters() {
  searchInput.value = ''
  update({ q: undefined, status: 'all', archived: 'exclude', borrowedFrom: undefined, borrowedTo: undefined, balanceMin: undefined, balanceMax: undefined })
}

const filterOpen = ref(false)
const addOpen = ref(false)
const paymentLoan = ref<any>(null)
const editLoan = ref<LoanSummary | null>(null)

const mobileSegments = [
  { value: 'all', label: 'All' },
  { value: 'active', label: 'Active' },
  { value: 'completed', label: 'Completed' },
] as const

function onMore(loan: any) {
  navigateTo(`/records/${loan.id}`)
}
function onEdit(loan: LoanSummary) {
  editLoan.value = loan
}
function onRecordPaymentFor(loan: any) {
  paymentLoan.value = loan
}
// Same archive/restore flow as the loan detail drawer (app/pages/records/[id].vue).
async function onArchive(loan: LoanSummary) {
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
async function onExport() {
  // Excel export is a follow-up phase (spec phase 4) -- this pass ships
  // the core app; the button is present but explains the limitation.
  useToast().show('Export is coming in a follow-up update', 'info')
}
</script>
