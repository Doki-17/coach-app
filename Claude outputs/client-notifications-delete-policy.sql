-- Adds the missing DELETE policy for the "Clear All" button on the client's
-- notification panel. Safe to run even if you already ran
-- client-notifications-migration.sql - this only adds what that file didn't
-- include.

drop policy if exists "notifications: client can delete own" on public.notifications;
create policy "notifications: client can delete own"
on public.notifications for delete
to authenticated
using (
  client_id in (select id from public.clients where client_user_id = auth.uid())
);
