import type { PaymentListResponse } from '#shared/types/api'

export function useLoanPayments(loanId: Ref<string> | string, page: Ref<number>, pageSize: Ref<number>) {
  const idRef = toRef(loanId)
  return useCachedFetch<PaymentListResponse>(() => `/api/loans/${idRef.value}/payments`, {
    query: { page, pageSize },
    watch: [idRef, page, pageSize],
    key: () => `payments:${idRef.value}:${page.value}:${pageSize.value}`,
  })
}

/**
 * Optimistic payment (spec §2 point 3 / §6 record payment): the loan
 * detail's balance updates immediately from the predicted result, then
 * reconciles with the server's authoritative loan_summary row. On
 * failure the optimistic patch rolls back -- the server result is always
 * what finally renders, per spec.
 */
export async function recordPayment(loanId: string, input: { amountCentavos: number; paidOn: string; method?: string | null; note?: string | null; idempotencyKey: string }) {
  const nuxtApp = useNuxtApp()
  const key = `loan:${loanId}`
  const previous = nuxtApp.payload.data[key] ?? nuxtApp.static.data[key]

  if (previous?.loan?.remaining_centavos != null) {
    const optimistic = applyLoanSummaryPatch(previous, {
      remaining_centavos: previous.loan.remaining_centavos - input.amountCentavos,
      recognized_collected_centavos: previous.loan.recognized_collected_centavos + input.amountCentavos,
    })
    nuxtApp.payload.data[key] = optimistic
    nuxtApp.static.data[key] = optimistic
  }

  try {
    const summary = await $fetch(`/api/loans/${loanId}/payments`, { method: 'POST', body: input })
    reconcileLoan(loanId, summary)
    await syncRecordData({ loanId, payments: true })
    return summary
  } catch (err) {
    if (previous) {
      nuxtApp.payload.data[key] = previous
      nuxtApp.static.data[key] = previous
    }
    throw err
  }
}

export async function reversePayment(loanId: string, paymentId: string, input: { reason: string; idempotencyKey: string }) {
  const summary = await $fetch(`/api/payments/${paymentId}/reverse`, { method: 'POST', body: input })
  reconcileLoan(loanId, summary)
  await syncRecordData({ loanId, payments: true })
  return summary
}

export async function confirmOpeningBalance(loanId: string, input: { collectedCentavos: number; asOf: string; reason: string }) {
  const summary = await $fetch(`/api/loans/${loanId}/opening-balance`, { method: 'POST', body: input })
  reconcileLoan(loanId, summary)
  await syncRecordData({ loanId })
  return summary
}

function applyLoanSummaryPatch(previous: any, patch: Record<string, unknown>) {
  return { ...previous, loan: { ...previous.loan, ...patch } }
}

function reconcileLoan(loanId: string, summary: unknown) {
  const nuxtApp = useNuxtApp()
  const key = `loan:${loanId}`
  const previous = nuxtApp.payload.data[key] ?? nuxtApp.static.data[key]
  const reconciled = { ...(previous ?? {}), loan: summary }
  nuxtApp.payload.data[key] = reconciled
  nuxtApp.static.data[key] = reconciled
}
