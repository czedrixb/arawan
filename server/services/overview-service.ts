// Consolidated queries (all loan_summary rows, payment_entries in the
// reporting window, and the five newest entries) instead of one query per metric -- ARAWAN is a
// single-owner app with dozens of loans, so this stays well within one
// round trip's worth of data while keeping every number consistent with
// the others (spec §2 "one query per screen" / §3 overview metrics).
import type { SupabaseClient } from '@supabase/supabase-js'
import type { OverviewResponse, UnpaidCollectionRow } from '#shared/types/api'

// Cap on the "didn't pay" rows returned per request -- the two counts stay
// exact regardless, only the row list is bounded (spec: a single-owner book
// of dozens of loans today, but this keeps the payload from growing
// unbounded as it does).
const UNPAID_ROW_CAP = 500

/** True when a ready loan with a remaining balance is scheduled to collect on `date` (spec: Overview "didn't pay" list / Expected tile share this one definition). */
function dueOn(loan: { remaining_centavos: unknown; payment_start_on: unknown; collection_weekdays: number[] }, date: string): boolean {
  return (
    centavos(loan.remaining_centavos) > 0 &&
    loan.payment_start_on != null &&
    dateIso(loan.payment_start_on) <= date &&
    (loan.collection_weekdays as number[]).includes(isoWeekday(date))
  )
}

export async function getOverview(client: SupabaseClient, ownerId: string, reportingDate: string): Promise<OverviewResponse> {
  const currentDate = todayIso()
  const sixMonthsAgo = addMonthsIso(currentDate, -5) // current month + 5 prior = 6 bars
  const chartWindowStart = monthStartIso(sixMonthsAgo)
  // Include the selected day and every later reversal so a past payment
  // cannot reappear merely because its reversal was recorded afterward.
  const paymentWindowStart = reportingDate < chartWindowStart ? reportingDate : chartWindowStart

  const [
    { data: loans, error: loansError },
    { data: payments, error: paymentsError },
    { data: latestPayments, error: latestPaymentsError },
  ] = await Promise.all([
    client.from('loan_summary').select('*').eq('owner_id', ownerId),
    client
      .from('payment_entries')
      .select('id, loan_id, kind, amount_centavos, paid_on, reverses_id, created_at')
      .eq('owner_id', ownerId)
      .gte('paid_on', paymentWindowStart),
    client
      .from('payment_entries')
      .select('id, loan_id, kind, amount_centavos, paid_on, created_at')
      .eq('owner_id', ownerId)
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .range(0, 4),
  ])
  if (loansError) throw loansError
  if (paymentsError) throw paymentsError
  if (latestPaymentsError) throw latestPaymentsError

  const activeLoans = (loans ?? []).filter((l) => !l.archived_at && l.lifecycle !== 'renewed')
  const reversedIds = new Set((payments ?? []).filter((p) => p.kind === 'reversal').map((p) => p.reverses_id))
  const netPayments = (payments ?? []).filter((p) => p.kind === 'payment' && !reversedIds.has(p.id))

  const principalRecordedCentavos = sum(activeLoans.map((l) => l.principal_centavos))
  const interestRecordedCentavos = sum(activeLoans.map((l) => l.interest_centavos))
  const totalPayableCentavos = sum(activeLoans.map((l) => l.total_payable_centavos))

  const monthStart = monthStartIso(currentDate)
  const collectedInPeriodCentavos = sum(
    netPayments.filter((p) => dateIso(p.paid_on) >= monthStart).map((p) => p.amount_centavos),
  )
  const collectedTodayCentavos = sum(
    netPayments.filter((p) => dateIso(p.paid_on) === currentDate).map((p) => p.amount_centavos),
  )
  const collectedOnDateCentavos = sum(
    netPayments.filter((p) => dateIso(p.paid_on) === reportingDate).map((p) => p.amount_centavos),
  )

  const readyLoans = activeLoans.filter((l) => l.readiness === 'ready')
  const outstandingTodayCentavos = sum(readyLoans.map((l) => l.remaining_centavos))
  const outstandingExcludedCount = activeLoans.length - readyLoans.length

  const activeCount = activeLoans.filter((l) => l.display_status === 'active').length
  const overdueCount = activeLoans.filter((l) => l.display_status === 'overdue').length

  const expectedForDate = (date: string) => sum(
    readyLoans
      .filter((l) => dueOn(l, date))
      .map((l) => Math.min(centavos(l.daily_due_centavos), centavos(l.remaining_centavos))),
  )
  const expectedTodayCentavos = expectedForDate(currentDate)
  const expectedOnDateCentavos = reportingDate === currentDate
    ? expectedTodayCentavos
    : expectedForDate(reportingDate)

  const sixMonthChart = buildSixMonthChart(netPayments, sixMonthsAgo)
  const unpaid = buildUnpaidCollections(readyLoans, netPayments, reportingDate, paymentWindowStart)

  // loan_summary includes archived loans, so historical activity keeps the
  // borrower's name after a record is archived.
  const borrowerByLoanId = new Map((loans ?? []).map((loan) => [loan.id, loan.borrower_display_name]))
  const recentActivity: OverviewResponse['recentActivity'] = (latestPayments ?? []).map((payment) => ({
    id: payment.id,
    loanId: payment.loan_id,
    borrowerDisplayName: borrowerByLoanId.get(payment.loan_id) ?? 'Unknown borrower',
    kind: payment.kind,
    amountCentavos: centavos(payment.amount_centavos),
    paidOn: dateIso(payment.paid_on),
    createdAt: timestampIso(payment.created_at),
  }))

  return {
    reportingDate,
    principalRecordedCentavos,
    interestRecordedCentavos,
    totalPayableCentavos,
    collectedInPeriodCentavos,
    collectedTodayCentavos,
    collectedOnDateCentavos,
    outstandingTodayCentavos,
    outstandingExcludedCount,
    activeCount,
    overdueCount,
    expectedTodayCentavos,
    expectedOnDateCentavos,
    sixMonthChart,
    recentActivity,
    unpaid,
  }
}

/** PostgreSQL bigint values may arrive as decimal strings through either backend. */
function centavos(value: unknown): number {
  if (value === null || value === undefined) return 0
  const parsed = typeof value === 'number' ? value : Number(value)
  if (!Number.isSafeInteger(parsed)) throw new Error('Centavo value is outside JavaScript safe-integer range')
  return parsed
}

function sum(values: unknown[]) {
  return values.reduce<number>((total, value) => total + centavos(value), 0)
}

function monthStartIso(iso: string) {
  return `${iso.slice(0, 7)}-01`
}

function addMonthsIso(iso: string, delta: number) {
  const parts = iso.split('-').map(Number)
  const date = new Date(Date.UTC(parts[0] ?? 0, (parts[1] ?? 1) - 1 + delta, 1))
  return date.toISOString().slice(0, 10)
}

/** Native Postgres returns date columns as Date objects; Supabase returns YYYY-MM-DD strings. */
function dateIso(value: unknown): string {
  if (value instanceof Date) {
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila' }).format(value)
  }
  if (typeof value === 'string') return value.slice(0, 10)
  throw new Error('Payment date is invalid')
}

function timestampIso(value: unknown): string {
  if (value instanceof Date) return value.toISOString()
  if (typeof value === 'string') return new Date(value).toISOString()
  throw new Error('Payment timestamp is invalid')
}

/**
 * The Overview "didn't pay" list: every ready loan due on `reportingDate`
 * that wasn't paid in full -- `none` (nothing collected) or `short` (paid
 * less than the day's due). `netPayments` is already reversal-aware (built
 * from the same `kind='payment' AND NOT reversed` set as the tiles above),
 * so a reversed payment puts the borrower straight back on this list with
 * no extra work.
 */
function buildUnpaidCollections(
  readyLoans: any[],
  netPayments: { loan_id: string; paid_on: unknown; amount_centavos: number | string }[],
  reportingDate: string,
  paymentWindowStart: string,
): OverviewResponse['unpaid'] {
  const collectedOnDate = new Map<string, number>()
  const lastPaidBefore = new Map<string, string>()
  for (const p of netPayments) {
    const paidOn = dateIso(p.paid_on)
    if (paidOn === reportingDate) {
      collectedOnDate.set(p.loan_id, (collectedOnDate.get(p.loan_id) ?? 0) + centavos(p.amount_centavos))
    } else if (paidOn < reportingDate) {
      const existing = lastPaidBefore.get(p.loan_id)
      if (!existing || paidOn > existing) lastPaidBefore.set(p.loan_id, paidOn)
    }
  }

  const rows: UnpaidCollectionRow[] = []
  for (const l of readyLoans) {
    if (!dueOn(l, reportingDate)) continue
    const dueCentavos = Math.min(centavos(l.daily_due_centavos), centavos(l.remaining_centavos))
    const paidCentavos = collectedOnDate.get(l.id) ?? 0
    if (paidCentavos >= dueCentavos) continue // paid in full -- not a miss

    // Scheduled (not calendar) days since the last real payment, so a
    // borrower on a Mon-Fri schedule isn't "3 days missed" over a weekend.
    // The 6-month payment window bounds the lookback -- if the last actual
    // payment predates it, `since` floors at the window start rather than
    // reporting a too-large, unverifiable number.
    const since = lastPaidBefore.has(l.id) ? addDaysIso(lastPaidBefore.get(l.id)!, 1) : dateIso(l.payment_start_on)
    const boundedSince = since < paymentWindowStart ? paymentWindowStart : since
    const daysMissed = collectionDaysBetween(boundedSince, reportingDate, l.collection_weekdays as number[])

    rows.push({
      loanId: l.id,
      borrowerDisplayName: l.borrower_display_name,
      dueCentavos,
      paidCentavos,
      remainingCentavos: centavos(l.remaining_centavos),
      daysMissed,
      bucket: paidCentavos === 0 ? 'none' : 'short',
      displayStatus: l.display_status,
    })
  }
  rows.sort((a, b) => a.borrowerDisplayName.localeCompare(b.borrowerDisplayName) || a.loanId.localeCompare(b.loanId))

  return {
    rows: rows.slice(0, UNPAID_ROW_CAP),
    noPaymentCount: rows.filter((r) => r.bucket === 'none').length,
    shortCount: rows.filter((r) => r.bucket === 'short').length,
  }
}

function buildSixMonthChart(payments: { paid_on: unknown; amount_centavos: number | string }[], sixMonthsAgo: string) {
  const bars: { month: string; collectedCentavos: number }[] = []
  for (let i = 0; i < 6; i++) {
    const month = addMonthsIso(sixMonthsAgo, i).slice(0, 7)
    bars.push({ month, collectedCentavos: 0 })
  }
  const byMonth = new Map(bars.map((b) => [b.month, b]))
  for (const p of payments) {
    const bar = byMonth.get(dateIso(p.paid_on).slice(0, 7))
    if (bar) bar.collectedCentavos += centavos(p.amount_centavos)
  }
  return bars
}
