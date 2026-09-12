// Spec §3 "new loan terms" formulas -- shared by the add-loan form's live
// preview and the server-side loan-service so both agree byte-for-byte.
import { projectScheduleEnd } from './dates'

// `InterestMode` is declared once in shared/types/models.ts, which
// auto-imports into this file without a statement.
export interface ScheduleInput {
  principalCentavos: number
  dailyDueCentavos: number
  interestMode: InterestMode
  interestCentavos: number
  paymentStartOn: string
  collectionWeekdays: number[]
  /** Defaults to STANDARD_INSTALLMENTS -- every new loan uses the house's fixed 60-day term. */
  installmentCount?: number
}

export interface SchedulePreview {
  totalPayableCentavos: number
  installmentCount: number
  finalInstallmentCentavos: number
  proposedDueOn: string
}

/** House terms (this task): every new loan carries 20% interest over a fixed 60-day collection term. */
export const STANDARD_INTEREST_RATE_BPS = 2000
export const STANDARD_INSTALLMENTS = 60

/** `principal x 20%`, rounded to the nearest centavo. */
export function computeStandardInterest(principalCentavos: number): number {
  return Math.round((principalCentavos * STANDARD_INTEREST_RATE_BPS) / 10_000)
}

/**
 * `(principal + interest) / 60`, rounded UP to the nearest centavo so 60
 * installments always cover the total -- the 60th installment absorbs the
 * (small, non-negative) remainder instead of coming up short.
 */
export function computeStandardDailyDue(totalPayableCentavos: number): number {
  return Math.ceil(totalPayableCentavos / STANDARD_INSTALLMENTS)
}

/**
 * `total_payable = principal + fixed_interest` (added) or `principal`
 * (none/included) -- "included" means the entered principal already
 * contains the interest, so it is not added again (spec §3).
 */
export function computeTotalPayable(input: Pick<ScheduleInput, 'principalCentavos' | 'interestMode' | 'interestCentavos'>): number {
  if (input.interestMode === 'added') return input.principalCentavos + input.interestCentavos
  return input.principalCentavos
}

export function previewSchedule(input: ScheduleInput): SchedulePreview {
  const totalPayableCentavos = computeTotalPayable(input)
  const installmentCount = input.installmentCount ?? STANDARD_INSTALLMENTS
  const finalInstallmentCentavos = Math.max(
    0,
    totalPayableCentavos - input.dailyDueCentavos * (installmentCount - 1),
  )
  const proposedDueOn = projectScheduleEnd(input.paymentStartOn, installmentCount, input.collectionWeekdays)
  return { totalPayableCentavos, installmentCount, finalInstallmentCentavos, proposedDueOn }
}
