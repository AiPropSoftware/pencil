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
