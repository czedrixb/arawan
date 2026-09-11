-- Targeted database checks that Playwright cannot express: cross-owner
-- denial and idempotent-payment locking (spec §14 Phase 3). Run with
-- `supabase test db` (pgTAP) once the project is linked. These are
-- deliberately narrow -- they supplement, not replace, tests/e2e/04-ledger.
--
-- Requires the `supabase_test_helpers` extension (provides tests.*):
--   select dbdev.install('basejump-supabase_test_helpers');
--   create extension if not exists "basejump-supabase_test_helpers";
-- See https://github.com/usebasejump/supabase-test-helpers

begin;
select plan(6);

-- Two owners, one loan each, to prove no query can cross the boundary.
select tests.create_supabase_user('owner_a');
select tests.create_supabase_user('owner_b');

select tests.authenticate_as('owner_a');
insert into public.borrowers (id, owner_id, display_name, normalized_name)
values ('11111111-1111-1111-1111-111111111111', tests.get_supabase_uid('owner_a'), 'Borrower A', 'borrower a');
insert into public.loans (
  id, owner_id, borrower_id, principal_centavos, daily_due_centavos, interest_mode,
  total_payable_centavos, borrowed_on, payment_start_on, due_on, readiness
) values (
  '22222222-2222-2222-2222-222222222222', tests.get_supabase_uid('owner_a'),
  '11111111-1111-1111-1111-111111111111', 500000, 10000, 'none',
  500000, current_date, current_date, current_date + 49, 'ready'
);

-- 1. Owner B cannot see Owner A's loan via loan_summary (RLS select).
select tests.authenticate_as('owner_b');
select is(
  (select count(*) from public.loan_summary where id = '22222222-2222-2222-2222-222222222222'),
  0::bigint,
  'owner_b cannot see owner_a loan through loan_summary'
);

-- 2. Owner B calling record_payment on Owner A's loan gets not-found, not
--    a cross-owner write.
select throws_like(
  $$ select public.record_payment('22222222-2222-2222-2222-222222222222'::uuid, 10000, current_date, null, null, gen_random_uuid()) $$,
  '%not found%',
  'owner_b cannot record a payment against owner_a loan'
);

-- 3. Owner A can pay their own loan.
select tests.authenticate_as('owner_a');
select ok(
  (select remaining_centavos from public.record_payment(
    '22222222-2222-2222-2222-222222222222'::uuid, 10000, current_date, null, null, gen_random_uuid()
  )) = 490000,
  'owner_a payment reduces remaining by the paid amount'
);

-- 4. Same idempotency key + same payload replays without a second insert.
select tests.authenticate_as('owner_a');
do $$
declare
  v_key uuid := gen_random_uuid();
  v_first public.loan_summary;
  v_second public.loan_summary;
begin
  v_first := public.record_payment('22222222-2222-2222-2222-222222222222'::uuid, 5000, current_date, null, null, v_key);
  v_second := public.record_payment('22222222-2222-2222-2222-222222222222'::uuid, 5000, current_date, null, null, v_key);
  if v_first.remaining_centavos <> v_second.remaining_centavos then
    raise exception 'idempotent replay changed the balance';
  end if;
end;
$$;
select is(
  (select count(*) from public.payment_entries where loan_id = '22222222-2222-2222-2222-222222222222' and amount_centavos = 5000),
  1::bigint,
  'duplicate idempotency key does not insert a second payment'
);

-- 5. Same idempotency key + different payload is rejected (409-mapped).
select throws_like(
  $$ select public.record_payment('22222222-2222-2222-2222-222222222222'::uuid, 9999, current_date, null, null,
     (select idempotency_key from public.payment_entries where amount_centavos = 5000 limit 1)) $$,
  '%different%',
  'reusing an idempotency key with a different payload is rejected'
);

-- 6. Amount above remaining balance is rejected.
select throws_like(
  $$ select public.record_payment('22222222-2222-2222-2222-222222222222'::uuid, 999999999, current_date, null, null, gen_random_uuid()) $$,
  '%exceeds%',
  'overpayment is rejected'
);

select * from finish();
rollback;
