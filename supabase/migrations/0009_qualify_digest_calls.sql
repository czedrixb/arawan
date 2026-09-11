-- pgcrypto installed into the `extensions` schema on this project, not
-- `public` (confirmed: select nspname from pg_extension where extname =
-- 'pgcrypto' -> 'extensions'). record_payment/reverse_payment's locked-
-- down `search_path = public, pg_temp` -- a deliberate hardening against
-- search-path hijacking -- excludes it, so the bare `digest(...)` call
-- fails with 42883 "function digest(text, unknown) does not exist" on
-- every real payment/reversal. Fully-qualifying the call is more robust
-- than adding `extensions` to search_path: it doesn't depend on where a
-- given project happens to have installed the extension.
create or replace function public.record_payment(
  p_loan_id uuid,
  p_amount_centavos bigint,
  p_paid_on date,
  p_idempotency_key uuid,
  p_method text default null,
  p_note text default null
)
returns public.loan_summary
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_owner uuid := auth.uid();
  v_loan public.loans;
  v_remaining bigint;
  v_opening_as_of date;
  v_payload jsonb;
  v_payload_hash text;
  v_mutation_id uuid;
  v_cached_response jsonb;
  v_result public.loan_summary;
begin
  if v_owner is null then
    raise exception using errcode = 'ARW01', message = 'Not authenticated';
  end if;

  select * into v_loan from public.loans
    where id = p_loan_id and owner_id = v_owner
    for update;
  if not found then
    raise exception using errcode = 'ARW04', message = 'Loan not found';
  end if;

  if v_loan.readiness <> 'ready' then
    raise exception using errcode = 'ARW22', message = 'Loan terms are not resolved (needs review)';
  end if;

  if p_amount_centavos is null or p_amount_centavos <= 0 then
    raise exception using errcode = 'ARW22', message = 'Payment amount must be positive';
  end if;

  select as_of into v_opening_as_of from public.opening_balances
    where owner_id = v_owner and loan_id = p_loan_id
    order by created_at desc limit 1;
  if v_opening_as_of is not null and p_paid_on <= v_opening_as_of then
    raise exception using errcode = 'ARW22',
      message = format('Payment date must be after the opening balance as-of date (%s)', v_opening_as_of);
  end if;

  select remaining_centavos into v_remaining from public.loan_summary where id = p_loan_id and owner_id = v_owner;
  if v_remaining is null then
    raise exception using errcode = 'ARW22', message = 'Loan balance is not resolved';
  end if;

  v_payload := jsonb_build_object(
    'loan_id', p_loan_id, 'amount_centavos', p_amount_centavos,
    'paid_on', p_paid_on, 'method', p_method, 'note', p_note
  );
  v_payload_hash := encode(extensions.digest(v_payload::text, 'sha256'), 'hex');

  insert into public.mutation_requests (owner_id, operation, idempotency_key, payload_hash, response_json)
    values (v_owner, 'record_payment', p_idempotency_key, v_payload_hash, null)
  on conflict (owner_id, operation, idempotency_key)
    do update set id = mutation_requests.id
    where mutation_requests.payload_hash = excluded.payload_hash
  returning id, response_json into v_mutation_id, v_cached_response;

  if v_mutation_id is null then
    raise exception using errcode = 'ARW09',
      message = 'This idempotency key was already used with different payment details';
  end if;

  if v_cached_response is not null then
    select * into v_result from public.loan_summary where id = p_loan_id and owner_id = v_owner;
    return v_result;
  end if;

  if p_amount_centavos > v_remaining then
    raise exception using errcode = 'ARW22',
      message = format('Amount exceeds the remaining balance of %s centavos', v_remaining);
  end if;

  insert into public.payment_entries (owner_id, loan_id, kind, amount_centavos, paid_on, method, note, idempotency_key)
    values (v_owner, p_loan_id, 'payment', p_amount_centavos, p_paid_on, p_method, p_note, p_idempotency_key);

  insert into public.audit_events (owner_id, actor_id, entity_type, entity_id, action, after_json, request_id)
    values (v_owner, v_owner, 'loan', p_loan_id, 'record_payment', v_payload, p_idempotency_key);

  select * into v_result from public.loan_summary where id = p_loan_id and owner_id = v_owner;

  update public.mutation_requests set response_json = to_jsonb(v_result)
    where mutation_requests.id = v_mutation_id;

  return v_result;
end;
$$;

create or replace function public.reverse_payment(
  p_payment_id uuid,
  p_reason text,
  p_idempotency_key uuid
)
returns public.loan_summary
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_owner uuid := auth.uid();
  v_payment public.payment_entries;
  v_loan public.loans;
  v_payload jsonb;
  v_payload_hash text;
  v_mutation_id uuid;
  v_cached_response jsonb;
  v_result public.loan_summary;
begin
  if v_owner is null then
    raise exception using errcode = 'ARW01', message = 'Not authenticated';
  end if;

  if p_reason is null or btrim(p_reason) = '' then
    raise exception using errcode = 'ARW22', message = 'A reversal reason is required';
  end if;

  select * into v_payment from public.payment_entries
    where id = p_payment_id and owner_id = v_owner and kind = 'payment'
    for update;
  if not found then
    raise exception using errcode = 'ARW04', message = 'Payment not found';
  end if;

  select * into v_loan from public.loans
    where id = v_payment.loan_id and owner_id = v_owner
    for update;

  if exists (select 1 from public.payment_entries where owner_id = v_owner and reverses_id = v_payment.id) then
    raise exception using errcode = 'ARW09', message = 'This payment has already been reversed';
  end if;

  v_payload := jsonb_build_object('payment_id', p_payment_id, 'reason', p_reason);
  v_payload_hash := encode(extensions.digest(v_payload::text, 'sha256'), 'hex');

  insert into public.mutation_requests (owner_id, operation, idempotency_key, payload_hash, response_json)
    values (v_owner, 'reverse_payment', p_idempotency_key, v_payload_hash, null)
  on conflict (owner_id, operation, idempotency_key)
    do update set id = mutation_requests.id
    where mutation_requests.payload_hash = excluded.payload_hash
  returning id, response_json into v_mutation_id, v_cached_response;

  if v_mutation_id is null then
    raise exception using errcode = 'ARW09',
      message = 'This idempotency key was already used with a different reversal request';
  end if;

  if v_cached_response is not null then
    select * into v_result from public.loan_summary where id = v_loan.id and owner_id = v_owner;
    return v_result;
  end if;

  insert into public.payment_entries (owner_id, loan_id, kind, amount_centavos, paid_on, reverses_id, note, idempotency_key)
    values (v_owner, v_payment.loan_id, 'reversal', v_payment.amount_centavos,
            (now() at time zone 'Asia/Manila')::date, v_payment.id, p_reason, p_idempotency_key);

  insert into public.audit_events (owner_id, actor_id, entity_type, entity_id, action, before_json, reason, request_id)
    values (v_owner, v_owner, 'loan', v_loan.id, 'reverse_payment', to_jsonb(v_payment), p_reason, p_idempotency_key);

  select * into v_result from public.loan_summary where id = v_loan.id and owner_id = v_owner;

  update public.mutation_requests set response_json = to_jsonb(v_result)
    where mutation_requests.id = v_mutation_id;

  return v_result;
end;
$$;
