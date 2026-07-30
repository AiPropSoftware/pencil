-- ============================================================================
-- Pencil — "days used" metric on the admin roster
-- ============================================================================
-- active_days = number of distinct calendar days on which the user generated
-- at least one usage event (the app guarantees a daily ping per active day).
-- ============================================================================

create or replace view public.profile_with_role
with (security_invoker = true) as
select
  p.id,
  p.email,
  p.full_name,
  p.created_at,
  coalesce(
    (select role from public.user_roles ur where ur.user_id = p.id order by created_at desc limit 1),
    'free'::public.app_role
  ) as role,
  p.phone,
  (select max(e.created_at) from public.usage_events e where e.user_id = p.id) as last_active,
  (select count(*) from public.usage_events e where e.user_id = p.id
     and e.created_at > now() - interval '30 days') as events_30d,
  (select count(distinct (e.created_at at time zone 'utc')::date)
     from public.usage_events e where e.user_id = p.id) as active_days
from public.profiles p;

grant select on public.profile_with_role to authenticated;
