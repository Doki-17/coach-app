-- Confirms which client the two existing notifications belong to, and
-- whether that client has a claimed account yet (client_user_id set).
-- If client_user_id is null, nobody has claimed that profile's invite link
-- yet, so there's no account that COULD see these notifications - that
-- alone would explain "No notifications yet." when checked as any other
-- signed-in client.

select
  c.id as client_id,
  c.nickname,
  c.email,
  c.client_user_id,
  c.invite_claimed_at,
  count(n.id) as notification_count
from public.clients c
left join public.notifications n on n.client_id = c.id
group by c.id, c.nickname, c.email, c.client_user_id, c.invite_claimed_at
order by notification_count desc;
