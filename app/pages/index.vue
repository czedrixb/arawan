<template>
  <div>
    <PageHeader :title="'Overview'" :subtitle="todayLabel">
      <template #actions>
        <button type="button" class="press rounded-control bg-primary px-4 py-2 text-sm font-semibold text-white" @click="addOpen = true">
          + Add
        </button>
      </template>
    </PageHeader>

    <div class="mt-4 px-4 lg:px-8">
      <AppSkeleton v-if="pending && !overview" variant="stat-grid" :rows="4" />
      <ErrorState v-else-if="error" @retry="refresh()" />
      <template v-else-if="overview">
        <section class="rounded-card border border-border bg-surface p-5 shadow-card">
          <p class="text-sm text-text-secondary">Principal recorded</p>
          <p class="mt-1 text-[32px] font-bold leading-none text-text-primary tabular-money">
            {{ formatCentavos(overview.principalRecordedCentavos) }}
          </p>
          <div class="mt-4 grid grid-cols-2 gap-4 border-t border-border pt-4 lg:grid-cols-4">
            <div>
              <p class="text-xs text-text-secondary">Interest recorded</p>
              <p class="text-lg font-semibold tabular-money">{{ formatCentavos(overview.interestRecordedCentavos) }}</p>
            </div>
            <div>
              <p class="text-xs text-text-secondary">Average interest rate</p>
              <p class="text-lg font-semibold tabular-money">{{ formatBps(overview.averageInterestRateBps) }}</p>
            </div>
            <div>
              <p class="text-xs text-text-secondary">Collected this month</p>
              <p class="text-lg font-semibold tabular-money">{{ formatCentavos(overview.collectedInPeriodCentavos) }}</p>
            </div>
            <div>
              <p class="text-xs text-text-secondary">
                Outstanding today
                <span v-if="overview.outstandingExcludedCount > 0">({{ overview.outstandingExcludedCount }} need review)</span>
              </p>
              <p class="text-lg font-semibold tabular-money">{{ formatCentavos(overview.outstandingTodayCentavos) }}</p>
            </div>
          </div>
        </section>

        <section class="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatTile label="Active loans" :value="String(overview.activeCount)" :to="{ path: '/records', query: { status: 'active' } }" />
          <StatTile label="Overdue" :value="String(overview.overdueCount)" :to="{ path: '/records', query: { status: 'overdue' } }" tone="danger" />
          <StatTile label="Expected today" :value="formatCentavos(overview.expectedTodayCentavos)" />
          <StatTile
            label="Needs review"
            :value="String(overview.outstandingExcludedCount)"
            :to="{ path: '/records', query: { status: 'needs_review' } }"
            tone="warning"
          />
        </section>

        <section class="mt-6">
          <h2 class="mb-2 text-sm font-semibold text-text-primary">Collections, last 6 months</h2>
          <CollectionChart :bars="overview.sixMonthChart" />
        </section>

        <section class="mt-6">
          <h2 class="mb-2 text-sm font-semibold text-text-primary">Recent activity</h2>
          <EmptyState v-if="overview.recentActivity.length === 0" message="No payments recorded yet." />
          <ul v-else class="divide-y divide-border rounded-card border border-border bg-surface">
            <li v-for="item in overview.recentActivity" :key="item.id" class="flex items-center justify-between px-4 py-3">
              <div>
                <p class="text-sm font-medium text-text-primary">{{ item.borrowerDisplayName }}</p>
                <p class="text-xs text-text-secondary">{{ item.kind === 'reversal' ? 'Reversal' : 'Payment' }} · {{ formatDateDisplay(item.paidOn) }}</p>
              </div>
              <MoneyText :centavos="item.amountCentavos" class="text-sm font-semibold" />
            </li>
          </ul>
        </section>
      </template>
    </div>

    <LoanFormSheet v-model:open="addOpen" @created="onCreated" />
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'default' })

const { data: overview, pending, error, refresh } = useCachedFetch<OverviewResponse>('/api/overview', { key: 'overview' })
const todayLabel = computed(() => formatDateDisplay(todayIso()))
const addOpen = ref(false)
const toast = useToast()

function formatBps(bps: number | null) {
  return bps === null ? '—' : `${(bps / 100).toFixed(1)}%`
}

function onCreated() {
  addOpen.value = false
  toast.show('Loan created')
}
</script>
