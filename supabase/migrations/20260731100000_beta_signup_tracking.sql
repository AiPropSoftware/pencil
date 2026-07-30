-- ============================================================================
-- Pencil — beta funnel: phone on signup + usage tracking
-- ============================================================================
-- Signup now collects name + phone + email; every signed-in action can log a
-- usage event so the team can see how much and how long each beta user
-- actually uses Pencil. Users write only their own events; only admins read.
-- ============================================================================

alter table public.profiles add column if not exists phone text;

-- New signups carry phone in the auth metadata → copy it onto the profile.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url, phone)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name'),
    new.raw_user_meta_data->>'avatar_url',
    new.raw_user_meta_data->>'phone'
  )
  on conflict (id) do nothing;

  insert into public.user_roles (user_id, role)
  values (new.id, 'free')
  on conflict (user_id, role) do nothing;

  return new;
end;
$$;

-- ---------- usage events -----------------------------------------------------
create table if not exists public.usage_events (
  id         bigint generated always as identity primary key,
  user_id    uuid not null references auth.users(id) on delete cascade,
  event      text not null,
  meta       jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists usage_events_user_idx on public.usage_events (user_id, created_at desc);
create index if not exists usage_events_time_idx on public.usage_events (created_at desc);

alter table public.usage_events enable row level security;

grant select, insert on public.usage_events to authenticated;

drop policy if exists "usage_events_insert_own" on public.usage_events;
create policy "usage_events_insert_own" on public.usage_events
  for insert with check (user_id = auth.uid());

drop policy if exists "usage_events_admin_select" on public.usage_events;
create policy "usage_events_admin_select" on public.usage_events
  for select using (public.has_role(auth.uid(), 'admin'));

-- Admin roster now shows phone + how active each beta user is.
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
     and e.created_at > now() - interval '30 days') as events_30d
from public.profiles p;

grant select on public.profile_with_role to authenticated;
