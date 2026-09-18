-- Invite-link based client onboarding
-- Run this whole file once in the Supabase SQL editor.

-- 1. Every client gets a random, unguessable invite token automatically.
alter table public.clients
  add column if not exists invite_token uuid not null default gen_random_uuid() unique;

alter table public.clients
  add column if not exists invite_claimed_at timestamptz;

-- 2. Retire the old "self-claim by matching email" policy - claiming now
--    happens through claim_invite() below instead, using the token from
--    the invite link rather than trusting whatever email a client typed in.
--    (Harmless if this policy was already named differently or removed -
--    check `select policyname from pg_policies where tablename = 'clients';`
--    if this errors.)
drop policy if exists "clients: self-claim by email" on public.clients;

-- 3. The one function that's allowed to link a signed-in account to a
--    client row. security definer lets it bypass RLS just enough to do
--    that one linkage check server-side; the WHERE clause is what keeps
--    it safe - it only succeeds for the exact token, and only if the
--    profile is unclaimed or already claimed by this same account
--    (so re-visiting the link to sign back in works too).
create or replace function public.claim_invite(p_token uuid)
returns public.clients
language plpgsql
security definer
set search_path = public
as $$
declare
  result public.clients;
begin
  update public.clients
  set client_user_id = auth.uid(),
      invite_claimed_at = coalesce(invite_claimed_at, now())
  where invite_token = p_token
    and (client_user_id is null or client_user_id = auth.uid())
  returning * into result;

  if result.id is null then
    raise exception 'Invalid or already-used invite link.';
  end if;

  return result;
end;
$$;

grant execute on function public.claim_invite(uuid) to authenticated;
