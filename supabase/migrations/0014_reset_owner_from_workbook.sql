-- Development-only replacement of one owner's records with validated
-- workbook rows. Execute through the linked database CLI as postgres.
create or replace function public.reset_owner_from_workbook(p_owner_email text, p_rows jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_owner uuid;
  v_count integer;
  v_principal bigint;
  v_daily bigint;
  v_interest bigint;
begin
  select id into v_owner from auth.users where lower(email) = lower(p_owner_email);
  if v_owner is null then
    raise exception 'Configured owner was not found';
  end if;
  if jsonb_typeof(p_rows) <> 'array' then
    raise exception 'Workbook rows must be a JSON array';
  end if;

  create temporary table workbook_reset_rows (
    source_sequence integer primary key,
    display_name text not null,
    normalized_name text not null,
    borrowed_on date not null,
    payment_start_on date not null,
    completed_on date not null,
    principal_centavos bigint not null check (principal_centavos > 0),
    daily_due_centavos bigint not null check (daily_due_centavos > 0),
    interest_centavos bigint not null check (interest_centavos >= 0),
    needs_review boolean not null
  ) on commit drop;

  insert into workbook_reset_rows
  select * from jsonb_to_recordset(p_rows) as r(
    source_sequence integer, display_name text, normalized_name text,
    borrowed_on date, payment_start_on date, completed_on date,
    principal_centavos bigint, daily_due_centavos bigint,
    interest_centavos bigint, needs_review boolean
  );

  select count(*), sum(principal_centavos), sum(daily_due_centavos), sum(interest_centavos)
    into v_count, v_principal, v_daily, v_interest from workbook_reset_rows;
  if v_count <> 42 or (select count(distinct source_sequence) from workbook_reset_rows) <> 42
    or (select min(source_sequence) from workbook_reset_rows) <> 1
    or (select max(source_sequence) from workbook_reset_rows) <> 42
    or v_principal <> 32150000 or v_daily <> 643000 or v_interest <> 5930000 then
    raise exception 'Workbook validation failed: expected 42 rows and verified row-level totals';
  end if;

  -- Break the loans/import_rows reference cycle before removing old imports.
  update public.loans set source_import_row_id = null where owner_id = v_owner;
  delete from public.payment_entries where owner_id = v_owner;
  delete from public.opening_balances where owner_id = v_owner;
  delete from public.import_rows where owner_id = v_owner;
  delete from public.import_batches where owner_id = v_owner;
  delete from public.loans where owner_id = v_owner;
  delete from public.borrowers where owner_id = v_owner;
  delete from public.audit_events where owner_id = v_owner;
  delete from public.mutation_requests where owner_id = v_owner;

  insert into public.borrowers (owner_id, display_name, normalized_name)
  select v_owner, display_name, normalized_name
  from workbook_reset_rows
  group by display_name, normalized_name;

  insert into public.loans (
    owner_id, borrower_id, source_sequence, principal_centavos, daily_due_centavos,
    interest_mode, interest_centavos, total_payable_centavos, borrowed_on,
    payment_start_on, due_on, legacy_completed_on, legacy_percent_value,
    readiness, archived_at
  )
  select v_owner, b.id, r.source_sequence, r.principal_centavos, r.daily_due_centavos,
    case when r.interest_centavos > 0 then 'added'::public.loan_interest_mode else 'none'::public.loan_interest_mode end,
    r.interest_centavos, r.principal_centavos + r.interest_centavos,
    r.borrowed_on, r.payment_start_on, r.completed_on, r.completed_on,
    r.interest_centavos, case when r.needs_review then 'needs_review'::public.loan_readiness else 'ready'::public.loan_readiness end,
    null
  from workbook_reset_rows r
  join public.borrowers b on b.owner_id = v_owner and b.display_name = r.display_name;

  return jsonb_build_object(
    'loan_count', v_count,
    'borrower_count', (select count(*) from public.borrowers where owner_id = v_owner),
    'principal_centavos', v_principal,
    'daily_centavos', v_daily,
    'interest_centavos', v_interest,
    'review_count', (select count(*) from workbook_reset_rows where needs_review)
  );
end;
$$;

revoke all on function public.reset_owner_from_workbook(text, jsonb) from public, anon, authenticated;
