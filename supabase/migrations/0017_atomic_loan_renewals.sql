-- Atomic, owner-scoped loan renewal lifecycle.
create type public.loan_lifecycle as enum ('active', 'completed', 'renewed');

alter table public.loans
  add column lifecycle public.loan_lifecycle not null default 'active',
  add column closed_at timestamptz,
  add column renewed_from_loan_id uuid,
  add column renewed_to_loan_id uuid,
  add constraint loans_no_self_renewal check (
    (renewed_from_loan_id is null or renewed_from_loan_id <> id)
    and (renewed_to_loan_id is null or renewed_to_loan_id <> id)
  ),
  add constraint loans_renewed_shape check (
    (lifecycle = 'renewed' and closed_at is not null and renewed_to_loan_id is not null)
    or (lifecycle <> 'renewed' and renewed_to_loan_id is null)
  ),
  add constraint loans_renewed_from_fk foreign key (owner_id, renewed_from_loan_id)
    references public.loans(owner_id, id),
  add constraint loans_renewed_to_fk foreign key (owner_id, renewed_to_loan_id)
    references public.loans(owner_id, id);

create unique index loans_one_successor_idx on public.loans(owner_id, renewed_to_loan_id)
  where renewed_to_loan_id is not null;
create unique index loans_one_predecessor_idx on public.loans(owner_id, renewed_from_loan_id)
  where renewed_from_loan_id is not null;

-- Existing resolved zero/negative balances become completed.
update public.loans l set lifecycle = 'completed', closed_at = now()
where l.readiness = 'ready'
  and l.total_payable_centavos - coalesce((
    select ob.collected_centavos from public.opening_balances ob
    where ob.owner_id=l.owner_id and ob.loan_id=l.id order by ob.created_at desc limit 1
  ),0) - coalesce((
    select sum(p.amount_centavos) from public.payment_entries p
    where p.owner_id=l.owner_id and p.loan_id=l.id and p.kind='payment'
      and not exists (select 1 from public.payment_entries r where r.owner_id=p.owner_id and r.reverses_id=p.id)
  ),0) <= 0;

create table public.loan_renewals (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id),
  old_loan_id uuid not null,
  new_loan_id uuid not null,
  effective_on date not null,
  original_principal_centavos bigint not null check (original_principal_centavos > 0),
  original_interest_centavos bigint not null check (original_interest_centavos >= 0),
  original_total_payable_centavos bigint not null check (original_total_payable_centavos > 0),
  collections_before_renewal_centavos bigint not null check (collections_before_renewal_centavos >= 0),
  remaining_principal_centavos bigint not null check (remaining_principal_centavos >= 0),
  unpaid_interest_centavos bigint not null check (unpaid_interest_centavos >= 0),
  renewal_payment_centavos bigint not null check (renewal_payment_centavos >= 0),
  waived_interest_centavos bigint not null check (waived_interest_centavos >= 0),
  waiver_note text,
  capitalized_interest_centavos bigint not null check (capitalized_interest_centavos >= 0),
  carried_principal_centavos bigint not null check (carried_principal_centavos >= 0),
  additional_cash_centavos bigint not null check (additional_cash_centavos >= 0),
  new_financed_principal_centavos bigint not null check (new_financed_principal_centavos > 0),
  created_at timestamptz not null default now(),
  unique(owner_id, id), unique(owner_id, old_loan_id), unique(owner_id, new_loan_id),
  foreign key(owner_id, old_loan_id) references public.loans(owner_id,id),
  foreign key(owner_id, new_loan_id) references public.loans(owner_id,id),
  check (old_loan_id <> new_loan_id),
  check ((waived_interest_centavos = 0) or btrim(coalesce(waiver_note,'')) <> ''),
  check (capitalized_interest_centavos + waived_interest_centavos <= unpaid_interest_centavos),
  check (new_financed_principal_centavos = carried_principal_centavos + capitalized_interest_centavos + additional_cash_centavos)
);
alter table public.loan_renewals enable row level security;
create policy "loan_renewals_select_own" on public.loan_renewals for select using (auth.uid()=owner_id);
grant select on public.loan_renewals to authenticated;
revoke insert, update, delete on public.loan_renewals from authenticated;

-- Recreate the view with persisted lifecycle and links. Drop dependent RPCs first.
drop function public.record_payment(uuid,bigint,date,uuid,text,text);
drop function public.reverse_payment(uuid,text,uuid);
drop function public.confirm_opening_balance(uuid,bigint,date,text);
drop function public.edit_loan_record(uuid,integer,integer,text,text,date,date,date,bigint,bigint,bigint);
drop view public.loan_summary;

create view public.loan_summary with (security_invoker=true) as
with base as (
 select l.*, b.display_name borrower_display_name, b.normalized_name borrower_normalized_name,
   b.archived_at borrower_archived_at, b.version borrower_version,
   coalesce(ob.amount,0) opening_collected_centavos, coalesce(pay.amount,0) net_payments_centavos
 from public.loans l join public.borrowers b on b.owner_id=l.owner_id and b.id=l.borrower_id
 left join lateral (select collected_centavos amount from public.opening_balances o where o.owner_id=l.owner_id and o.loan_id=l.id order by created_at desc limit 1) ob on true
 left join lateral (select sum(p.amount_centavos) amount from public.payment_entries p where p.owner_id=l.owner_id and p.loan_id=l.id and p.kind='payment' and not exists(select 1 from public.payment_entries r where r.owner_id=p.owner_id and r.reverses_id=p.id)) pay on true
), derived as (
 select base.*,
   case when readiness='ready' then opening_collected_centavos+net_payments_centavos end recognized_collected_centavos,
   case when readiness='ready' then total_payable_centavos-(opening_collected_centavos+net_payments_centavos) end remaining_centavos,
   case when readiness='ready' and total_payable_centavos>0 then round(100.0*(opening_collected_centavos+net_payments_centavos)/total_payable_centavos,2) end progress_pct
 from base
)
select d.*, comp.completed_on,
 case when d.archived_at is not null then 'archived'
      when d.readiness='needs_review' then 'needs_review'
      when d.lifecycle='renewed' then 'renewed'
      when d.lifecycle='completed' or d.remaining_centavos<=0 then 'completed'
      when (now() at time zone 'Asia/Manila')::date>d.due_on then 'overdue'
      else 'active' end::text display_status
from derived d
left join lateral (
 select min(x.paid_on) completed_on from (
   select p.paid_on,d.opening_collected_centavos+sum(p.amount_centavos) over(order by p.paid_on,p.id) running_total
   from public.payment_entries p where p.owner_id=d.owner_id and p.loan_id=d.id and p.kind='payment'
   and not exists(select 1 from public.payment_entries r where r.owner_id=p.owner_id and r.reverses_id=p.id)
 ) x where x.running_total>=d.total_payable_centavos
) comp on true;
grant select on public.loan_summary to authenticated;

create or replace function public.sync_loan_lifecycle() returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
declare v_loan_id uuid; v_owner uuid; v_remaining bigint;
begin
 v_loan_id := coalesce(new.loan_id,old.loan_id); v_owner := coalesce(new.owner_id,old.owner_id);
 select remaining_centavos into v_remaining from public.loan_summary where id=v_loan_id and owner_id=v_owner;
 update public.loans set lifecycle=case when v_remaining<=0 then 'completed'::public.loan_lifecycle else 'active'::public.loan_lifecycle end,
   closed_at=case when v_remaining<=0 then coalesce(closed_at,now()) else null end
 where id=v_loan_id and owner_id=v_owner and lifecycle<>'renewed';
 return coalesce(new,old);
end $$;
create trigger trg_payment_lifecycle after insert on public.payment_entries for each row execute function public.sync_loan_lifecycle();
create trigger trg_opening_lifecycle after insert on public.opening_balances for each row execute function public.sync_loan_lifecycle();

create or replace function public.assert_mutable_loan(p_loan public.loans) returns void language plpgsql as $$
begin if p_loan.lifecycle='renewed' then raise exception using errcode='ARW09',message='Renewed loans are read-only'; end if; end $$;

create or replace function public.record_payment(p_loan_id uuid,p_amount_centavos bigint,p_paid_on date,p_idempotency_key uuid,p_method text default null,p_note text default null)
returns public.loan_summary language plpgsql security definer set search_path=public,pg_temp as $$
declare v_owner uuid:=auth.uid(); v_loan public.loans; v_remaining bigint; v_opening date; v_payload jsonb; v_hash text; v_mid uuid; v_cached jsonb; v_result public.loan_summary;
begin
 if v_owner is null then raise exception using errcode='ARW01',message='Not authenticated'; end if;
 select * into v_loan from public.loans where id=p_loan_id and owner_id=v_owner for update;
 if not found then raise exception using errcode='ARW04',message='Loan not found'; end if;
 perform public.assert_mutable_loan(v_loan);
 if v_loan.lifecycle<>'active' then raise exception using errcode='ARW09',message='Completed loans cannot receive payments'; end if;
 if v_loan.readiness<>'ready' then raise exception using errcode='ARW22',message='Loan terms are not resolved'; end if;
 if p_amount_centavos is null or p_amount_centavos<=0 then raise exception using errcode='ARW22',message='Payment amount must be positive'; end if;
 select as_of into v_opening from public.opening_balances where owner_id=v_owner and loan_id=p_loan_id order by created_at desc limit 1;
 if v_opening is not null and p_paid_on<=v_opening then raise exception using errcode='ARW22',message='Payment date must be after the opening balance date'; end if;
 select remaining_centavos into v_remaining from public.loan_summary where id=p_loan_id and owner_id=v_owner;
 v_payload:=jsonb_build_object('loan_id',p_loan_id,'amount_centavos',p_amount_centavos,'paid_on',p_paid_on,'method',p_method,'note',p_note); v_hash:=encode(extensions.digest(v_payload::text,'sha256'),'hex');
 insert into public.mutation_requests(owner_id,operation,idempotency_key,payload_hash) values(v_owner,'record_payment',p_idempotency_key,v_hash)
 on conflict(owner_id,operation,idempotency_key) do update set id=mutation_requests.id where mutation_requests.payload_hash=excluded.payload_hash returning id,response_json into v_mid,v_cached;
 if v_mid is null then raise exception using errcode='ARW09',message='Idempotency key was used with different details'; end if;
 if v_cached is not null then select * into v_result from public.loan_summary where id=p_loan_id and owner_id=v_owner; return v_result; end if;
 if p_amount_centavos>v_remaining then raise exception using errcode='ARW22',message='Amount exceeds remaining balance'; end if;
 insert into public.payment_entries(owner_id,loan_id,kind,amount_centavos,paid_on,method,note,idempotency_key) values(v_owner,p_loan_id,'payment',p_amount_centavos,p_paid_on,p_method,p_note,p_idempotency_key);
 insert into public.audit_events(owner_id,actor_id,entity_type,entity_id,action,after_json,request_id) values(v_owner,v_owner,'loan',p_loan_id,'record_payment',v_payload,p_idempotency_key);
 select * into v_result from public.loan_summary where id=p_loan_id and owner_id=v_owner; update public.mutation_requests set response_json=to_jsonb(v_result) where id=v_mid; return v_result;
end $$;

create or replace function public.reverse_payment(p_payment_id uuid,p_reason text,p_idempotency_key uuid)
returns public.loan_summary language plpgsql security definer set search_path=public,pg_temp as $$
declare v_owner uuid:=auth.uid(); v_payment public.payment_entries; v_loan public.loans; v_result public.loan_summary;
begin
 if v_owner is null then raise exception using errcode='ARW01',message='Not authenticated'; end if;
 if btrim(coalesce(p_reason,''))='' then raise exception using errcode='ARW22',message='A reversal reason is required'; end if;
 select * into v_payment from public.payment_entries where id=p_payment_id and owner_id=v_owner and kind='payment' for update;
 if not found then raise exception using errcode='ARW04',message='Payment not found'; end if;
 select * into v_loan from public.loans where id=v_payment.loan_id and owner_id=v_owner for update; perform public.assert_mutable_loan(v_loan);
 if exists(select 1 from public.payment_entries where owner_id=v_owner and reverses_id=p_payment_id) then raise exception using errcode='ARW09',message='Payment already reversed'; end if;
 insert into public.payment_entries(owner_id,loan_id,kind,amount_centavos,paid_on,reverses_id,note,idempotency_key) values(v_owner,v_payment.loan_id,'reversal',v_payment.amount_centavos,(now() at time zone 'Asia/Manila')::date,p_payment_id,p_reason,p_idempotency_key);
 insert into public.audit_events(owner_id,actor_id,entity_type,entity_id,action,before_json,reason,request_id) values(v_owner,v_owner,'loan',v_loan.id,'reverse_payment',to_jsonb(v_payment),p_reason,p_idempotency_key);
 select * into v_result from public.loan_summary where id=v_loan.id and owner_id=v_owner; return v_result;
end $$;

create or replace function public.confirm_opening_balance(p_loan_id uuid,p_collected_centavos bigint,p_as_of date,p_reason text)
returns public.loan_summary language plpgsql security definer set search_path=public,pg_temp as $$
declare v_owner uuid:=auth.uid(); v_loan public.loans; v_previous uuid; v_result public.loan_summary;
begin
 select * into v_loan from public.loans where id=p_loan_id and owner_id=v_owner for update; if not found then raise exception using errcode='ARW04',message='Loan not found'; end if; perform public.assert_mutable_loan(v_loan);
 if p_collected_centavos<0 or btrim(coalesce(p_reason,''))='' then raise exception using errcode='ARW22',message='Valid amount and reason required'; end if;
 select id into v_previous from public.opening_balances where owner_id=v_owner and loan_id=p_loan_id order by created_at desc limit 1;
 insert into public.opening_balances(owner_id,loan_id,collected_centavos,as_of,reason,supersedes_id,confirmed_by) values(v_owner,p_loan_id,p_collected_centavos,p_as_of,p_reason,v_previous,v_owner);
 select * into v_result from public.loan_summary where id=p_loan_id and owner_id=v_owner; return v_result;
end $$;

create or replace function public.renew_loan(
 p_loan_id uuid,p_loan_version integer,p_idempotency_key uuid,p_effective_on date,
 p_renewal_payment_centavos bigint,p_waived_interest_centavos bigint,p_waiver_note text,
 p_additional_cash_centavos bigint,p_collection_weekdays smallint[],p_new_term text,p_no_interest_due_on date default null
) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare v_owner uuid:=auth.uid(); v_old public.loans; v_summary public.loan_summary; v_latest date; v_collected bigint; v_interest bigint; v_principal bigint;
 v_unpaid_interest bigint; v_remaining_principal bigint; v_payment_to_interest bigint; v_payment_to_principal bigint; v_capitalized bigint; v_carried bigint; v_new_principal bigint;
 v_new_interest bigint; v_total bigint; v_start date; v_due date; v_daily bigint; v_days integer; v_new_id uuid:=gen_random_uuid(); v_renewal_id uuid:=gen_random_uuid();
 v_payload jsonb; v_hash text; v_mid uuid; v_cached jsonb; v_result jsonb; v_snapshot public.loan_renewals;
begin
 if v_owner is null then raise exception using errcode='ARW01',message='Not authenticated'; end if;
 select * into v_old from public.loans where id=p_loan_id and owner_id=v_owner for update; if not found then raise exception using errcode='ARW04',message='Loan not found'; end if;
 v_payload:=jsonb_build_object('loan_id',p_loan_id,'version',p_loan_version,'effective_on',p_effective_on,'renewal_payment',p_renewal_payment_centavos,'waived_interest',p_waived_interest_centavos,'waiver_note',p_waiver_note,'additional_cash',p_additional_cash_centavos,'weekdays',p_collection_weekdays,'term',p_new_term,'due_on',p_no_interest_due_on);
 v_hash:=encode(extensions.digest(v_payload::text,'sha256'),'hex');
 insert into public.mutation_requests(owner_id,operation,idempotency_key,payload_hash) values(v_owner,'renew_loan',p_idempotency_key,v_hash)
 on conflict(owner_id,operation,idempotency_key) do update set id=mutation_requests.id where mutation_requests.payload_hash=excluded.payload_hash returning id,response_json into v_mid,v_cached;
 if v_mid is null then raise exception using errcode='ARW09',message='Idempotency key was used with different renewal details'; end if;
 if v_cached is not null then return v_cached; end if;
 if v_old.version<>p_loan_version then raise exception using errcode='ARW09',message='This loan changed since it was loaded'; end if;
 if v_old.lifecycle<>'active' or v_old.readiness<>'ready' or v_old.archived_at is not null or v_old.renewed_to_loan_id is not null then raise exception using errcode='ARW09',message='This loan is not eligible for renewal'; end if;
 select * into v_summary from public.loan_summary where id=p_loan_id and owner_id=v_owner;
 if v_summary.remaining_centavos<=0 then raise exception using errcode='ARW22',message='Only loans with a positive balance can be renewed'; end if;
 select greatest(coalesce(max(p.paid_on),v_old.borrowed_on),coalesce((select max(as_of) from public.opening_balances where owner_id=v_owner and loan_id=p_loan_id),v_old.borrowed_on),v_old.borrowed_on) into v_latest from public.payment_entries p where p.owner_id=v_owner and p.loan_id=p_loan_id and p.kind='payment' and not exists(select 1 from public.payment_entries r where r.owner_id=p.owner_id and r.reverses_id=p.id);
 if p_effective_on<v_latest or p_effective_on>(now() at time zone 'Asia/Manila')::date then raise exception using errcode='ARW22',message='Effective date is outside the allowed range'; end if;
 if p_renewal_payment_centavos<0 or p_waived_interest_centavos<0 or p_additional_cash_centavos<0 or cardinality(p_collection_weekdays)=0 then raise exception using errcode='ARW22',message='Renewal amounts and collection days are invalid'; end if;
 v_collected:=v_summary.recognized_collected_centavos; v_interest:=coalesce(v_old.interest_centavos,0);
 if v_old.interest_mode='included' then v_principal:=v_old.principal_centavos-v_interest; else v_principal:=v_old.principal_centavos; end if;
 v_unpaid_interest:=greatest(v_interest-v_collected,0); v_remaining_principal:=greatest(v_principal-greatest(v_collected-v_interest,0),0);
 if p_renewal_payment_centavos>v_unpaid_interest+v_remaining_principal then raise exception using errcode='ARW22',message='Renewal payment exceeds old balance'; end if;
 v_payment_to_interest:=least(p_renewal_payment_centavos,v_unpaid_interest); v_payment_to_principal:=p_renewal_payment_centavos-v_payment_to_interest;
 v_unpaid_interest:=v_unpaid_interest-v_payment_to_interest; v_remaining_principal:=v_remaining_principal-v_payment_to_principal;
 if p_waived_interest_centavos>v_unpaid_interest or (p_waived_interest_centavos>0 and btrim(coalesce(p_waiver_note,''))='') then raise exception using errcode='ARW22',message='Interest waiver is invalid or missing a note'; end if;
 v_capitalized:=v_unpaid_interest-p_waived_interest_centavos; v_carried:=v_remaining_principal; v_new_principal:=v_carried+v_capitalized+p_additional_cash_centavos;
 if v_new_principal<=0 or v_new_principal>9007199254740991 then raise exception using errcode='ARW22',message='New financed principal is out of range'; end if;
 if p_new_term='standard' then v_new_interest:=round(v_new_principal*0.20); v_total:=v_new_principal+v_new_interest; v_start:=p_effective_on+1; v_daily:=ceil(v_total/60.0); select d into v_due from (select d,row_number() over(order by d) n from generate_series(v_start,v_start+interval '1 year',interval '1 day') d where extract(isodow from d)::smallint=any(p_collection_weekdays)) s where n=60;
 elsif p_new_term='none' then v_new_interest:=0; v_total:=v_new_principal; v_start:=p_effective_on; v_due:=p_no_interest_due_on; select count(*) into v_days from generate_series(v_start,v_due,interval '1 day') d where extract(isodow from d)::smallint=any(p_collection_weekdays); if v_due<v_start or v_days<=0 then raise exception using errcode='ARW22',message='No-interest date range is invalid'; end if; v_daily:=ceil(v_total::numeric/v_days);
 else raise exception using errcode='ARW22',message='New term must be standard or none'; end if;
 if p_renewal_payment_centavos>0 then insert into public.payment_entries(owner_id,loan_id,kind,amount_centavos,paid_on,method,note,idempotency_key) values(v_owner,p_loan_id,'payment',p_renewal_payment_centavos,p_effective_on,'renewal','Renewal settlement',p_idempotency_key); end if;
 insert into public.loans(id,owner_id,borrower_id,currency,principal_centavos,daily_due_centavos,interest_mode,interest_centavos,total_payable_centavos,borrowed_on,payment_start_on,due_on,collection_weekdays,readiness,renewed_from_loan_id)
 values(v_new_id,v_owner,v_old.borrower_id,v_old.currency,v_new_principal,v_daily,case when p_new_term='standard' then 'added'::public.loan_interest_mode else 'none'::public.loan_interest_mode end,v_new_interest,v_total,p_effective_on,v_start,v_due,p_collection_weekdays,'ready',p_loan_id);
 update public.loans set lifecycle='renewed',closed_at=now(),renewed_to_loan_id=v_new_id where id=p_loan_id and owner_id=v_owner;
 insert into public.loan_renewals(id,owner_id,old_loan_id,new_loan_id,effective_on,original_principal_centavos,original_interest_centavos,original_total_payable_centavos,collections_before_renewal_centavos,remaining_principal_centavos,unpaid_interest_centavos,renewal_payment_centavos,waived_interest_centavos,waiver_note,capitalized_interest_centavos,carried_principal_centavos,additional_cash_centavos,new_financed_principal_centavos)
 values(v_renewal_id,v_owner,p_loan_id,v_new_id,p_effective_on,v_old.principal_centavos,v_interest,v_old.total_payable_centavos,v_collected,v_remaining_principal,v_unpaid_interest,p_renewal_payment_centavos,p_waived_interest_centavos,nullif(btrim(p_waiver_note),''),v_capitalized,v_carried,p_additional_cash_centavos,v_new_principal) returning * into v_snapshot;
 insert into public.audit_events(owner_id,actor_id,entity_type,entity_id,action,before_json,after_json,reason,request_id) values(v_owner,v_owner,'loan',p_loan_id,'renew_loan',to_jsonb(v_old),to_jsonb(v_snapshot),nullif(btrim(p_waiver_note),''),p_idempotency_key);
 v_result:=jsonb_build_object('oldLoan',(select to_jsonb(s) from public.loan_summary s where id=p_loan_id),'newLoan',(select to_jsonb(s) from public.loan_summary s where id=v_new_id),'renewal',to_jsonb(v_snapshot));
 update public.mutation_requests set response_json=v_result where id=v_mid; return v_result;
end $$;

-- Atomic editor retained, now rejecting closed loans.
create or replace function public.edit_loan_record(p_loan_id uuid,p_loan_version integer,p_borrower_version integer,p_display_name text,p_normalized_name text,p_borrowed_on date,p_payment_start_on date,p_due_on date,p_principal_centavos bigint,p_daily_due_centavos bigint,p_interest_centavos bigint)
returns public.loan_summary language plpgsql security definer set search_path=public,pg_temp as $$
declare v_owner uuid:=auth.uid(); v_loan public.loans; v_borrower public.borrowers; v_result public.loan_summary;
begin select * into v_loan from public.loans where id=p_loan_id and owner_id=v_owner for update; if not found then raise exception using errcode='ARW04',message='Loan not found'; end if; perform public.assert_mutable_loan(v_loan); if v_loan.version<>p_loan_version then raise exception using errcode='ARW09',message='This loan changed since it was loaded'; end if;
 select * into v_borrower from public.borrowers where id=v_loan.borrower_id and owner_id=v_owner for update; if v_borrower.version<>p_borrower_version then raise exception using errcode='ARW09',message='This borrower changed since it was loaded'; end if;
 if exists(select 1 from public.payment_entries where loan_id=p_loan_id) and (v_loan.principal_centavos<>p_principal_centavos or v_loan.interest_centavos<>p_interest_centavos or v_loan.daily_due_centavos<>p_daily_due_centavos) then raise exception using errcode='ARW22',message='Financial terms are locked'; end if;
 update public.borrowers set display_name=btrim(p_display_name),normalized_name=p_normalized_name where id=v_borrower.id;
 update public.loans set borrowed_on=p_borrowed_on,payment_start_on=p_payment_start_on,due_on=p_due_on,principal_centavos=p_principal_centavos,daily_due_centavos=p_daily_due_centavos,interest_centavos=p_interest_centavos,interest_mode=case when p_interest_centavos>0 then 'added'::public.loan_interest_mode else 'none'::public.loan_interest_mode end,total_payable_centavos=p_principal_centavos+p_interest_centavos where id=p_loan_id;
 select * into v_result from public.loan_summary where id=p_loan_id; return v_result; end $$;

revoke execute on function public.record_payment(uuid,bigint,date,uuid,text,text),public.reverse_payment(uuid,text,uuid),public.confirm_opening_balance(uuid,bigint,date,text),public.renew_loan(uuid,integer,uuid,date,bigint,bigint,text,bigint,smallint[],text,date),public.edit_loan_record(uuid,integer,integer,text,text,date,date,date,bigint,bigint,bigint) from public;
grant execute on function public.record_payment(uuid,bigint,date,uuid,text,text),public.reverse_payment(uuid,text,uuid),public.confirm_opening_balance(uuid,bigint,date,text),public.renew_loan(uuid,integer,uuid,date,bigint,bigint,text,bigint,smallint[],text,date),public.edit_loan_record(uuid,integer,integer,text,text,date,date,date,bigint,bigint,bigint) to authenticated;
