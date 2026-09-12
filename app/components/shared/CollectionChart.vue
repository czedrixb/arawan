<template>
  <figure class="rounded-card border border-border bg-surface p-4 shadow-card">
    <p class="text-sm text-text-secondary">
      Total: <span class="font-semibold text-text-primary tabular-money">{{ formatCentavos(total) }}</span>
    </p>
    <svg :viewBox="`0 0 ${bars.length * 60} 140`" preserveAspectRatio="none" class="mt-3 h-32 w-full" role="img" :aria-label="`Monthly collections chart, total ${formatCentavos(total)}`">
      <g v-for="(bar, i) in bars" :key="bar.month">
        <rect
          :x="i * 60 + 12"
          :y="140 - heightFor(bar.collectedCentavos)"
          width="36"
          :height="heightFor(bar.collectedCentavos)"
          :fill="i === bars.length - 1 ? 'var(--color-primary)' : 'var(--color-accent-chart)'"
          rx="4"
        />
      </g>
    </svg>
    <figcaption class="sr-only">
      <table>
        <caption>Monthly collections, last six months</caption>
        <thead>
          <tr>
            <th scope="col">Month</th>
            <th scope="col">Collected</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="bar in bars" :key="bar.month">
            <td>{{ bar.month }}</td>
            <td>{{ formatCentavos(bar.collectedCentavos) }}</td>
          </tr>
        </tbody>
      </table>
    </figcaption>
    <div class="mt-1 grid text-center text-[11px] text-text-secondary" :style="{ gridTemplateColumns: `repeat(${bars.length}, minmax(0, 1fr))` }">
      <span v-for="bar in bars" :key="bar.month">{{ bar.month.slice(5) }}</span>
    </div>
  </figure>
</template>

<script setup lang="ts">
// Spec §13: charts have visible totals and a text/table alternative --
// the sr-only <table> carries the same data for screen readers.
const props = defineProps<{ bars: { month: string; collectedCentavos: number }[] }>()
const total = computed(() => props.bars.reduce((sum, b) => sum + b.collectedCentavos, 0))
const max = computed(() => Math.max(1, ...props.bars.map((b) => b.collectedCentavos)))
function heightFor(value: number) {
  return Math.max(2, Math.round((value / max.value) * 120))
}
</script>
