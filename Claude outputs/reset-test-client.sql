-- Resets just the CLIENT side of the invite-link test loop.
-- Run this in the Supabase SQL editor before each retest. Safe to re-run
-- as many times as you want.
--
-- What it does:
--   1. Un-claims the test client's profile - keeps the nickname, the
--      invite_token (so your existing "Copy Invite Link" URL keeps
--      working, no need to re-copy it), and any saved program. It just
--      forgets which account claimed it.
--   2. Deletes the test client's Supabase Auth account entirely, so
--      "Create Account" on the invite link works again instead of
--      erroring with "User already registered".
--
-- Edit the email below if you ever use a different test client address.

update public.clients
set client_user_id = null,
    invite_claimed_at = null
where email = 'test.client@gmail.com';

delete from public.profiles where email = 'test.client@gmail.com';
delete from auth.users where email = 'test.client@gmail.com';


-- ---------------------------------------------------------------------
-- Optional: FULL reset (uncomment and run instead if you ever want a
-- completely blank slate - wipes every client, program, and program
-- history, AND deletes both test accounts including the coach. You'd
-- need to sign up as the coach again and recreate the client from
-- scratch afterward.
-- ---------------------------------------------------------------------

-- truncate table public.program_versions, public.programs, public.clients cascade;
-- delete from public.profiles where email in ('test.coach@gmail.com', 'test.client@gmail.com');
-- delete from auth.users where email in ('test.coach@gmail.com', 'test.client@gmail.com');
