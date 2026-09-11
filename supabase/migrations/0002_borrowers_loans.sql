-- ARAWAN §10: borrowers + loans.
create type public.loan_readiness as enum ('needs_review', 'ready');
create type public.loan_interest_mode as enum ('none', 'added', 'included');

create table public.borrowers (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id),
  display_name text not null check (btrim(display_name) <> ''),
  -- Lowercased, whitespace-collapsed, accent-folded display_name, for
  -- search only -- never a uniqueness key. The real workbook has borrowers
  -- with accented letters (e.g. "SERDEÑA") that must remain findable by
  -- an unaccented search term; unaccent() is applied by the app/service
  -- layer before writing this column so the migration has no extension
  -- dependency on unaccent being available.
  normalized_name text not null,
  phone text,
  notes text,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version integer not null default 1,
  unique (owner_id, id)
);

comment on column public.borrowers.display_name is
  'Preserves original spelling/accents as entered -- never auto-corrected (spec §2).';

create index borrowers_owner_search_idx on public.borrowers (owner_id, normalized_name);

create trigger trg_borrowers_bump
  before update on public.borrowers
  for each row execute function public.bump_updated_at();

alter table public.borrowers enable row level security;

create table public.loans (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id),
  borrower_id uuid not null,
  -- Original workbook row number (1-42), kept for traceability. Never the
  -- database identifier and never assumed unique across re-imports.
  source_sequence integer,
  currency text not null default 'PHP',
  principal_centavos bigint check (principal_centavos > 0),
  daily_due_centavos bigint check (daily_due_centavos > 0),
  interest_mode public.loan_interest_mode,
  interest_centavos bigint check (interest_centavos >= 0),
  total_payable_centavos bigint check (total_payable_centavos > 0),
  borrowed_on date,
  payment_start_on date,
  due_on date,
  -- Legacy workbook fields, preserved verbatim -- never auto-mapped into
  -- the fields above (spec §2/§7): DATE COMPLETED and the "%" column.
  legacy_completed_on date,
  legacy_percent_value bigint,
  -- ISO weekday numbers, 1=Monday..7=Sunday.
  collection_weekdays smallint[] not null default '{1,2,3,4,5,6,7}',
  readiness public.loan_readiness not null default 'needs_review',
  archived_at timestamptz,
  source_import_row_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version integer not null default 1,
  unique (owner_id, id),
  foreign key (owner_id, borrower_id) references public.borrowers (owner_id, id),
  -- Spec §10: financial fields are nullable only while needs_review; a
  -- loan cannot become 'ready' with an incomplete or inconsistent shape.
  constraint loans_ready_shape check (
    readiness = 'needs_review' or (
      principal_centavos is not null
      and daily_due_centavos is not null
      and interest_mode is not null
      and total_payable_centavos is not null
      and borrowed_on is not null
      and payment_start_on is not null
      and due_on is not null
      and payment_start_on >= borrowed_on
      and due_on >= payment_start_on
      and total_payable_centavos >= principal_centavos
    )
  )
);

comment on column public.loans.legacy_percent_value is
  'Raw workbook "%" column value. Not interpreted as pesos, a fee, or a rate -- see docs/workbook-analysis.md.';

create index loans_owner_list_idx on public.loans (owner_id, archived_at, borrowed_on, id);
create index loans_owner_due_idx on public.loans (owner_id, due_on, id);
create index loans_owner_borrower_idx on public.loans (owner_id, borrower_id);

create trigger trg_loans_bump
  before update on public.loans
  for each row execute function public.bump_updated_at();

alter table public.loans enable row level security;
