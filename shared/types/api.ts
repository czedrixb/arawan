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
  predecessor: LoanSummary | null
  successor: LoanSummary | null
  renewal: LoanRenewal | null
}

export interface RenewLoanResponse { oldLoan: LoanSummary; newLoan: LoanSummary; renewal: LoanRenewal }

export type UnpaidBucket = 'none' | 'short'

/** One row of the Overview "didn't pay" list -- a loan due on the reporting date that wasn't paid in full. */
export interface UnpaidCollectionRow {
  loanId: string
  borrowerDisplayName: string
  dueCentavos: number
  paidCentavos: number
  remainingCentavos: number
  daysMissed: number
  bucket: UnpaidBucket
  displayStatus: DisplayStatus
}

export interface OverviewResponse {
  reportingDate: string
  principalRecordedCentavos: number
  interestRecordedCentavos: number
  totalPayableCentavos: number
  collectedInPeriodCentavos: number
  collectedTodayCentavos: number
  outstandingTodayCentavos: number
  outstandingExcludedCount: number
  activeCount: number
  overdueCount: number
  expectedTodayCentavos: number
  collectedOnDateCentavos: number
  expectedOnDateCentavos: number
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
  unpaid: {
    rows: UnpaidCollectionRow[]
    noPaymentCount: number
    shortCount: number
  }
}
