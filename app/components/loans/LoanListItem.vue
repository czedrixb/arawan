<template>
  <li class="relative overflow-hidden border-b border-border last:border-b-0">
    <div
      class="flex touch-pan-y items-stretch bg-surface transition-transform"
      :style="{ transform: `translateX(${dragX}px)` }"
      @touchstart="onTouchStart"
      @touchmove="onTouchMove"
      @touchend="onTouchEnd"
    >
      <NuxtLink :to="`/records/${loan.id}`" class="min-w-0 flex-1 px-4 py-3">
        <div class="flex items-start justify-between gap-3">
          <div class="min-w-0">
            <p class="truncate text-sm font-medium text-text-primary">{{ loan.borrower_display_name }}</p>
            <p class="mt-0.5 text-xs text-text-secondary">{{ formatDateDisplay(loan.borrowed_on) }}</p>
          </div>
          <StatusPill :status="loan.display_status" />
        </div>

        <div class="mt-3 grid grid-cols-3 gap-2">
          <div class="min-w-0">
            <p class="text-right text-[10px] font-medium uppercase tracking-wide text-text-secondary">Amount</p>
            <p class="truncate text-right text-xs font-medium tabular-money text-text-primary"><MoneyText :centavos="loan.principal_centavos" /></p>
          </div>
          <div class="min-w-0">
            <p class="text-right text-[10px] font-medium uppercase tracking-wide text-text-secondary">Daily</p>
            <p class="truncate text-right text-xs font-medium tabular-money text-text-primary"><MoneyText :centavos="loan.daily_due_centavos" /></p>
          </div>
          <div class="min-w-0">
            <p class="text-right text-[10px] font-medium uppercase tracking-wide text-text-secondary">Remaining</p>
            <p class="truncate text-right text-xs font-medium tabular-money text-text-primary"><MoneyText :centavos="loan.remaining_centavos" /></p>
          </div>
        </div>
      </NuxtLink>
      <button type="button" class="press self-start rounded-full p-2 text-text-secondary" :aria-label="`${dragX < 0 ? 'Hide' : 'Show'} actions for ${loan.borrower_display_name}`" :aria-expanded="dragX < 0" @click="toggleActions">
        <PhDotsThreeVertical :size="20" weight="bold" />
      </button>
    </div>
    <!-- Swipe reveal -- mirrored exactly by the visible More menu, never the only way to reach these actions (spec §6). -->
    <div v-if="dragX < 0" class="absolute inset-y-0 right-0 flex items-stretch" :style="{ width: `${revealWidth}px` }">
      <button type="button" class="flex-1 bg-primary px-3 text-xs font-medium text-white" @click="onRecordPayment">Record payment</button>
      <button type="button" class="flex-1 bg-surface-subtle px-3 text-xs font-medium text-text-primary" @click="$emit('more', loan)">More</button>
    </div>
  </li>
</template>

<script setup lang="ts">
import { PhDotsThreeVertical } from '@phosphor-icons/vue'

const props = defineProps<{ loan: any }>()
const emit = defineEmits<{ more: [loan: any]; 'record-payment': [loan: any] }>()

const revealWidth = 176
const dragX = ref(0)
let startX = 0
let startY = 0
let isHorizontal: boolean | null = null

function onTouchStart(e: TouchEvent) {
  const touch = e.touches[0]
  if (!touch) return
  startX = touch.clientX
  startY = touch.clientY
  isHorizontal = null
}
function onTouchMove(e: TouchEvent) {
  const touch = e.touches[0]
  if (!touch) return
  const dx = touch.clientX - startX
  const dy = touch.clientY - startY
  if (isHorizontal === null) isHorizontal = Math.abs(dx) > Math.abs(dy)
  // Never fight vertical scroll -- only claim the gesture once it's clearly horizontal.
  if (!isHorizontal) return
  dragX.value = Math.max(-revealWidth, Math.min(0, dx))
}
function onTouchEnd() {
  dragX.value = dragX.value < -revealWidth / 2 ? -revealWidth : 0
}
function toggleActions() {
  dragX.value = dragX.value < 0 ? 0 : -revealWidth
}
function onRecordPayment() {
  dragX.value = 0
  emit('record-payment', props.loan)
}
</script>
