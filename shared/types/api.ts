// Response shapes for server/api/** endpoints, referenced by both the
// Nitro handlers (return type) and the app's useCachedFetch<T> call
// sites, so a shape change is a single edit that surfaces everywhere it
// no longer matches (that's the point of typechecking these at all).

export interface Paged<T> {
  rows: T[]
  total: number
  page: number
  pageSize: number
}

export type LoanListResponse = Paged<LoanSummary>
export type PaymentListResponse = Paged<PaymentEntry>

export interface LoanDetailResponse {
  loan: LoanSummary
  otherLoans: LoanSummary[]
}

export interface OverviewResponse {
  principalRecordedCentavos: number
  interestRecordedCentavos: number
  totalPayableCentavos: number
  collectedInPeriodCentavos: number
  outstandingTodayCentavos: number
  outstandingExcludedCount: number
  activeCount: number
  overdueCount: number
  expectedTodayCentavos: number
  sixMonthChart: { month: string; collectedCentavos: number }[]
  recentActivity: {
    id: string
    loanId: string
    borrowerDisplayName: string
    kind: PaymentKind
    amountCentavos: number
    paidOn: string
    createdAt: string
  }[]
}
