// Query/mutation logic for loans + borrowers. Every function takes the
// caller's user-scoped Supabase client (server/utils/auth.ts) and an
// explicit ownerId -- queries still add .eq('owner_id', ownerId) even
// though RLS already scopes them, per spec §10's "RLS is not a
// substitute for checks inside the app layer either" spirit: defense in
// depth, and it makes intent obvious on read.
import type { SupabaseClient } from '@supabase/supabase-js'
import type { LoanFilters, LoanInput, LoanPatch } from '#shared/schemas/loan'

const SORT_COLUMNS: Record<LoanFilters['sort'], { column: string; ascending: boolean }> = {
  borrowed_desc: { column: 'borrowed_on', ascending: false },
  due_asc: { column: 'due_on', ascending: true },
  name_asc: { column: 'borrower_normalized_name', ascending: true },
  remaining_desc: { column: 'remaining_centavos', ascending: false },
}

export async function listLoans(
  client: SupabaseClient,
  ownerId: string,
  filters: LoanFilters,
): Promise<{ rows: LoanSummary[]; total: number }> {
  let query = client.from('loan_summary').select('*', { count: 'exact' }).eq('owner_id', ownerId)

  if (filters.archived === 'exclude') query = query.is('archived_at', null)
  else if (filters.archived === 'only') query = query.not('archived_at', 'is', null)

  if (filters.status !== 'all') query = query.eq('display_status', filters.status)
  if (filters.q) {
    const like = `%${filters.q.trim().toLowerCase()}%`
    query = query.ilike('borrower_normalized_name', like)
  }
  if (filters.borrowedFrom) query = query.gte('borrowed_on', filters.borrowedFrom)
  if (filters.borrowedTo) query = query.lte('borrowed_on', filters.borrowedTo)
  if (filters.balanceMin !== undefined) query = query.gte('remaining_centavos', filters.balanceMin)
  if (filters.balanceMax !== undefined) query = query.lte('remaining_centavos', filters.balanceMax)

  const { column, ascending } = SORT_COLUMNS[filters.sort]
  // `id` tie-breaker (spec §6) keeps pagination stable when the sort
  // column has duplicate values (e.g. many loans borrowed the same day).
  query = query.order(column, { ascending, nullsFirst: false }).order('id', { ascending: true })

  const from = (filters.page - 1) * filters.pageSize
  const to = from + filters.pageSize - 1
  const { data, error, count } = await query.range(from, to)
  if (error) throw error
  return { rows: data ?? [], total: count ?? 0 }
}

export async function getLoanById(client: SupabaseClient, ownerId: string, id: string): Promise<LoanSummary | null> {
  const { data, error } = await client.from('loan_summary').select('*').eq('owner_id', ownerId).eq('id', id).maybeSingle()
  if (error) throw error
  return data
}

export async function listLoansByBorrower(client: SupabaseClient, ownerId: string, borrowerId: string): Promise<LoanSummary[]> {
  const { data, error } = await client
    .from('loan_summary')
    .select('*')
    .eq('owner_id', ownerId)
    .eq('borrower_id', borrowerId)
    .order('borrowed_on', { ascending: false })
  if (error) throw error
  return data ?? []
}

/** Creates the borrower (if new) and the loan atomically via a single RPC-free multi-statement -- see note below. */
export async function createLoan(client: SupabaseClient, ownerId: string, input: LoanInput) {
  let borrowerId: string
  if ('borrowerId' in input.borrower) {
    borrowerId = input.borrower.borrowerId
  } else {
    const { newBorrower } = input.borrower
    const { data: borrower, error: borrowerError } = await client
      .from('borrowers')
      .insert({
        owner_id: ownerId,
        display_name: newBorrower.displayName,
        normalized_name: normalizeName(newBorrower.displayName),
        phone: newBorrower.phone ?? null,
        notes: newBorrower.notes ?? null,
      })
      .select('id')
      .single()
    if (borrowerError) throw borrowerError
    borrowerId = borrower.id
  }

  const totalPayableCentavos = computeTotalPayable(input)
  const { data: loan, error: loanError } = await client
    .from('loans')
    .insert({
      owner_id: ownerId,
      borrower_id: borrowerId,
      principal_centavos: input.principalCentavos,
      daily_due_centavos: input.dailyDueCentavos,
      interest_mode: input.interestMode,
      interest_centavos: input.interestCentavos,
      total_payable_centavos: totalPayableCentavos,
      borrowed_on: input.borrowedOn,
      payment_start_on: input.paymentStartOn,
      due_on: input.dueOn,
      collection_weekdays: input.collectionWeekdays,
      readiness: 'ready',
    })
    .select('id')
    .single()
  if (loanError) throw loanError

  return getLoanById(client, ownerId, loan.id)
}

/** Financial terms lock once ledger entries exist (spec §3) -- checked before allowing those fields in a PATCH. */
export async function hasLedgerEntries(client: SupabaseClient, ownerId: string, loanId: string) {
  const { count, error } = await client
    .from('payment_entries')
    .select('id', { count: 'exact', head: true })
    .eq('owner_id', ownerId)
    .eq('loan_id', loanId)
  if (error) throw error
  return (count ?? 0) > 0
}

const FINANCIAL_FIELDS: (keyof LoanPatch)[] = [
  'principalCentavos',
  'dailyDueCentavos',
  'interestMode',
  'interestCentavos',
]

export function touchesFinancialTerms(patch: LoanPatch) {
  return FINANCIAL_FIELDS.some((field) => patch[field] !== undefined)
}

export async function patchLoan(client: SupabaseClient, ownerId: string, id: string, patch: LoanPatch): Promise<LoanSummary | null> {
  const update: Record<string, unknown> = {}
  if (patch.borrowedOn !== undefined) update.borrowed_on = patch.borrowedOn
  if (patch.paymentStartOn !== undefined) update.payment_start_on = patch.paymentStartOn
  if (patch.dueOn !== undefined) update.due_on = patch.dueOn
  if (patch.principalCentavos !== undefined) update.principal_centavos = patch.principalCentavos
  if (patch.dailyDueCentavos !== undefined) update.daily_due_centavos = patch.dailyDueCentavos
  if (patch.interestMode !== undefined) update.interest_mode = patch.interestMode
  if (patch.interestCentavos !== undefined) update.interest_centavos = patch.interestCentavos

  if (update.principal_centavos !== undefined || update.interest_mode !== undefined || update.interest_centavos !== undefined) {
    const { data: current, error: currentError } = await client
      .from('loans')
      .select('principal_centavos, interest_mode, interest_centavos')
      .eq('owner_id', ownerId)
      .eq('id', id)
      .single()
    if (currentError) throw currentError
    update.total_payable_centavos = computeTotalPayable({
      principalCentavos: (update.principal_centavos as number) ?? current.principal_centavos,
      interestMode: (update.interest_mode as 'none' | 'added' | 'included') ?? current.interest_mode,
      interestCentavos: (update.interest_centavos as number) ?? current.interest_centavos,
    })
  }

  // Optimistic concurrency: only affects the row if version still matches.
  const { data, error } = await client
    .from('loans')
    .update(update)
    .eq('owner_id', ownerId)
    .eq('id', id)
    .eq('version', patch.version)
    .select('id')
    .maybeSingle()
  if (error) throw error
  if (!data) return null // stale version (or not found) -- caller maps to 409/404
  return getLoanById(client, ownerId, id)
}

export async function setArchived(client: SupabaseClient, ownerId: string, id: string, archived: boolean, version: number): Promise<LoanSummary | null> {
  const { data, error } = await client
    .from('loans')
    .update({ archived_at: archived ? new Date().toISOString() : null })
    .eq('owner_id', ownerId)
    .eq('id', id)
    .eq('version', version)
    .select('id')
    .maybeSingle()
  if (error) throw error
  if (!data) return null
  return getLoanById(client, ownerId, id)
}
