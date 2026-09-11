<template>
  <div class="overflow-x-auto rounded-card border border-border bg-surface">
    <table class="w-full min-w-[760px] text-sm">
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
              v-if="col.sort"
              type="button"
              class="press flex items-center gap-1"
              :class="col.numeric ? 'w-full justify-end' : ''"
              :aria-sort="ariaSortFor(col.sort)"
              @click="$emit('sort', col.sort)"
            >
              {{ col.label }}
              <PhCaretUpDown :size="12" />
            </button>
            <span v-else :class="col.numeric ? 'block text-right' : ''">{{ col.label }}</span>
          </th>
          <th scope="col" class="px-4 py-3" />
        </tr>
      </thead>
      <tbody class="divide-y divide-border">
        <tr v-for="loan in loans" :key="loan.id" class="hover:bg-surface-subtle">
          <td class="px-4 py-3">
            <NuxtLink :to="`/records/${loan.id}`" class="font-medium text-text-primary hover:underline">
              {{ loan.borrower_display_name }}
            </NuxtLink>
          </td>
          <td class="px-4 py-3 text-text-secondary">{{ formatDateDisplay(loan.borrowed_on) }}</td>
          <td class="px-4 py-3 text-right tabular-money"><MoneyText :centavos="loan.principal_centavos" /></td>
          <td class="px-4 py-3 text-right tabular-money"><MoneyText :centavos="loan.daily_due_centavos" /></td>
          <td class="px-4 py-3 text-right tabular-money"><MoneyText :centavos="loan.remaining_centavos" /></td>
          <td class="px-4 py-3"><StatusPill :status="loan.display_status" /></td>
          <td class="px-4 py-3 text-right">
            <button type="button" class="press rounded-full p-1.5 text-text-secondary" :aria-label="`Actions for ${loan.borrower_display_name}`" @click="$emit('more', loan)">
              <PhDotsThreeVertical :size="18" weight="bold" />
            </button>
          </td>
        </tr>
        <tr v-if="loans.length === 0">
          <td colspan="7" class="px-4 py-8 text-center text-text-secondary">No records match these filters.</td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<script setup lang="ts">
import { PhCaretUpDown, PhDotsThreeVertical } from '@phosphor-icons/vue'
import type { LoanFilters } from '#shared/schemas/loan'

const props = defineProps<{ loans: any[]; sort: LoanFilters['sort'] }>()
defineEmits<{ sort: [LoanFilters['sort']]; more: [loan: any] }>()

const columns = [
  { key: 'name', label: 'Name', sort: 'name_asc' as const },
  { key: 'borrowed', label: 'Borrowed', sort: undefined },
  { key: 'amount', label: 'Amount', sort: undefined, numeric: true },
  { key: 'daily', label: 'Daily', sort: undefined, numeric: true },
  { key: 'remaining', label: 'Remaining', sort: 'remaining_desc' as const, numeric: true },
  { key: 'status', label: 'Status', sort: undefined },
]

function ariaSortFor(sortKey: LoanFilters['sort']) {
  return props.sort === sortKey ? 'ascending' : 'none'
}
</script>
