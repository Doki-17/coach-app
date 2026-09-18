-- Client notifications: a client gets a notification row every time their
-- coach saves a new version of their program (a real edit, a fresh "New
-- Program", or a restore - anything that lands in program_versions).
-- Run this whole file once in the Supabase SQL editor.

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  program_version_id uuid references public.program_versions(id) on delete cascade,
  message text not null default 'Your coach updated your program.',
  created_at timestamptz not null default now(),
  read_at timestamptz
);

alter table public.notifications enable row level security;

-- A client can only ever see/mark-read notifications tied to their own
-- claimed client profile - the same client_user_id linkage used everywhere
-- else (programs, program_versions).
drop policy if exists "notifications: client can view own" on public.notifications;
create policy "notifications: client can view own"
on public.notifications for select
to authenticated
using (
  client_id in (select id from public.clients where client_user_id = auth.uid())
);

drop policy if exists "notifications: client can mark own read" on public.notifications;
create policy "notifications: client can mark own read"
on public.notifications for update
to authenticated
using (
  client_id in (select id from public.clients where client_user_id = auth.uid())
)
with check (
  client_id in (select id from public.clients where client_user_id = auth.uid())
);

-- No INSERT policy for authenticated users - rows are only ever created by
-- the trigger below, which runs as security definer (same pattern as
-- handle_new_user/claim_invite) so it can write regardless of who (the
-- coach) triggered the save.
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
    'Your coach updated your program' || case when coalesce(new.note, '') <> '' then ': ' || new.note else '.' end
  );
  return new;
end;
$$;

drop trigger if exists on_program_version_created on public.program_versions;
create trigger on_program_version_created
after insert on public.program_versions
for each row execute function public.notify_program_updated();
