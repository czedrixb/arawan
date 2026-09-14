<template>
  <AppSheet v-model:open="openModel" title="Filter records">
    <div class="flex flex-col gap-5">
      <div>
        <h3 class="mb-2 text-sm font-semibold text-text-primary">Status</h3>
        <div class="flex flex-wrap gap-2">
          <button
            v-for="s in statuses"
            :key="s.value"
            type="button"
            class="press rounded-full border px-3 py-1.5 text-xs"
            :class="local.status === s.value ? 'border-primary bg-accent-soft text-primary' : 'border-control-border'"
            @click="local.status = s.value"
          >
            {{ s.label }}
          </button>
        </div>
      </div>
      <div>
        <h3 class="mb-2 text-sm font-semibold text-text-primary">Archive</h3>
        <div class="flex gap-2">
          <button
            v-for="a in archiveOptions"
            :key="a.value"
            type="button"
            class="press rounded-full border px-3 py-1.5 text-xs"
            :class="local.archived === a.value ? 'border-primary bg-accent-soft text-primary' : 'border-control-border'"
            @click="local.archived = a.value"
          >
            {{ a.label }}
          </button>
        </div>
      </div>
      <div class="grid grid-cols-2 gap-3">
        <div>
          <label for="filter-borrowed-from" class="mb-1 block text-sm text-text-secondary">Borrowed from</label>
          <input id="filter-borrowed-from" v-model="local.borrowedFrom" type="date" class="w-full rounded-control border border-control-border px-3 py-2.5 text-base" />
        </div>
        <div>
          <label for="filter-borrowed-to" class="mb-1 block text-sm text-text-secondary">Borrowed to</label>
          <input id="filter-borrowed-to" v-model="local.borrowedTo" type="date" class="w-full rounded-control border border-control-border px-3 py-2.5 text-base" />
        </div>
      </div>
    </div>
    <template #footer>
      <div class="flex gap-3">
        <button type="button" class="press flex-1 rounded-control border border-control-border px-4 py-2.5 text-sm font-medium" @click="onClear">Clear filters</button>
        <button type="button" class="press flex-1 rounded-control bg-primary px-4 py-2.5 text-sm font-semibold text-white" @click="onApply">Apply</button>
      </div>
    </template>
  </AppSheet>
</template>

<script setup lang="ts">
import type { LoanFilters } from '#shared/schemas/loan'

const props = defineProps<{ open: boolean; modelFilters: Partial<LoanFilters> }>()
const emit = defineEmits<{ 'update:open': [boolean]; apply: [Partial<LoanFilters>] }>()
const openModel = computed({ get: () => props.open, set: (v) => emit('update:open', v) })

const local = reactive({ ...props.modelFilters })
watch(() => props.open, (isOpen) => {
  if (isOpen) Object.assign(local, props.modelFilters)
})

const statuses = [
  { value: 'all', label: 'All' },
  { value: 'active', label: 'Active' },
  { value: 'overdue', label: 'Overdue' },
  { value: 'needs_review', label: 'Needs review' },
  { value: 'completed', label: 'Completed' },
] as const
const archiveOptions = [
  { value: 'exclude', label: 'Active only' },
  { value: 'only', label: 'Archived only' },
  { value: 'include', label: 'All' },
] as const

function onApply() {
  emit('apply', { ...local })
  openModel.value = false
}
function onClear() {
  emit('apply', { status: 'all', archived: 'exclude', sort: 'sequence_asc' })
  openModel.value = false
}
</script>
