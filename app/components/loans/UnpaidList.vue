<template>
  <section data-testid="unpaid-collections" class="rounded-card border border-border bg-surface shadow-card">
    <div class="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
      <div>
        <h2 class="text-sm font-semibold text-text-primary">Didn't pay on {{ dateLabel }}</h2>
        <p class="text-xs text-text-secondary">{{ filteredRows.length }} borrower{{ filteredRows.length === 1 ? '' : 's' }}</p>
      </div>
      <label class="flex items-center gap-2 text-xs font-medium text-text-secondary">
        <input
          v-model="showShort"
          type="checkbox"
          data-testid="unpaid-short-toggle"
          class="h-4 w-4 rounded border-control-border text-primary focus:ring-2 focus:ring-focus"
        />
        Include short payments
      </label>
    </div>

    <EmptyState v-if="rows.length === 0" :message="`Everyone paid on ${dateLabel}.`" />
    <EmptyState v-else-if="filteredRows.length === 0" :message="`No short payments on ${dateLabel}.`" />
    <template v-else>
      <ul class="divide-y divide-border">
        <UnpaidRow v-for="row in pagedRows" :key="row.loanId" :row="row" />
      </ul>
      <div v-if="pageCount > 1" class="flex items-center justify-between border-t border-border px-4 py-3 text-sm text-text-secondary">
        <span>{{ filteredRows.length }} borrower{{ filteredRows.length === 1 ? '' : 's' }}</span>
        <div class="flex items-center gap-2">
          <button
            type="button"
            data-testid="unpaid-prev"
            aria-label="Previous page"
            class="press flex h-8 w-8 items-center justify-center rounded-full border border-control-border disabled:opacity-40"
            :disabled="page <= 1"
            @click="page -= 1"
          >
            ‹
          </button>
          <span data-testid="unpaid-page-indicator" aria-current="page">Page {{ page }} of {{ pageCount }}</span>
          <button
            type="button"
            data-testid="unpaid-next"
            aria-label="Next page"
            class="press flex h-8 w-8 items-center justify-center rounded-full border border-control-border disabled:opacity-40"
            :disabled="page >= pageCount"
            @click="page += 1"
          >
            ›
          </button>
        </div>
      </div>
    </template>
  </section>
</template>

<script setup lang="ts">
const props = defineProps<{ rows: UnpaidCollectionRow[]; reportingDate: string }>()

const PAGE_SIZE = 20
const page = ref(1)
const showShort = ref(false)

const dateLabel = computed(() => formatDateDisplay(props.reportingDate))
const filteredRows = computed(() => (showShort.value ? props.rows : props.rows.filter((r) => r.bucket === 'none')))
const pageCount = computed(() => Math.max(1, Math.ceil(filteredRows.value.length / PAGE_SIZE)))
const pagedRows = computed(() => filteredRows.value.slice((page.value - 1) * PAGE_SIZE, page.value * PAGE_SIZE))

// Switching the Overview date is a new question ("who missed on this day?")
// -- always start back at page 1. Toggling Short does too, since it changes
// which rows exist at all.
watch(() => props.reportingDate, () => { page.value = 1 })
watch(showShort, () => { page.value = 1 })
// A refresh after a payment/reversal can shrink the list out from under the
// current page (e.g. the owner is on page 2 of 2 and it collapses to 1) --
// clamp instead of stranding them on an empty page.
watch(pageCount, (count) => { if (page.value > count) page.value = count })
</script>
