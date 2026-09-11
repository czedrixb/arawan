-- ARAWAN §10/§11: RLS policies + role grants. Two independent layers:
--   1. RLS: auth.uid() = owner_id, both USING and WITH CHECK, on every row.
--   2. GRANT/REVOKE: the ledger tables get NO client write grant at all --
--      the RPCs in 0006 are the only path, and they run as the table
--      owner (bypassing RLS by table-owner exemption), so they re-check
--      owner_id = auth.uid() explicitly in every statement themselves.
-- Anon gets nothing anywhere; public signup stays disabled (dashboard
-- setting, not something a migration can express).

revoke all on all tables in schema public from anon;
revoke all on all tables in schema public from public;

-- profiles: read/update own row; no client insert/delete (provisioned by
-- supabase/seed-owner.sql using the service role).
create policy "profiles_select_own" on public.profiles
  for select using (auth.uid() = id);
create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);
grant select, update on public.profiles to authenticated;

-- borrowers: full CRUD except delete (append-only; archive via update).
create policy "borrowers_select_own" on public.borrowers
  for select using (auth.uid() = owner_id);
create policy "borrowers_insert_own" on public.borrowers
  for insert with check (auth.uid() = owner_id);
create policy "borrowers_update_own" on public.borrowers
  for update using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
grant select, insert, update on public.borrowers to authenticated;

-- loans: full CRUD except delete. Field-level restrictions (e.g. "cannot
-- edit financial terms once ledger entries exist") are enforced by the
-- PATCH handler in server/api/loans/[id].patch.ts, not by RLS.
create policy "loans_select_own" on public.loans
  for select using (auth.uid() = owner_id);
create policy "loans_insert_own" on public.loans
  for insert with check (auth.uid() = owner_id);
create policy "loans_update_own" on public.loans
  for update using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
grant select, insert, update on public.loans to authenticated;

-- loan_summary is security_invoker, so it inherits the loans SELECT policy
-- above automatically -- it just needs its own SELECT grant on the view.
grant select on public.loan_summary to authenticated;

-- Ledger + audit + idempotency tables: SELECT only. No INSERT/UPDATE/DELETE
-- grant exists for `authenticated` at all -- only the SECURITY DEFINER
-- RPCs (owned by the migration role) can write these.
create policy "opening_balances_select_own" on public.opening_balances
  for select using (auth.uid() = owner_id);
grant select on public.opening_balances to authenticated;

create policy "payment_entries_select_own" on public.payment_entries
  for select using (auth.uid() = owner_id);
grant select on public.payment_entries to authenticated;

create policy "audit_events_select_own" on public.audit_events
  for select using (auth.uid() = owner_id);
grant select on public.audit_events to authenticated;

-- mutation_requests holds idempotency bookkeeping only; the owner never
-- needs to read it directly, so no SELECT policy/grant is added.

-- import_batches / import_rows: SELECT only this pass (import history is
-- a phase-4 UI concern); all writes go through commit_import in phase 4.
create policy "import_batches_select_own" on public.import_batches
  for select using (auth.uid() = owner_id);
grant select on public.import_batches to authenticated;

create policy "import_rows_select_own" on public.import_rows
  for select using (auth.uid() = owner_id);
grant select on public.import_rows to authenticated;

-- RPC execute grants: authenticated only. CREATE FUNCTION defaults to
-- granting EXECUTE to PUBLIC -- revoke that explicitly for every RPC.
revoke execute on function public.record_payment(uuid, bigint, date, text, text, uuid) from public;
grant execute on function public.record_payment(uuid, bigint, date, text, text, uuid) to authenticated;

revoke execute on function public.reverse_payment(uuid, text, uuid) from public;
grant execute on function public.reverse_payment(uuid, text, uuid) to authenticated;

revoke execute on function public.confirm_opening_balance(uuid, bigint, date, text) from public;
grant execute on function public.confirm_opening_balance(uuid, bigint, date, text) to authenticated;

revoke execute on function public.commit_import(uuid) from public;
grant execute on function public.commit_import(uuid) to authenticated;
