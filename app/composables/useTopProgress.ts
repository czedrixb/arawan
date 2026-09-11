// Thin shared counter so overlapping background revalidations (spec §2
// "revalidates behind a thin top progress bar") don't flicker the bar on
// and off between requests -- it only hides once the last one finishes.
export function useTopProgress() {
  const active = useState<number>('top-progress-active', () => 0)
  return {
    active: computed(() => active.value > 0),
    start: () => active.value++,
    finish: () => (active.value = Math.max(0, active.value - 1)),
  }
}
