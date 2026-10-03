-- 0017 recreated record_payment after 0009 had already qualified pgcrypto.
-- Repair databases that applied the original 0017 definition while keeping
-- this migration a no-op on fresh databases where 0017 is already fixed.
do $$
declare v_definition text;
begin
  select pg_get_functiondef('public.record_payment(uuid,bigint,date,uuid,text,text)'::regprocedure)
    into v_definition;
  v_definition := replace(
    v_definition,
    ':=encode(digest(v_payload::text,''sha256'')',
    ':=encode(extensions.digest(v_payload::text,''sha256'')'
  );
  execute v_definition;
end $$;
