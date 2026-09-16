-- Diagnose why a program edit didn't produce a client notification.
-- Run each block below in the Supabase SQL editor and check the results.

-- 1. Does the table exist at all? If this returns no rows, the migration
--    (client-notifications-migration.sql) was never run.
select table_name
from information_schema.tables
where table_schema = 'public' and table_name = 'notifications';

-- 2. Does the trigger exist on program_versions? If this returns no rows,
--    saves won't ever create a notification, even though the table exists.
select tgname
from pg_trigger
where tgrelid = 'public.program_versions'::regclass
  and tgname = 'on_program_version_created';

-- 3. Did your test edit actually get saved as a new version at all? Replace
--    the nickname if needed. If this is empty, the edit itself didn't save
--    (a different problem from notifications) - check that first.
select pv.id, pv.timestamp, pv.note, c.nickname
from public.program_versions pv
join public.clients c on c.id = pv.client_id
order by pv.timestamp desc
limit 5;

-- 4. Any notification rows at all, for any client? If (1) and (2) both come
--    back populated but this is empty even after a save happened in (3),
--    something is silently failing inside the trigger function itself -
--    let me know and I'll dig into that function's logic.
select n.id, n.message, n.created_at, n.read_at, c.nickname
from public.notifications n
join public.clients c on c.id = n.client_id
order by n.created_at desc
limit 10;
