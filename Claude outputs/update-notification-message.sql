-- Run this once. It updates notify_program_updated() so the notification
-- message is exactly the note the app now saves (e.g. "Your coach updated
-- your program - Schedule added/removed/edited"), instead of the old
-- behavior which always glued a generic "Your coach updated your program:"
-- prefix in front of whatever note was passed. The app now builds the full,
-- specific sentence itself, so the trigger just needs to use it as-is.
--
-- No table/column/trigger changes - this only replaces the function body,
-- so it's safe to run even while the app is live.

create or replace function public.notify_program_updated()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.notifications (client_id, program_version_id, message)
  values (
    new.client_id,
    new.id,
    coalesce(nullif(new.note, ''), 'Your coach updated your program.')
  );
  return new;
end;
$$;
