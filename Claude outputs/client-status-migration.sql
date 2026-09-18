-- Active/inactive status per client, for archiving a client without
-- deleting anything - their profile, saved program, and full history are
-- untouched either way.
--
-- Run this whole file once in the Supabase SQL editor.

alter table public.clients
  add column if not exists status text not null default 'active'
    check (status in ('active', 'inactive'));
