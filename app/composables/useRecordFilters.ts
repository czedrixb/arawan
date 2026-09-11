// Keeps Records' filter/sort/pagination state in the URL query (spec §6)
// so a shared link or browser Back reproduces the same view, and so
// <NuxtPage keepalive> + the URL together are enough to restore mobile
// scroll position without an extra client store.
import { loanFiltersSchema, type LoanFilters } from '#shared/schemas/loan'

export function useRecordFilters() {
  const route = useRoute()
  const router = useRouter()

  // Vue Router hands out a fresh route.query object on every navigation,
  // even when revisiting the identical URL -- a naive computed() would
  // then return a NEW object reference each time too, and useFetch's
  // built-in query-watching (reactive params are watched by default,
  // independent of any `watch` array passed in) treats that reference
  // change as "the query changed", refetching on every Back navigation
  // even though nothing did (breaks the "zero refetch" guarantee in
  // docs/performance.md). Memoize by serialized content so the SAME
  // object is returned when nothing actually changed.
  let lastSerialized = ''
  let lastResult: Partial<LoanFilters> = { status: 'all', archived: 'exclude', sort: 'borrowed_desc', page: 1, pageSize: 25 }
  const filters = computed<Partial<LoanFilters>>(() => {
    const parsed = loanFiltersSchema.safeParse({
      ...route.query,
      balanceMin: route.query.balanceMin ? Number(route.query.balanceMin) : undefined,
      balanceMax: route.query.balanceMax ? Number(route.query.balanceMax) : undefined,
      page: route.query.page ? Number(route.query.page) : undefined,
      pageSize: route.query.pageSize ? Number(route.query.pageSize) : undefined,
    })
    const next = parsed.success ? parsed.data : lastResult
    const serialized = JSON.stringify(next)
    if (serialized !== lastSerialized) {
      lastSerialized = serialized
      lastResult = next
    }
    return lastResult
  })

  function update(patch: Partial<LoanFilters>) {
    const next: Record<string, string> = {}
    const merged = { ...filters.value, ...patch }
    // Changing anything except the page itself resets pagination to page 1.
    if (!('page' in patch)) merged.page = 1
    for (const [k, v] of Object.entries(merged)) {
      if (v !== undefined && v !== null && v !== '') next[k] = String(v)
    }
    router.replace({ query: next })
  }

  const activeFilterCount = computed(() => {
    let count = 0
    if (filters.value.status && filters.value.status !== 'all') count++
    if (filters.value.archived && filters.value.archived !== 'exclude') count++
    if (filters.value.borrowedFrom) count++
    if (filters.value.borrowedTo) count++
    if (filters.value.balanceMin !== undefined) count++
    if (filters.value.balanceMax !== undefined) count++
    return count
  })

  return { filters, update, activeFilterCount }
}
