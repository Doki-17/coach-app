-- Adds a per-client notification settings field, starting with just an
-- "email notifications" toggle (the actual email sending via Resend is a
-- later step - this just gives the client a place to turn it on/off ahead
-- of that, and leaves room to add more settings to the same jsonb blob
-- later without another migration).
--
-- Run this whole file once in the Supabase SQL editor.

alter table public.clients
  add column if not exists notification_settings jsonb not null default '{"email_enabled": false}'::jsonb;

-- The one function a signed-in client can call to change their own
-- notification settings. Same pattern as claim_invite()/notify_program_updated():
-- security definer so it can write regardless of the fact that there's no
-- general "clients can update their own row" policy, but scoped tightly by
-- both the WHERE clause (only the row whose client_user_id is this account)
-- and by only ever touching the notification_settings column - never
-- nickname, weight, remarks, or anything else on that row.
create or replace function public.update_notification_settings(p_email_enabled boolean)
returns public.clients
language plpgsql
security definer
set search_path = public
as $$
declare
  result public.clients;
begin
  update public.clients
  set notification_settings = jsonb_set(
    coalesce(notification_settings, '{}'::jsonb),
    '{email_enabled}',
    to_jsonb(p_email_enabled)
  )
  where client_user_id = auth.uid()
  returning * into result;

  if result.id is null then
    raise exception 'No client profile linked to this account.';
  end if;

  return result;
end;
$$;

grant execute on function public.update_notification_settings(boolean) to authenticated;
