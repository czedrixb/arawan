-- ARAWAN §10: import staging + audit trail. Created now even though the
-- Excel import wizard (spec phase 4) is a follow-up, because loans.
-- source_import_row_id needs import_rows to exist and adding it later
-- would mean an ALTER + backfill instead of a clean initial shape.
create type public.import_batch_status as enum ('uploaded', 'previewed', 'committed', 'failed', 'cancelled');
create type public.import_row_decision as enum ('pending', 'include', 'exclude');

create table public.import_batches (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id),
  filename text not null,
  file_sha256 text not null,
  storage_path text,
  mapping_json jsonb not null default '{}'::jsonb,
  mapping_version integer not null default 1,
  status public.import_batch_status not null default 'uploaded',
  counts_json jsonb not null default '{}'::jsonb,
  result_json jsonb,
  committed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version integer not null default 1,
  unique (owner_id, id),
  -- Re-opening a committed import (same file, same owner) returns its
  -- existing result instead of re-parsing (spec §7 duplicate rules).
  unique (owner_id, file_sha256)
);

create trigger trg_import_batches_bump
  before update on public.import_batches
  for each row execute function public.bump_updated_at();

alter table public.import_batches enable row level security;

create table public.import_rows (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id),
  batch_id uuid not null,
  sheet_name text not null,
  row_number integer not null,
  raw_json jsonb not null,
  normalized_json jsonb,
  issues_json jsonb not null default '[]'::jsonb,
  resolution_json jsonb,
  fingerprint text not null,
  decision public.import_row_decision not null default 'pending',
  committed_loan_id uuid,
  created_at timestamptz not null default now(),
  unique (owner_id, id),
  unique (owner_id, batch_id, sheet_name, row_number),
  foreign key (owner_id, batch_id) references public.import_batches (owner_id, id),
  foreign key (owner_id, committed_loan_id) references public.loans (owner_id, id)
);

comment on column public.import_rows.raw_json is
  'Immutable snapshot of the source cells as read, including original number/date formats -- never edited after ingest (spec §2/§7).';

alter table public.import_rows enable row level security;

alter table public.loans
  add constraint loans_source_import_row_fk
  foreign key (owner_id, source_import_row_id) references public.import_rows (owner_id, id);

create table public.audit_events (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id),
  actor_id uuid not null references auth.users (id),
  entity_type text not null,
  entity_id uuid not null,
  action text not null,
  before_json jsonb,
  after_json jsonb,
  reason text,
  request_id uuid,
  created_at timestamptz not null default now(),
  unique (owner_id, id)
);

comment on table public.audit_events is
  'Append-only. Never logs passwords/tokens (spec §10). Written by the SECURITY DEFINER RPCs alongside each ledger mutation.';

create index audit_events_entity_idx on public.audit_events (owner_id, entity_type, entity_id, created_at desc);

alter table public.audit_events enable row level security;

create table public.mutation_requests (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id),
  operation text not null,
  idempotency_key uuid not null,
  payload_hash text not null,
  response_json jsonb,
  created_at timestamptz not null default now(),
  unique (owner_id, id),
  unique (owner_id, operation, idempotency_key)
);

comment on table public.mutation_requests is
  'Idempotency ledger for the financial RPCs. Same key + different payload is rejected; same key + same payload replays the stored response_json (spec §10).';

alter table public.mutation_requests enable row level security;
