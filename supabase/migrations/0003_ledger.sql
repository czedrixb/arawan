-- ARAWAN §10: the append-only financial ledger. Client INSERT/UPDATE/DELETE
-- on these two tables is revoked in 0007_rls_grants.sql -- they change only
-- through the record_payment / reverse_payment / confirm_opening_balance
-- RPCs in 0006_rpc_financial.sql.
create table public.opening_balances (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id),
  loan_id uuid not null,
  collected_centavos bigint not null check (collected_centavos >= 0),
  as_of date not null,
  reason text not null check (btrim(reason) <> ''),
  supersedes_id uuid,
  confirmed_by uuid not null references auth.users (id),
  created_at timestamptz not null default now(),
  unique (owner_id, id),
  foreign key (owner_id, loan_id) references public.loans (owner_id, id),
  foreign key (owner_id, supersedes_id) references public.opening_balances (owner_id, id)
);

comment on table public.opening_balances is
  'Append-only revisions of the owner-confirmed pre-cutover collected amount. A confirmed zero is valid; absence means unknown (spec §3).';

create index opening_balances_loan_idx on public.opening_balances (owner_id, loan_id, created_at desc);

alter table public.opening_balances enable row level security;

create type public.payment_kind as enum ('payment', 'reversal');

create table public.payment_entries (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id),
  loan_id uuid not null,
  kind public.payment_kind not null,
  amount_centavos bigint not null check (amount_centavos > 0),
  paid_on date not null,
  reverses_id uuid,
  method text,
  note text,
  idempotency_key uuid not null,
  created_at timestamptz not null default now(),
  unique (owner_id, id),
  -- One full reversal per payment in MVP (spec §10).
  unique (reverses_id),
  foreign key (owner_id, loan_id) references public.loans (owner_id, id),
  foreign key (owner_id, reverses_id) references public.payment_entries (owner_id, id),
  constraint payment_entries_reversal_shape check (
    (kind = 'payment' and reverses_id is null)
    or (kind = 'reversal' and reverses_id is not null)
  )
);

comment on table public.payment_entries is
  'Append-only. A reversal references the payment it reverses; recognized_collected excludes any payment with a linked reversal entirely (see loan_summary).';

create index payment_entries_loan_idx on public.payment_entries (owner_id, loan_id, paid_on, id);

alter table public.payment_entries enable row level security;
