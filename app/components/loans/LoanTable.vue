<template>
  <div class="overflow-x-auto rounded-card border border-border bg-surface">
    <table class="w-full min-w-[1120px] text-sm">
      <thead class="bg-surface-subtle text-left text-xs text-text-secondary">
        <tr>
          <th
            v-for="col in columns"
            :key="col.key"
            scope="col"
            class="px-4 py-3 font-medium"
            :class="col.numeric ? 'text-right' : ''"
          >
            <button
              type="button"
              class="press flex items-center gap-1"
              :class="col.numeric ? 'w-full justify-end' : ''"
              :aria-sort="ariaSortFor(col)"
              @click="sortColumn(col)"
            >
              {{ col.label }}
              <PhCaretUpDown :size="12" />
            </button>
          </th>
          <th scope="col" class="px-4 py-3" />
        </tr>
      </thead>
      <tbody class="divide-y divide-border">
        <tr v-for="loan in loans" :key="loan.id" class="hover:bg-surface-subtle">
          <td class="px-4 py-3 text-text-secondary">{{ loan.source_sequence ?? '—' }}</td>
          <td class="px-4 py-3">
            <NuxtLink :to="`/records/${loan.id}`" class="font-medium text-text-primary hover:underline">
              {{ loan.borrower_display_name }}
            </NuxtLink>
          </td>
          <td class="px-4 py-3 text-text-secondary">{{ formatDateDisplay(loan.borrowed_on) }}</td>
          <td class="px-4 py-3 text-text-secondary">{{ formatDateDisplay(loan.payment_start_on) }}</td>
          <td class="px-4 py-3 text-text-secondary">{{ formatDateDisplay(loan.due_on) }}</td>
          <td class="px-4 py-3 text-right tabular-money"><MoneyText :centavos="loan.principal_centavos" /></td>
          <td class="px-4 py-3 text-right tabular-money"><MoneyText :centavos="loan.daily_due_centavos" /></td>
          <td class="px-4 py-3 text-right tabular-money"><MoneyText :centavos="loan.interest_centavos" /></td>
          <td class="px-4 py-3"><StatusPill :status="loan.display_status" /></td>
          <td class="px-4 py-3 text-right">
            <button type="button" class="press rounded-control border border-control-border px-3 py-1.5 text-xs" :aria-label="`Edit ${loan.borrower_display_name}`" @click="$emit('edit', loan)">
              Edit
            </button>
          </td>
        </tr>
        <tr v-if="loans.length === 0">
          <td colspan="10" class="px-4 py-8 text-center text-text-secondary">No records match these filters.</td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<script setup lang="ts">
import { PhCaretUpDown } from '@phosphor-icons/vue'
import type { LoanFilters } from '#shared/schemas/loan'

const props = defineProps<{ loans: any[]; sort: LoanFilters['sort'] }>()
const emit = defineEmits<{ sort: [LoanFilters['sort']]; edit: [loan: any] }>()

const columns = [
  { key: 'sequence', label: '#', ascending: 'sequence_asc' as const, descending: 'sequence_desc' as const, numeric: true },
  { key: 'name', label: 'Name', ascending: 'name_asc' as const, descending: 'name_desc' as const },
  { key: 'borrowed', label: 'Date Borrowed', ascending: 'borrowed_asc' as const, descending: 'borrowed_desc' as const },
  { key: 'paymentStart', label: 'Payment Start', ascending: 'payment_start_asc' as const, descending: 'payment_start_desc' as const },
  { key: 'completed', label: 'Date Completed', ascending: 'completed_asc' as const, descending: 'completed_desc' as const },
  { key: 'amount', label: 'Amount', ascending: 'principal_asc' as const, descending: 'principal_desc' as const, numeric: true },
  { key: 'daily', label: 'Daily', ascending: 'daily_asc' as const, descending: 'daily_desc' as const, numeric: true },
  { key: 'interest', label: 'Interest', ascending: 'interest_asc' as const, descending: 'interest_desc' as const, numeric: true },
  { key: 'status', label: 'Status', ascending: 'status_asc' as const, descending: 'status_desc' as const },
]

function ariaSortFor(column: typeof columns[number]) {
  if (props.sort === column.ascending) return 'ascending'
  if (props.sort === column.descending) return 'descending'
  return 'none'
}

function sortColumn(column: typeof columns[number]) {
  emit('sort', props.sort === column.ascending ? column.descending : column.ascending)
}
</script>
