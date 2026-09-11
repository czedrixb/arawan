<template>
  <div>
    <AppSkeleton v-if="pending && !data" variant="list" :rows="3" />
    <EmptyState v-else-if="data && data.rows.length === 0" message="No payments recorded yet." />
    <ul v-else-if="data" class="divide-y divide-border rounded-card border border-border bg-surface">
      <li v-for="entry in data.rows" :key="entry.id" class="flex items-center justify-between px-4 py-3">
        <div>
          <p class="text-sm font-medium text-text-primary">
            {{ entry.kind === 'reversal' ? 'Reversal' : 'Payment' }}
            <span v-if="entry.is_reversed" class="ml-1 text-xs text-text-secondary">(reversed)</span>
          </p>
          <p class="text-xs text-text-secondary">{{ formatDateDisplay(entry.paid_on) }}<span v-if="entry.note"> · {{ entry.note }}</span></p>
        </div>
        <div class="flex items-center gap-3">
          <MoneyText :centavos="entry.amount_centavos" :class="entry.kind === 'reversal' ? 'text-danger-fg' : ''" />
          <button
            v-if="entry.kind === 'payment' && !entry.is_reversed"
            type="button"
            class="press text-xs text-text-secondary underline"
            @click="$emit('reverse', entry)"
          >
            Reverse
          </button>
        </div>
      </li>
    </ul>
  </div>
</template>

<script setup lang="ts">
const props = defineProps<{ loanId: string }>()
defineEmits<{ reverse: [entry: any] }>()
const page = ref(1)
const pageSize = ref(25)
const { data, pending } = useLoanPayments(props.loanId, page, pageSize)
</script>
