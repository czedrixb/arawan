do $$
declare v_definition text;
begin
  select pg_get_functiondef('public.renew_loan(uuid,integer,uuid,date,bigint,bigint,text,bigint,smallint[],text,date)'::regprocedure)
    into v_definition;
  v_definition := replace(v_definition, ':=encode(digest(v_payload::text,''sha256'')', ':=encode(extensions.digest(v_payload::text,''sha256'')');
  execute v_definition;
end $$;
