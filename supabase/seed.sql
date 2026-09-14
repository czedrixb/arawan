-- ARAWAN local-only seed. Applied by `supabase db reset` / first
-- `supabase start` (see [db.seed] in supabase/config.toml) against the
-- LOCAL stack only -- `supabase db push` never runs seed files at all, and
-- scripts/guard-remote.mjs blocks every remote-targeting CLI command
-- regardless. This file has no business anywhere near production.
--
-- Provisions the single owner account end-to-end (auth.users, the matching
-- auth.identities row, and public.profiles) with no dashboard step, plus a
-- handful of fixture borrowers/loans so the Records page has something to
-- show and to page through. This is the local counterpart to
-- supabase/seed-owner.sql, which stays the right tool for a hosted project
-- (there the auth user is created by hand in the dashboard, so its id isn't
-- known ahead of time; here we control it, so we can hardcode it).
--
-- Sign in locally with: owner@arawan.local / arawan-local-dev
--
-- Idempotent: `supabase db reset` runs this against a freshly-recreated
-- database every time, but `supabase start` on an existing volume re-runs
-- seeds too, so every insert below is written to survive a second run.
set search_path = public, extensions;

-- ---------------------------------------------------------------------------
-- 1. auth.users
--
-- GoTrue reads several of these text columns as non-nullable strings --
-- confirmation_token, recovery_token, the email/phone change token columns,
-- and reauthentication_token all need to be '' rather than NULL, or
-- POST /auth/v1/token?grant_type=password fails with a generic 500
-- ("converting NULL to string is unsupported"). tests/e2e/global-setup.ts
-- would then silently write an empty session and every authenticated spec
-- would self-skip without any visible error -- do not "clean up" these to
-- NULL.
--
-- email_confirmed_at is set explicitly: [auth.email] enable_confirmations =
-- false in supabase/config.toml only skips SENDING the confirmation email,
-- GoTrue still refuses to sign in an unconfirmed user otherwise.
--
-- confirmed_at is NOT listed -- it's a generated column
-- (least(email_confirmed_at, phone_confirmed_at)) and inserting into it
-- errors.
-- ---------------------------------------------------------------------------
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, confirmation_token, recovery_token,
  email_change_token_new, email_change, email_change_token_current,
  phone_change, phone_change_token, reauthentication_token,
  raw_app_meta_data, raw_user_meta_data, is_super_admin,
  created_at, updated_at
) values (
  '00000000-0000-0000-0000-000000000000',
  'a0000000-0000-4000-8000-00000000a001',
  'authenticated',
  'authenticated',
  'owner@arawan.local',
  crypt('arawan-local-dev', gen_salt('bf')),
  now(),
  '', '', '', '', '', '', '', '',
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{}'::jsonb,
  false,
  now(), now()
)
on conflict (id) do update set
  email = excluded.email,
  encrypted_password = excluded.encrypted_password,
  email_confirmed_at = excluded.email_confirmed_at,
  banned_until = null,
  deleted_at = null,
  updated_at = now();

-- ---------------------------------------------------------------------------
-- 2. auth.identities -- required for password sign-in to succeed at all;
-- without a matching `email` provider row GoTrue returns "Invalid login
-- credentials" even though the password hash above is correct.
-- identity_data.sub is what ends up as the JWT's `sub` claim, which is what
-- auth.uid() returns, which is what every RLS policy compares owner_id
-- against (supabase/migrations/0007_rls_grants.sql) -- it must match the
-- user id above exactly.
--
-- `email` is not listed -- it's a generated column
-- (lower(identity_data ->> 'email')).
-- ---------------------------------------------------------------------------
insert into auth.identities (
  id, user_id, provider_id, identity_data, provider,
  last_sign_in_at, created_at, updated_at
) values (
  'a0000000-0000-4000-8000-00000000b001',
  'a0000000-0000-4000-8000-00000000a001',
  'a0000000-0000-4000-8000-00000000a001',
  jsonb_build_object('sub', 'a0000000-0000-4000-8000-00000000a001', 'email', 'owner@arawan.local'),
  'email',
  now(), now(), now()
)
on conflict (provider_id, provider) do update set
  identity_data = excluded.identity_data,
  updated_at = now();

-- ---------------------------------------------------------------------------
-- 3. public.profiles -- see supabase/seed-owner.sql for the hosted-project
-- version of this same insert. profiles has no client INSERT policy
-- (0007_rls_grants.sql), so seeding it is only possible from a script like
-- this one that runs as the database owner.
-- ---------------------------------------------------------------------------
insert into public.profiles (id, timezone, currency, default_collection_weekdays)
values ('a0000000-0000-4000-8000-00000000a001', 'Asia/Manila', 'PHP', '{1,2,3,4,5,6,7}')
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- 4. Fixture borrowers + loans.
--
-- source_sequence is passed explicitly on every loan, which makes
-- trg_loans_assign_sequence a no-op (it only fills the column in when null --
-- 0015_assign_loan_sequence.sql) and satisfies loans_owner_sequence_uidx
-- (unique per owner) by construction.
--
-- Loan #7 is archived. Records' default filters (archived: 'exclude') hide
-- it, so with the OLD "#" column (loan.source_sequence rendered verbatim)
-- the list reads ...6, 8... -- the exact gap bug this seed exists to
-- reproduce. With the fix (a positional row number), the visible list is
-- 1..n with no gap regardless.
--
-- All financial fields are set and loans_ready_shape's ordering
-- (payment_start_on >= borrowed_on, due_on >= payment_start_on,
-- total_payable_centavos >= principal_centavos) holds for every row, so
-- every loan is 'ready' rather than 'needs_review'.
-- ---------------------------------------------------------------------------
-- Includes JINKY C. JUAMAN -- the borrower tests/e2e/20-overview-metrics-and-
-- row-actions.spec.ts's "desktop row actions" test searches for by name.
insert into public.borrowers (id, owner_id, display_name, normalized_name, phone, notes)
values
  ('a1000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-00000000a001', 'ANA DELA CRUZ', 'ana dela cruz', null, null),
  ('a1000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-00000000a001', 'BENJIE SERDEÑA', 'benjie serdena', null, 'Accent-folding fixture.'),
  ('a1000000-0000-4000-8000-000000000003', 'a0000000-0000-4000-8000-00000000a001', 'CARLA MENDOZA', 'carla mendoza', null, null),
  ('a1000000-0000-4000-8000-000000000004', 'a0000000-0000-4000-8000-00000000a001', 'DANILO REYES', 'danilo reyes', null, null),
  ('a1000000-0000-4000-8000-000000000005', 'a0000000-0000-4000-8000-00000000a001', 'ELENA BAUTISTA', 'elena bautista', null, null),
  ('a1000000-0000-4000-8000-000000000006', 'a0000000-0000-4000-8000-00000000a001', 'FRANCIS TAN', 'francis tan', null, null),
  ('a1000000-0000-4000-8000-000000000007', 'a0000000-0000-4000-8000-00000000a001', 'GINA VILLANUEVA', 'gina villanueva', null, null),
  ('a1000000-0000-4000-8000-000000000008', 'a0000000-0000-4000-8000-00000000a001', 'HECTOR PANGILINAN', 'hector pangilinan', null, null),
  ('a1000000-0000-4000-8000-000000000009', 'a0000000-0000-4000-8000-00000000a001', 'JINKY C. JUAMAN', 'jinky c. juaman', null, null)
on conflict (id) do nothing;

insert into public.loans (
  id, owner_id, borrower_id, source_sequence, currency,
  principal_centavos, daily_due_centavos, interest_mode, interest_centavos,
  total_payable_centavos, borrowed_on, payment_start_on, due_on,
  collection_weekdays, readiness, archived_at
)
select
  ('b0000000-0000-4000-8000-' || lpad(g::text, 12, '0'))::uuid,
  'a0000000-0000-4000-8000-00000000a001',
  ('a1000000-0000-4000-8000-' || lpad((((g - 1) % 9) + 1)::text, 12, '0'))::uuid,
  g,
  'PHP',
  100000 * g,                                                    -- principal = P1,000 * g
  2000 * g,                                                      -- daily = principal / 50
  'added'::public.loan_interest_mode,
  20000 * g,                                                     -- interest = principal / 5
  120000 * g,                                                    -- total payable
  (now() at time zone 'Asia/Manila')::date - (g * 2),
  (now() at time zone 'Asia/Manila')::date - (g * 2),
  (now() at time zone 'Asia/Manila')::date + 90,
  '{1,2,3,4,5,6,7}'::smallint[],
  'ready'::public.loan_readiness,
  case when g = 7 then now() - interval '3 days' end
from generate_series(1, 30) as g
on conflict (id) do nothing;
