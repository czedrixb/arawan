-- ARAWAN §10: extensions + single-owner profile.
-- gen_random_uuid() is built into Postgres 13+; pgcrypto is only needed for
-- digest(), used by the idempotency hashing in 0006_rpc_financial.sql.
create extension if not exists pgcrypto;

-- Shared trigger: every mutable table bumps updated_at + version on UPDATE
-- so the API's "expected version" optimistic-concurrency check (spec §10,
-- 409 on stale writes) has something real to compare against.
create or replace function public.bump_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  new.version := old.version + 1;
  return new;
end;
$$;

-- profiles.id IS the owner id (auth.users.id) -- ARAWAN is single-owner
-- (spec §1/§10), so there is exactly one row and no separate owner_id
-- column is needed here.
create table public.profiles (
  id uuid primary key references auth.users (id) on delete restrict,
  timezone text not null default 'Asia/Manila',
  currency text not null default 'PHP',
  -- ISO weekday numbers, 1=Monday..7=Sunday.
  default_collection_weekdays smallint[] not null default '{1,2,3,4,5,6,7}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version integer not null default 1
);

comment on table public.profiles is
  'Single-owner app settings. Exactly one row, provisioned by supabase/seed-owner.sql -- never via client insert.';

create trigger trg_profiles_bump
  before update on public.profiles
  for each row execute function public.bump_updated_at();

alter table public.profiles enable row level security;
