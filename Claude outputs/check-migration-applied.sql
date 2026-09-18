-- Quick check: did the invite-link migration actually apply?
-- Run this in the SQL editor - if either query comes back empty, the
-- migration hasn't run yet (or only partially ran) - run
-- invite-link-migration.sql again.

select column_name
from information_schema.columns
where table_schema = 'public'
  and table_name = 'clients'
  and column_name in ('invite_token', 'invite_claimed_at');

select proname
from pg_proc
where proname = 'claim_invite';
