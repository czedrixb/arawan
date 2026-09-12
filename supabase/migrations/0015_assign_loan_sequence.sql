-- Records page numbering: `loans.source_sequence` originally only carried
-- the imported workbook's row number (1-42, see 0002_borrowers_loans.sql),
-- so every loan created through the app (not imported) has source_sequence
-- null and the Records "#" column shows "-" for it. Reuse the same column
-- as the record number for app-created loans too -- every consumer
-- (LoanTable.vue, LoanListItem.vue, the sequence_asc/desc sorts in
-- server/services/loan-service.ts, the loan_summary view) already treats it
-- that way; a parallel column would mean touching all of those for nothing.

-- Backfill: number pre-existing app-created loans (source_sequence is null)
-- per owner, continuing after that owner's current max, ordered by
-- created_at then id for a stable, deterministic assignment.
with ranked as (
  select
    id,
    row_number() over (partition by owner_id order by created_at, id) as rn,
    owner_id
  from public.loans
  where source_sequence is null
),
owner_max as (
  select owner_id, coalesce(max(source_sequence), 0) as max_seq
  from public.loans
  group by owner_id
)
update public.loans l
set source_sequence = owner_max.max_seq + ranked.rn
from ranked
join owner_max on owner_max.owner_id = ranked.owner_id
where l.id = ranked.id;

-- Keep the numbering honest going forward.
create unique index loans_owner_sequence_uidx
  on public.loans (owner_id, source_sequence)
  where source_sequence is not null;

-- Auto-assign the next number per owner whenever a loan is inserted without
-- one (the seed/reset scripts pass source_sequence explicitly from the
-- workbook and are left untouched by this trigger). The advisory lock
-- serializes concurrent inserts for the same owner so two loans can never
-- claim the same number; ARAWAN is single-owner, so contention is nil.
create or replace function public.assign_loan_sequence()
returns trigger
language plpgsql
as $$
begin
  if new.source_sequence is null then
    perform pg_advisory_xact_lock(hashtext(new.owner_id::text));
    select coalesce(max(source_sequence), 0) + 1
    into new.source_sequence
    from public.loans
    where owner_id = new.owner_id;
  end if;
  return new;
end;
$$;

create trigger trg_loans_assign_sequence
  before insert on public.loans
  for each row execute function public.assign_loan_sequence();
