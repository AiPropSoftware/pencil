-- ============================================================================
-- Pencil — admin role management
-- ============================================================================
-- 1. Admins can read every profile (needed for the /admin user list).
-- 2. set_user_role() RPC: a single SECURITY DEFINER entrypoint that
--    promotes/demotes a target user to exactly one of admin/pro/free,
--    so the client never has to issue raw inserts/deletes from RLS-trusted
--    contexts. Guarded by has_role(auth.uid(), 'admin').
-- ============================================================================

drop policy if exists "profiles_admin_select" on public.profiles;
create policy "profiles_admin_select" on public.profiles
  for select to authenticated
  using (public.has_role(auth.uid(), 'admin'));

-- set_user_role: atomic role replacement.
create or replace function public.set_user_role(_target uuid, _role public.app_role)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Only admins may call this.
  if not public.has_role(auth.uid(), 'admin') then
    raise exception 'unauthorized' using errcode = '42501';
  end if;

  -- Don't let an admin demote themselves and accidentally lock everyone out.
  if _target = auth.uid() and _role <> 'admin' then
    raise exception 'cannot demote yourself' using errcode = '22023';
  end if;

  delete from public.user_roles where user_id = _target;
  insert into public.user_roles (user_id, role) values (_target, _role);
end;
$$;

revoke all on function public.set_user_role(uuid, public.app_role) from public;
grant execute on function public.set_user_role(uuid, public.app_role) to authenticated;

-- Convenience view: every profile joined with its current role.
-- Read-protected by profiles' RLS (admins only see all rows).
create or replace view public.profile_with_role as
select
  p.id,
  p.email,
  p.full_name,
  p.created_at,
  coalesce(
    (select role from public.user_roles ur where ur.user_id = p.id order by created_at desc limit 1),
    'free'::public.app_role
  ) as role
from public.profiles p;

grant select on public.profile_with_role to authenticated;
