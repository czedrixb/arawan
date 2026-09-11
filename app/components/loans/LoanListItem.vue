<template>
  <li class="relative overflow-hidden border-b border-border last:border-b-0">
    <div
      class="flex touch-pan-y items-center justify-between gap-3 bg-surface px-4 py-3 transition-transform"
      :style="{ transform: `translateX(${dragX}px)` }"
      @touchstart="onTouchStart"
      @touchmove="onTouchMove"
      @touchend="onTouchEnd"
    >
      <NuxtLink :to="`/records/${loan.id}`" class="min-w-0 flex-1">
        <p class="truncate text-sm font-medium text-text-primary">{{ loan.borrower_display_name }}</p>
        <p class="text-xs text-text-secondary">
          {{ formatDateDisplay(loan.borrowed_on) }} · <MoneyText :centavos="loan.principal_centavos" /> · <MoneyText :centavos="loan.daily_due_centavos" />/day
        </p>
        <div class="mt-1 flex items-center gap-2">
          <StatusPill :status="loan.display_status" />
          <MoneyText :centavos="loan.remaining_centavos" class="text-xs" />
        </div>
      </NuxtLink>
      <button type="button" class="press rounded-full p-2 text-text-secondary" :aria-label="`More actions for ${loan.borrower_display_name}`" @click="$emit('more', loan)">
        <PhDotsThreeVertical :size="20" weight="bold" />
      </button>
    </div>
    <!-- Swipe reveal -- mirrored exactly by the visible More menu, never the only way to reach these actions (spec §6). -->
    <div class="absolute inset-y-0 right-0 flex items-stretch" :style="{ width: `${revealWidth}px` }">
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
  // Never fight vertical scroll (spec §6) -- only claim the gesture once it's clearly horizontal.
  if (!isHorizontal) return
  dragX.value = Math.max(-revealWidth, Math.min(0, dx))
}
function onTouchEnd() {
  dragX.value = dragX.value < -revealWidth / 2 ? -revealWidth : 0
}
function onRecordPayment() {
  dragX.value = 0
  emit('record-payment', props.loan)
}
</script>
