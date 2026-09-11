// Ledger reads are plain SELECTs (RLS-scoped); ledger writes always go
// through the RPCs in supabase/migrations/0006_rpc_financial.sql via
// server/utils/rpc.ts -- this file never inserts into payment_entries or
// opening_balances directly.
import type { SupabaseClient } from '@supabase/supabase-js'
import type { H3Event } from 'h3'
import type { ConfirmOpeningBalanceInput, RecordPaymentInput, ReversePaymentInput } from '#shared/schemas/payment'

export async function listPayments(
  client: SupabaseClient,
  ownerId: string,
  loanId: string,
  page: number,
  pageSize: number,
): Promise<{ rows: PaymentEntry[]; total: number }> {
  const from = (page - 1) * pageSize
  const to = from + pageSize - 1
  const { data, error, count } = await client
    .from('payment_entries')
    .select('*', { count: 'exact' })
    .eq('owner_id', ownerId)
    .eq('loan_id', loanId)
    .order('paid_on', { ascending: false })
    .order('id', { ascending: false })
    .range(from, to)
  if (error) throw error

  // Mark which payments have a linked reversal so the ledger UI can show
  // "reversed" without a second round trip per row.
  const reversalTargets = new Set(
    (data ?? []).filter((row) => row.kind === 'reversal' && row.reverses_id).map((row) => row.reverses_id as string),
  )
  const rows = (data ?? []).map((row) => ({ ...row, is_reversed: reversalTargets.has(row.id) }))
  return { rows, total: count ?? 0 }
}

export async function recordPayment(event: H3Event, client: SupabaseClient, loanId: string, input: RecordPaymentInput): Promise<LoanSummary> {
  // PostgREST can't infer a type for a JSON `null` against an RPC's named
  // parameter and fails the whole call with 42883 (undefined_function) --
  // confirmed against the real project. Omit optional keys entirely
  // instead of sending null; the SQL-level DEFAULT NULL takes over
  // (supabase/migrations/0008_optional_rpc_arg_defaults.sql).
  const args: Record<string, unknown> = {
    p_loan_id: loanId,
    p_amount_centavos: input.amountCentavos,
    p_paid_on: input.paidOn,
    p_idempotency_key: input.idempotencyKey,
  }
  if (input.method) args.p_method = input.method
  if (input.note) args.p_note = input.note
  return callRpc<LoanSummary>(event, client, 'record_payment', args)
}

export async function reversePayment(event: H3Event, client: SupabaseClient, paymentId: string, input: ReversePaymentInput): Promise<LoanSummary> {
  return callRpc<LoanSummary>(event, client, 'reverse_payment', {
    p_payment_id: paymentId,
    p_reason: input.reason,
    p_idempotency_key: input.idempotencyKey,
  })
}

export async function confirmOpeningBalance(
  event: H3Event,
  client: SupabaseClient,
  loanId: string,
  input: ConfirmOpeningBalanceInput,
) {
  return callRpc<LoanSummary>(event, client, 'confirm_opening_balance', {
    p_loan_id: loanId,
    p_collected_centavos: input.collectedCentavos,
    p_as_of: input.asOf,
    p_reason: input.reason,
  })
}
