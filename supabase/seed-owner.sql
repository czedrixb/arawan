-- For LOCAL development, use `supabase/seed.sql` instead (runs automatically
-- on `supabase db reset`, no manual psql step). This file is for a HOSTED
-- project only, where the owner's auth user id isn't known ahead of time.
--
-- Run this ONCE against the target Supabase project after the owner's
-- auth user has been created (Dashboard -> Authentication -> Add user,
-- or `supabase auth admin` -- public signup must stay disabled). This
-- inserts the single profiles row; it is not a migration because it
-- depends on a specific auth.users id that only exists after that manual
-- step, and profiles has no client INSERT policy (spec §10) by design.
--
-- Usage:
--   psql "$SUPABASE_DB_URL" -v owner_id="'<the-owner-auth-user-uuid>'" -f supabase/seed-owner.sql

insert into public.profiles (id, timezone, currency, default_collection_weekdays)
values (:owner_id, 'Asia/Manila', 'PHP', '{1,2,3,4,5,6,7}')
on conflict (id) do nothing;
