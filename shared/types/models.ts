// Hand-written types matching the DB shapes (supabase/migrations/) until
// `supabase gen types` replaces app/types/database.types.ts's `unknown`
// stub against a real linked project. shared/types/* auto-imports into
// both app/ and server/ (Nuxt shared-dir convention), so this is the one
// place these shapes are defined.

export type InterestMode = 'none' | 'added' | 'included'
export type LoanReadiness = 'needs_review' | 'ready'
export type DisplayStatus = 'needs_review' | 'active' | 'overdue' | 'completed' | 'archived'
export type PaymentKind = 'payment' | 'reversal'

/** One row of the `loan_summary` view (supabase/migrations/0005_loan_summary_view.sql). */
export interface LoanSummary {
  id: string
  owner_id: string
  borrower_id: string
  borrower_display_name: string
  borrower_normalized_name: string
  borrower_archived_at: string | null
  borrower_version: number
  source_sequence: number | null
  currency: string
  principal_centavos: number | null
  daily_due_centavos: number | null
  interest_mode: InterestMode | null
  interest_centavos: number | null
  total_payable_centavos: number | null
  borrowed_on: string | null
  payment_start_on: string | null
  due_on: string | null
  legacy_completed_on: string | null
  legacy_percent_value: number | null
  collection_weekdays: number[]
  readiness: LoanReadiness
  archived_at: string | null
  source_import_row_id: string | null
  created_at: string
  updated_at: string
  version: number
  opening_collected_centavos: number
  net_payments_centavos: number
  recognized_collected_centavos: number | null
  remaining_centavos: number | null
  progress_pct: number | null
  completed_on: string | null
  display_status: DisplayStatus
  financial_terms_locked?: boolean
}

export interface PaymentEntry {
  id: string
  owner_id: string
  loan_id: string
  kind: PaymentKind
  amount_centavos: number
  paid_on: string
  reverses_id: string | null
  method: string | null
  note: string | null
  idempotency_key: string
  created_at: string
  is_reversed?: boolean
}

export interface Borrower {
  id: string
  owner_id: string
  display_name: string
  normalized_name: string
  phone: string | null
  notes: string | null
  archived_at: string | null
  created_at: string
  updated_at: string
  version: number
}

export interface Profile {
  id: string
  timezone: string
  currency: string
  default_collection_weekdays: number[]
  created_at: string
  updated_at: string
  version: number
}
