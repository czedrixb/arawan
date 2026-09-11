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
}

export interface SchedulePreview {
  totalPayableCentavos: number
  installmentCount: number
  finalInstallmentCentavos: number
  proposedDueOn: string
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
  const installmentCount = Math.ceil(totalPayableCentavos / input.dailyDueCentavos)
  const finalInstallmentCentavos =
    totalPayableCentavos - input.dailyDueCentavos * (installmentCount - 1)
  const proposedDueOn = projectScheduleEnd(input.paymentStartOn, installmentCount, input.collectionWeekdays)
  return { totalPayableCentavos, installmentCount, finalInstallmentCentavos, proposedDueOn }
}
