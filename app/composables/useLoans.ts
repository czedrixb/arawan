import type { LoanFilters } from '#shared/schemas/loan'
import type { LoanDetailResponse, LoanListResponse } from '#shared/types/api'

export function useLoanList(filters: Ref<Partial<LoanFilters>>) {
  // `filters` is a computed reading route.query, which Vue Router
  // replaces with a new (content-identical) object on every navigation
  // -- watching `filters` itself compares by reference and refetches on
  // every revisit even when nothing actually changed, defeating the
  // "Back performs zero refetches" guarantee (docs/performance.md).
  // Watch the serialized string instead, which compares by value.
  const filtersKey = computed(() => JSON.stringify(filters.value))
  return useCachedFetch<LoanListResponse>('/api/loans', {
    query: filters,
    watch: [filtersKey],
    key: () => `loans:${filtersKey.value}`,
  })
}

export function useLoan(id: Ref<string> | string) {
  const idRef = toRef(id)
  return useCachedFetch<LoanDetailResponse>(() => `/api/loans/${idRef.value}`, {
    watch: [idRef],
    key: () => `loan:${idRef.value}`,
  })
}

export async function createLoan(input: Record<string, unknown>) {
  const loan = await $fetch('/api/loans', { method: 'POST', body: input })
  await refreshNuxtData()
  return loan
}

export async function patchLoan(id: string, patch: Record<string, unknown>) {
  const loan = await $fetch(`/api/loans/${id}`, { method: 'PATCH', body: patch })
  await refreshNuxtData()
  return loan
}

/**
 * Optimistic archive/restore (spec §2 point 3): the toggle reflects
 * instantly, then reconciles with the authoritative server row; on
 * failure the optimistic patch is rolled back.
 */
export async function setLoanArchived(id: string, archived: boolean, version: number) {
  const nuxtApp = useNuxtApp()
  const key = `loan:${id}`
  const previous = nuxtApp.payload.data[key] ?? nuxtApp.static.data[key]
  if (previous) {
    const optimistic = { ...previous, loan: { ...previous.loan, archived_at: archived ? new Date().toISOString() : null } }
    nuxtApp.payload.data[key] = optimistic
    nuxtApp.static.data[key] = optimistic
  }
  try {
    const result = await $fetch(`/api/loans/${id}/archive`, { method: 'POST', body: { archived, version } })
    await refreshNuxtData()
    return result
  } catch (err) {
    if (previous) {
      nuxtApp.payload.data[key] = previous
      nuxtApp.static.data[key] = previous
    }
    throw err
  }
}
