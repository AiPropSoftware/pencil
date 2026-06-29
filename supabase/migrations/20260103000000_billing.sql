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
