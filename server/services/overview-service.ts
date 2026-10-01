// Two consolidated queries (all loan_summary rows, all payment_entries in
// the reporting window) instead of one query per metric -- ARAWAN is a
// single-owner app with dozens of loans, so this stays well within one
// round trip's worth of data while keeping every number consistent with
// the others (spec §2 "one query per screen" / §3 overview metrics).
import type { SupabaseClient } from '@supabase/supabase-js'
import type { OverviewResponse } from '#shared/types/api'

export async function getOverview(client: SupabaseClient, ownerId: string): Promise<OverviewResponse> {
  const today = todayIso()
  const sixMonthsAgo = addMonthsIso(today, -5) // current month + 5 prior = 6 bars

  const [{ data: loans, error: loansError }, { data: payments, error: paymentsError }] = await Promise.all([
    client.from('loan_summary').select('*').eq('owner_id', ownerId),
    client
      .from('payment_entries')
      .select('id, loan_id, kind, amount_centavos, paid_on, reverses_id, created_at')
      .eq('owner_id', ownerId)
      .gte('paid_on', monthStartIso(sixMonthsAgo)),
  ])
  if (loansError) throw loansError
  if (paymentsError) throw paymentsError

  const activeLoans = (loans ?? []).filter((l) => !l.archived_at)
  const reversedIds = new Set((payments ?? []).filter((p) => p.kind === 'reversal').map((p) => p.reverses_id))
  const netPayments = (payments ?? []).filter((p) => p.kind === 'payment' && !reversedIds.has(p.id))

  const principalRecordedCentavos = sum(activeLoans.map((l) => l.principal_centavos))
  const interestRecordedCentavos = sum(activeLoans.map((l) => l.interest_centavos))
  const totalPayableCentavos = sum(activeLoans.map((l) => l.total_payable_centavos))

  const monthStart = monthStartIso(today)
  const collectedInPeriodCentavos = sum(
    netPayments.filter((p) => p.paid_on >= monthStart).map((p) => p.amount_centavos),
  )

  const readyLoans = activeLoans.filter((l) => l.readiness === 'ready')
  const outstandingTodayCentavos = sum(readyLoans.map((l) => l.remaining_centavos))
  const outstandingExcludedCount = activeLoans.length - readyLoans.length

  const activeCount = activeLoans.filter((l) => l.display_status === 'active').length
  const overdueCount = activeLoans.filter((l) => l.display_status === 'overdue').length

  const todayWeekday = isoWeekday(today)
  const expectedTodayCentavos = sum(
    readyLoans
      .filter(
        (l) =>
          centavos(l.remaining_centavos) > 0 &&
          l.payment_start_on! <= today &&
          (l.collection_weekdays as number[]).includes(todayWeekday),
      )
      .map((l) => Math.min(centavos(l.daily_due_centavos), centavos(l.remaining_centavos))),
  )

  const sixMonthChart = buildSixMonthChart(netPayments, sixMonthsAgo)

  const recentActivity: OverviewResponse['recentActivity'] = []

  return {
    principalRecordedCentavos,
    interestRecordedCentavos,
    totalPayableCentavos,
    collectedInPeriodCentavos,
    outstandingTodayCentavos,
    outstandingExcludedCount,
    activeCount,
    overdueCount,
    expectedTodayCentavos,
    sixMonthChart,
    recentActivity,
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

function buildSixMonthChart(payments: { paid_on: string; amount_centavos: number | string }[], sixMonthsAgo: string) {
  const bars: { month: string; collectedCentavos: number }[] = []
  for (let i = 0; i < 6; i++) {
    const month = addMonthsIso(sixMonthsAgo, i).slice(0, 7)
    bars.push({ month, collectedCentavos: 0 })
  }
  const byMonth = new Map(bars.map((b) => [b.month, b]))
  for (const p of payments) {
    const bar = byMonth.get(p.paid_on.slice(0, 7))
    if (bar) bar.collectedCentavos += centavos(p.amount_centavos)
  }
  return bars
}
