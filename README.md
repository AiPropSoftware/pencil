# Pencil

> The all-inclusive platform where investors become developers.

Pencil is the software companion to the **Developer Launch** playbook — the
$40K GoButterfly coaching program that teaches high-income professionals
and investors with $200K–$600K+ in capital to build small multifamily and
infill developments instead of buying turnkey rentals. Pencil replaces the
playbook's spreadsheets and guesswork with software so any investor can
underwrite, locate, and execute a ground-up development deal.

---

## Modules

| Module | What it does |
| --- | --- |
| **Deal Analyzer** | Ports the Developer Launch underwriting model: project costs, construction loan, carry, optional refi, optional capital partner, rental operating, and partner waterfall. Live results panel with cash-on-cash, DSCR, cap rate, profit margin. Print-to-PDF + AI Notes memo. |
| **Geo Developer Map** | Drop a pin or draw a polygon; surfaces every active developer in that radius from 12–24 months of permit data, with a profile drawer per developer. Mapbox GL. |
| **Comps Engine** | New-construction sold comps. Median + 25/75 percentile bands, $/sqft scatter, sold-to-list ratio, CSV export, and a one-click send-to-Analyzer that pre-fills ARV. ATTOM. |
| **Builder Directory** | GCs and trades by metro with past projects, license numbers, typical price bands, and a Request-a-Quote CTA. |
| **Pro Forma Library** | Saved deals with side-by-side compare. |

## Data & AI

- **Maps:** Mapbox GL JS
- **Comps:** ATTOM Data API (`supabase/functions/comps-search`)
- **Permits:** Shovels.ai (`supabase/functions/permits-search`)
- **Builder discovery:** Google Places (New) Text Search (`supabase/functions/builder-search`)
- **AI deal memos:** Anthropic Claude via Supabase Edge Function (`supabase/functions/deal-summary`)

All third-party keys live server-side in Supabase Edge Function secrets — never in client bundles.

## Stack

- React 18 + Vite + TypeScript + Tailwind v3 + shadcn/ui primitives
- Supabase (Auth, Postgres + RLS, Edge Functions)
- React Router, TanStack Query, Recharts, Mapbox GL, Sonner toasts

## Design system

Premium light mode by default. Warm off-white background, charcoal text,
restrained gold accent. Playfair Display headings + Inter body.

- **Tokens:** `src/index.css` (HSL CSS variables consumed by Tailwind config)
- **Currency:** `Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 })` via `src/lib/format.ts`
- **Numeric inputs:** `<NumericField />` (comma-formatted display, raw number state, prefix/suffix slots)

## Auth & access

- Supabase Auth — email + Google OAuth
- `profiles` + separate `user_roles` table with `app_role` enum (admin | pro | free)
- `public.has_role(uuid, app_role)` is `SECURITY DEFINER` — policies call it, never the row itself
- `<RequireAuth requireRole="pro">` gates `/deal-analyzer`, `/map`, `/comps`, `/builders`, `/library`

## Getting started

```bash
pnpm install                 # or npm install / bun install
cp .env.example .env.local   # fill in VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, VITE_MAPBOX_TOKEN
pnpm dev
```

### Supabase

```bash
supabase link --project-ref <ref>
supabase db push                         # apply migrations/20260101000000_init.sql
supabase functions deploy deal-summary
supabase functions deploy comps-search
supabase functions deploy permits-search
supabase functions deploy geocode
supabase functions deploy builder-search

supabase secrets set \
  ANTHROPIC_API_KEY=sk-... \
  ATTOM_API_KEY=... \
  SHOVELS_API_KEY=... \
  MAPBOX_TOKEN=... \
  GOOGLE_PLACES_API_KEY=...
```

Without these keys, the UI still renders end-to-end against deterministic
demo data — useful for previews and design review.

## Provider abstraction

Every external data source sits behind a typed interface so you can swap
providers without touching pages:

- `src/providers/comps/` — `CompsProvider` (ATTOM today)
- `src/providers/permits/` — `PermitsProvider` (Shovels today)
- `src/providers/maps/` — Mapbox token + style
- `src/providers/builders/` — Google Places (server-side)

## Project structure

```
src/
  pages/            Landing, DealAnalyzer, Map, Comps, Builders, Library, SignIn, SignUp
  components/       Header, Footer, RequireAuth, MoneyInput, ui/*
  hooks/            useAuth
  integrations/
    supabase/       client.ts, types.ts
  providers/
    maps/           mapbox.ts
    comps/          attom.ts, types.ts, index.ts
    permits/        shovels.ts, types.ts, index.ts
  lib/
    calc/deal.ts    Deal Analyzer math (mortgagePayment, calcDeal)
    format.ts       USD / pct / numeric formatting helpers
supabase/
  migrations/       Initial schema with RLS, has_role(), profile bootstrap trigger
  functions/        Deno edge functions for Anthropic, ATTOM, Shovels, Mapbox, Google Places
```

## Why Pencil

Most investors lose decades buying $300K turnkey duplexes that pay 6%
cash-on-cash. Building the same duplex from scratch yields 18% cash-on-cash
*and* $200K of created equity at refi — but only if you can underwrite,
find a lot, run the comps, and pick the right builder. Pencil does all
four, in one workspace, in light mode.
