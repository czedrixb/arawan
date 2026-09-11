// Small local composable instead of pulling in @vueuse/core for one media
// query (spec §13: respect prefers-reduced-motion everywhere).
export function usePreferredReducedMotion() {
  const prefers = ref(false)
  onMounted(() => {
    const mql = window.matchMedia('(prefers-reduced-motion: reduce)')
    prefers.value = mql.matches
    const handler = (e: MediaQueryListEvent) => (prefers.value = e.matches)
    mql.addEventListener('change', handler)
    onUnmounted(() => mql.removeEventListener('change', handler))
  })
  return prefers
}
