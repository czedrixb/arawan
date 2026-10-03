-- extract(isodow) returns numeric; compare it explicitly with the smallint calendar array.
do $$
declare v_definition text;
begin
  select pg_get_functiondef('public.renew_loan(uuid,integer,uuid,date,bigint,bigint,text,bigint,smallint[],text,date)'::regprocedure)
    into v_definition;
  v_definition := replace(v_definition, 'extract(isodow from d)=any(p_collection_weekdays)', 'extract(isodow from d)::smallint=any(p_collection_weekdays)');
  execute v_definition;
end $$;
