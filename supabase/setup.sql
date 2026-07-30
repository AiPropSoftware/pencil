-- =============================================================
-- Pencil — full database setup. Paste this whole file into the
-- Supabase SQL Editor and click Run. Safe to re-run (idempotent).
-- =============================================================

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
-- security_invoker = true makes the view respect the QUERYING user's RLS
-- (Postgres 15+), so non-admins only ever see their own profile row through it.
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
  ) as role
from public.profiles p;

grant select on public.profile_with_role to authenticated;

-- ============================================================================
-- Pencil — Stripe billing
-- ============================================================================
-- Tracks the user's Stripe customer + subscription state. The webhook is the
-- only thing that writes this table; the client only reads its own row.
-- ============================================================================

create table if not exists public.subscriptions (
  user_id              uuid primary key references auth.users(id) on delete cascade,
  stripe_customer_id   text unique,
  stripe_subscription_id text unique,
  status               text not null default 'incomplete',  -- active, trialing, past_due, canceled, incomplete
  price_id             text,
  current_period_end   timestamptz,
  cancel_at_period_end boolean not null default false,
  updated_at           timestamptz not null default now()
);

alter table public.subscriptions enable row level security;

grant select on public.subscriptions to authenticated;
-- INSERT / UPDATE happen via service-role from the webhook, never from clients.

drop policy if exists "subscriptions_self_select" on public.subscriptions;
create policy "subscriptions_self_select" on public.subscriptions
  for select to authenticated using (user_id = auth.uid());

-- Convenience: pro/admin if subscription active OR explicit role grant.
create or replace function public.is_paying(_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.has_role(_user_id, 'admin')
    or public.has_role(_user_id, 'pro')
    or exists (
      select 1 from public.subscriptions s
      where s.user_id = _user_id and s.status in ('active', 'trialing')
    );
$$;

revoke all on function public.is_paying(uuid) from public;
grant execute on function public.is_paying(uuid) to authenticated;

-- =============================================================
-- First admin: run AFTER you've signed up once in the app.
-- Promotes your account to admin.
-- =============================================================
insert into public.user_roles (user_id, role)
select id, 'admin' from auth.users where email = 'contact@rhequitiescorp.com'
on conflict (user_id, role) do nothing;
-- ============================================================================
-- Pencil — permanent permit store
-- ============================================================================
-- The map's live pipeline fetches straight from city APIs at load time, which
-- means what's visible depends on each portal's current window, ordering, and
-- uptime. This table makes the data FIRM: a daily ingest (GitHub Actions →
-- service role) upserts every normalized permit, and nothing is ever deleted —
-- when a city trims its window or an API breaks, everything we've ever seen
-- is still here and still on the map.
--
-- Writes: service role only (bypasses RLS; no client-role insert/update
-- grants). Reads: public — these are public records.
-- ============================================================================

create table if not exists public.permits (
  id             text primary key,          -- deterministic: live-<city>-<permit#>
  city           text not null,
  state          text not null,
  name           text not null default '',
  developer      text not null default '',
  lat            double precision not null,
  lng            double precision not null,
  product_type   text not null default 'Infill',
  units          integer not null default 1,
  land_sqft      integer,
  building_sqft  integer,
  stories        integer,
  status         text not null default 'Permitted',
  approved_date  text,                      -- raw string from the source ("—" allowed)
  est_value      bigint,
  price_per_sqft integer,
  description    text not null default '',
  sqft_estimated boolean not null default false,
  first_seen_at  timestamptz not null default now(),
  last_seen_at   timestamptz not null default now()
);

create index if not exists permits_city_idx on public.permits (city);
create index if not exists permits_approved_idx on public.permits (approved_date desc);
create index if not exists permits_last_seen_idx on public.permits (last_seen_at desc);

alter table public.permits enable row level security;

grant select on public.permits to anon, authenticated;

drop policy if exists "permits_public_read" on public.permits;
create policy "permits_public_read" on public.permits
  for select using (true);

-- ============================================================================
-- Pencil — permit store provenance + quarantine
-- ============================================================================
-- Provenance makes every row ADDRESSABLE: which source URL produced it, which
-- ingest run wrote it, and the raw permit number — so a bad ingest (like the
-- Peel-Region/Ontario false positive the canary once caught) can be selected
-- with one predicate instead of guesswork.
--
-- Quarantine (suppressed_at) reconciles "data never disappears" with "wrong
-- data comes off the map": suppressed rows stay in the table and in backups,
-- but the public read policy hides them — the browser physically cannot fetch
-- them, with zero client-code changes. Reversible any time.
-- ============================================================================

alter table public.permits
  add column if not exists source_key        text,
  add column if not exists source_url        text,
  add column if not exists source_permit_no  text,
  add column if not exists ingest_run        text,
  add column if not exists classified_text   text,
  add column if not exists suppressed_at     timestamptz,
  add column if not exists suppressed_reason text;

create index if not exists permits_live_idx on public.permits (suppressed_at) where suppressed_at is null;

drop policy if exists "permits_public_read" on public.permits;
create policy "permits_public_read" on public.permits
  for select using (suppressed_at is null);

-- approved_date carried "—" placeholders from the first ingest; real nulls
-- sort correctly (nullslast) and stop poisoning date-ordered reads.
update public.permits
  set approved_date = null
  where approved_date is not null and approved_date !~ '^\d{4}-\d{2}-\d{2}';
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
