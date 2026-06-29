-- ============================================================================
-- Pencil — initial schema
-- ============================================================================
-- Roles + profiles + deals + saved_polygons + builder_directory.
-- Every public table has explicit GRANTs and RLS policies. Roles live in a
-- separate user_roles table and are checked via has_role() SECURITY DEFINER
-- so policies never reference a role column on the same row they're protecting.
-- ============================================================================

create extension if not exists "pgcrypto";

-- ---------- Enums ------------------------------------------------------------
do $$ begin
  create type public.app_role as enum ('admin', 'pro', 'free');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.product_type as enum ('sfh','duplex','fourplex','small_multi','infill','other');
exception when duplicate_object then null; end $$;

-- ---------- profiles ---------------------------------------------------------
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  email       text not null,
  full_name   text,
  avatar_url  text,
  created_at  timestamptz not null default now()
);

alter table public.profiles enable row level security;

grant select, insert, update on public.profiles to authenticated;

drop policy if exists "profiles_self_select" on public.profiles;
create policy "profiles_self_select" on public.profiles
  for select to authenticated using (id = auth.uid());

drop policy if exists "profiles_self_insert" on public.profiles;
create policy "profiles_self_insert" on public.profiles
  for insert to authenticated with check (id = auth.uid());

drop policy if exists "profiles_self_update" on public.profiles;
create policy "profiles_self_update" on public.profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- ---------- user_roles + has_role() -----------------------------------------
create table if not exists public.user_roles (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  role        public.app_role not null,
  created_at  timestamptz not null default now(),
  unique (user_id, role)
);

alter table public.user_roles enable row level security;

grant select on public.user_roles to authenticated;

-- has_role: SECURITY DEFINER so policies can call it without recursion.
create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = _user_id and role = _role
  );
$$;

revoke all on function public.has_role(uuid, public.app_role) from public;
grant execute on function public.has_role(uuid, public.app_role) to authenticated, anon;

drop policy if exists "user_roles_self_select" on public.user_roles;
create policy "user_roles_self_select" on public.user_roles
  for select to authenticated using (user_id = auth.uid());

drop policy if exists "user_roles_admin_all" on public.user_roles;
create policy "user_roles_admin_all" on public.user_roles
  for all to authenticated
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

-- ---------- profile + default role bootstrap --------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name'),
    new.raw_user_meta_data->>'avatar_url'
  )
  on conflict (id) do nothing;

  insert into public.user_roles (user_id, role)
  values (new.id, 'free')
  on conflict (user_id, role) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- deals ------------------------------------------------------------
create table if not exists public.deals (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  name        text not null,
  address     text,
  inputs      jsonb not null default '{}'::jsonb,
  results     jsonb not null default '{}'::jsonb,
  notes       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists deals_user_id_created_at_idx on public.deals (user_id, created_at desc);

alter table public.deals enable row level security;

grant select, insert, update, delete on public.deals to authenticated;

drop policy if exists "deals_owner_all" on public.deals;
create policy "deals_owner_all" on public.deals
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- updated_at trigger
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

drop trigger if exists deals_touch_updated_at on public.deals;
create trigger deals_touch_updated_at
  before update on public.deals
  for each row execute function public.touch_updated_at();

-- ---------- saved_polygons (Geo Developer Map) ------------------------------
create table if not exists public.saved_polygons (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  name        text not null,
  geojson     jsonb not null,
  created_at  timestamptz not null default now()
);

alter table public.saved_polygons enable row level security;

grant select, insert, update, delete on public.saved_polygons to authenticated;

drop policy if exists "saved_polygons_owner_all" on public.saved_polygons;
create policy "saved_polygons_owner_all" on public.saved_polygons
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ---------- builder_directory ----------------------------------------------
-- Shared, curated directory. Readable by any pro+ user; writable by admins only.
create table if not exists public.builder_directory (
  id                 uuid primary key default gen_random_uuid(),
  metro              text not null,
  name               text not null,
  contact_url        text,
  phone              text,
  license_no         text,
  product_types      public.product_type[] not null default '{}',
  active_projects    integer not null default 0,
  typical_price_band text,
  notes              text,
  created_at         timestamptz not null default now()
);

create index if not exists builder_directory_metro_idx on public.builder_directory (metro);

alter table public.builder_directory enable row level security;

grant select on public.builder_directory to authenticated;
grant insert, update, delete on public.builder_directory to authenticated;

drop policy if exists "builders_pro_select" on public.builder_directory;
create policy "builders_pro_select" on public.builder_directory
  for select to authenticated
  using (
    public.has_role(auth.uid(), 'pro') or public.has_role(auth.uid(), 'admin')
  );

drop policy if exists "builders_admin_write" on public.builder_directory;
create policy "builders_admin_write" on public.builder_directory
  for all to authenticated
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));
