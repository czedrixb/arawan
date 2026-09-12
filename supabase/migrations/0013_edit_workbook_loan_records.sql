-- Keep the workbook-style record edit atomic across borrower and loan rows.
create or replace function public.edit_loan_record(
  p_loan_id uuid,
  p_loan_version integer,
  p_borrower_version integer,
  p_display_name text,
  p_normalized_name text,
  p_borrowed_on date,
  p_payment_start_on date,
  p_due_on date,
  p_principal_centavos bigint,
  p_daily_due_centavos bigint,
  p_interest_centavos bigint
)
returns public.loan_summary
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_owner uuid := auth.uid();
  v_loan public.loans;
  v_borrower public.borrowers;
  v_result public.loan_summary;
  v_financial_changed boolean;
begin
  if v_owner is null then
    raise exception using errcode = 'ARW01', message = 'Not authenticated';
  end if;
  if p_display_name is null or btrim(p_display_name) = '' then
    raise exception using errcode = 'ARW22', message = 'Borrower name is required';
  end if;

  select * into v_loan from public.loans
    where id = p_loan_id and owner_id = v_owner for update;
  if not found then
    raise exception using errcode = 'ARW04', message = 'Loan not found';
  end if;
  if v_loan.version <> p_loan_version then
    raise exception using errcode = 'ARW09', message = 'This loan changed since it was loaded';
  end if;

  select * into v_borrower from public.borrowers
    where id = v_loan.borrower_id and owner_id = v_owner for update;
  if not found then
    raise exception using errcode = 'ARW04', message = 'Borrower not found';
  end if;
  if v_borrower.version <> p_borrower_version then
    raise exception using errcode = 'ARW09', message = 'This borrower changed since it was loaded';
  end if;

  v_financial_changed :=
    v_loan.principal_centavos is distinct from p_principal_centavos or
    v_loan.daily_due_centavos is distinct from p_daily_due_centavos or
    v_loan.interest_centavos is distinct from p_interest_centavos;
  if v_financial_changed and (
    exists (select 1 from public.payment_entries where owner_id = v_owner and loan_id = p_loan_id)
    or exists (select 1 from public.opening_balances where owner_id = v_owner and loan_id = p_loan_id)
  ) then
    raise exception using errcode = 'ARW22', message = 'Financial terms are locked once payments or an opening balance exist';
  end if;

  if v_borrower.display_name is distinct from btrim(p_display_name) then
    update public.borrowers
      set display_name = btrim(p_display_name),
          normalized_name = p_normalized_name
      where id = v_borrower.id and owner_id = v_owner;
  end if;

  update public.loans
  set borrowed_on = p_borrowed_on,
      payment_start_on = p_payment_start_on,
      due_on = p_due_on,
      principal_centavos = p_principal_centavos,
      daily_due_centavos = p_daily_due_centavos,
      interest_mode = case when p_interest_centavos > 0 then 'added'::public.loan_interest_mode else 'none'::public.loan_interest_mode end,
      interest_centavos = p_interest_centavos,
      total_payable_centavos = p_principal_centavos + p_interest_centavos,
      readiness = case when p_payment_start_on >= p_borrowed_on and p_due_on >= p_payment_start_on
        then 'ready'::public.loan_readiness else 'needs_review'::public.loan_readiness end
  where id = p_loan_id and owner_id = v_owner;

  insert into public.audit_events (owner_id, actor_id, entity_type, entity_id, action, before_json, after_json)
  values (
    v_owner, v_owner, 'loan', p_loan_id, 'edit_workbook_record', to_jsonb(v_loan),
    jsonb_build_object(
      'display_name', btrim(p_display_name), 'borrowed_on', p_borrowed_on,
      'payment_start_on', p_payment_start_on, 'due_on', p_due_on,
      'principal_centavos', p_principal_centavos, 'daily_due_centavos', p_daily_due_centavos,
      'interest_centavos', p_interest_centavos
    )
  );

  select * into v_result from public.loan_summary where id = p_loan_id and owner_id = v_owner;
  return v_result;
end;
$$;

revoke all on function public.edit_loan_record(uuid, integer, integer, text, text, date, date, date, bigint, bigint, bigint) from public;
grant execute on function public.edit_loan_record(uuid, integer, integer, text, text, date, date, date, bigint, bigint, bigint) to authenticated;
