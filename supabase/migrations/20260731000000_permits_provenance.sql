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
