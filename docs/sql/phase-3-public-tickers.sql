-- Phase 3: Canonical ticker list (`public.tickers`) for the analyze cycle
--
-- Apply order (Supabase SQL editor or migration runner):
--   1. docs/sql/phase-2-assets-ai-insights.sql  — assets + ai_insights + baseline RLS
--   2. docs/sql/phase-3-public-tickers.sql      — this file
--
-- Resolution (backend CLI `npm run cycle:daily`):
--   If at least one row exists with enabled = true, the cycle uses those tickers
--   (after normalization). Otherwise it uses the TICKERS environment variable
--   (comma-separated, same default as before: AAPL,MSFT,NVDA).
--
-- Single-user prototype assumptions:
--   - RLS allows anonymous SELECT (dashboard can read the list without auth).
--   - Writes go through the Supabase service role (backend GitHub Action / local CLI);
--     anon/authenticated roles have no INSERT/UPDATE/DELETE policies yet.
--   - Managing rows via SQL editor or Table Editor is expected until AED-14 (UI CRUD).

create table if not exists public.tickers (
  ticker text primary key,
  enabled boolean not null default true,
  created_at timestamptz not null default now()
);

comment on  table public.tickers is
  'Canonical symbols for the daily cycle when at least one enabled row exists; otherwise TICKERS env is used.';

alter table public.tickers enable row level security;

drop policy if exists "tickers_select_public" on public.tickers;
create policy "tickers_select_public"
  on public.tickers for select
  using (true);

-- Optional seed (comment out if you prefer env-only until you add rows manually):
-- insert into public.tickers (ticker, enabled) values
--   ('AAPL', true),
--   ('MSFT', true),
--   ('NVDA', true)
-- on conflict (ticker) do nothing;
