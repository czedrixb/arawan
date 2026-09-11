-- ARAWAN §3/§10: the single source of truth for a loan's balance. Balance
-- is derived here, never stored -- there is no second editable balance
-- column anywhere in the schema. security_invoker means this view runs
-- under the CALLING user's RLS, so it never needs its own grant logic
-- beyond SELECT on the view itself (0007_rls_grants.sql).
create view public.loan_summary
with (security_invoker = true) as
with base as (
  select
    l.*,
    bo.display_name as borrower_display_name,
    bo.normalized_name as borrower_normalized_name,
    bo.archived_at as borrower_archived_at,
    bo.version as borrower_version,
    coalesce(ob.opening_collected_centavos, 0) as opening_collected_centavos,
    coalesce(pay.net_payments_centavos, 0) as net_payments_centavos
  from public.loans l
  join public.borrowers bo on bo.owner_id = l.owner_id and bo.id = l.borrower_id
  -- Most recent (current) opening-balance revision, if any.
  left join lateral (
    select ob1.collected_centavos as opening_collected_centavos
    from public.opening_balances ob1
    where ob1.owner_id = l.owner_id and ob1.loan_id = l.id
    order by ob1.created_at desc
    limit 1
  ) ob on true
  -- Sum of payments that have NOT been reversed. A reversed payment is
  -- excluded entirely rather than netted against a dated reversal row --
  -- spec §3: "A correction removes the reversed payment from its original
  -- effective collection date."
  left join lateral (
    select sum(p.amount_centavos) as net_payments_centavos
    from public.payment_entries p
    where p.owner_id = l.owner_id
      and p.loan_id = l.id
      and p.kind = 'payment'
      and not exists (
        select 1 from public.payment_entries r
        where r.owner_id = p.owner_id and r.reverses_id = p.id
      )
  ) pay on true
),
derived as (
  select
    b.*,
    case when b.readiness = 'ready'
      then b.opening_collected_centavos + b.net_payments_centavos
    end as recognized_collected_centavos,
    case when b.readiness = 'ready'
      then b.total_payable_centavos - (b.opening_collected_centavos + b.net_payments_centavos)
    end as remaining_centavos,
    case when b.readiness = 'ready' and b.total_payable_centavos > 0
      then round(100.0 * (b.opening_collected_centavos + b.net_payments_centavos) / b.total_payable_centavos, 2)
    end as progress_pct
  from base b
)
select
  d.id,
  d.owner_id,
  d.borrower_id,
  d.borrower_display_name,
  d.borrower_normalized_name,
  d.borrower_archived_at,
  d.borrower_version,
  d.source_sequence,
  d.currency,
  d.principal_centavos,
  d.daily_due_centavos,
  d.interest_mode,
  d.interest_centavos,
  d.total_payable_centavos,
  d.borrowed_on,
  d.payment_start_on,
  d.due_on,
  d.legacy_completed_on,
  d.legacy_percent_value,
  d.collection_weekdays,
  d.readiness,
  d.archived_at,
  d.source_import_row_id,
  d.created_at,
  d.updated_at,
  d.version,
  d.opening_collected_centavos,
  d.net_payments_centavos,
  d.recognized_collected_centavos,
  d.remaining_centavos,
  d.progress_pct,
  comp.completed_on,
  -- Spec §3 status table, evaluated in Asia/Manila "today".
  (case
    when d.archived_at is not null then 'archived'
    when d.readiness = 'needs_review' then 'needs_review'
    when d.remaining_centavos <= 0 then 'completed'
    when d.payment_start_on > (now() at time zone 'Asia/Manila')::date then 'upcoming'
    when (now() at time zone 'Asia/Manila')::date > d.due_on then 'overdue'
    else 'active'
  end)::text as display_status
from derived d
-- Earliest date at which cumulative (opening + non-reversed payments,
-- ordered chronologically) reaches total_payable -- the completion date,
-- recomputed automatically whenever a reversal changes the running total.
left join lateral (
  select min(running.paid_on) as completed_on
  from (
    select
      p.paid_on,
      d.opening_collected_centavos
        + sum(p.amount_centavos) over (order by p.paid_on, p.id) as running_total
    from public.payment_entries p
    where p.owner_id = d.owner_id
      and p.loan_id = d.id
      and p.kind = 'payment'
      and not exists (
        select 1 from public.payment_entries r
        where r.owner_id = p.owner_id and r.reverses_id = p.id
      )
  ) running
  where d.total_payable_centavos is not null
    and running.running_total >= d.total_payable_centavos
) comp on true;

comment on view public.loan_summary is
  'Derived balance/status per loan (spec §3). Never write to this view -- it has no INSERT/UPDATE rule and none should be added.';
