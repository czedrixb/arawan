<template>
  <li class="flex items-start justify-between gap-3 px-4 py-3">
    <NuxtLink :to="{ path: `/records/${row.loanId}` }" class="min-w-0 flex-1">
      <div class="flex items-center justify-between gap-2">
        <p class="truncate text-sm font-medium text-text-primary">{{ row.borrowerDisplayName }}</p>
        <StatusPill :status="row.displayStatus" />
      </div>
      <div class="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-text-secondary">
        <span v-if="row.bucket === 'short'">
          Paid <MoneyText :centavos="row.paidCentavos" /> of <MoneyText :centavos="row.dueCentavos" /> due
        </span>
        <span v-else>
          <MoneyText :centavos="row.dueCentavos" /> due
        </span>
        <span>Remaining <MoneyText :centavos="row.remainingCentavos" /></span>
      </div>
    </NuxtLink>
    <span
      class="inline-flex shrink-0 items-center rounded-full px-2.5 py-1 text-xs font-medium"
      :class="daysMissedTone === 'danger' ? 'bg-danger-bg text-danger-fg' : 'bg-warning-bg text-warning-fg'"
    >
      {{ row.daysMissed }}d missed
    </span>
  </li>
</template>

<script setup lang="ts">
const props = defineProps<{ row: UnpaidCollectionRow }>()
// Days-missed is a UI-only severity cue, not a DisplayStatus value, so it
// can't reuse StatusPill -- just the same pill shape with warning/danger tokens.
const daysMissedTone = computed(() => (props.row.daysMissed >= 3 ? 'danger' : 'warning'))
</script>
