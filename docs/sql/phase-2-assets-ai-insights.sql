-- Phase 2: Supabase schema for assets + AI insights
-- Run this in the Supabase SQL editor (or as a migration).

-- Enable UUID generator
create extension if not exists "uuid-ossp";

-- Assets: one row per ticker
create table if not exists public.assets (
  id uuid primary key default uuid_generate_v4(),
  ticker text not null unique,
  name text,
  market text not null check (market in ('US', 'AR')),
  shares numeric,
  avg_price numeric,
  last_analyzed timestamptz
);

-- AI insights: recommendations per asset and timestamp
create table if not exists public.ai_insights (
  id uuid primary key default uuid_generate_v4(),
  asset_id uuid not null references public.assets(id) on delete cascade,
  created_at timestamptz not null default now(),
  recommendation text not null,
  reasoning text not null,
  key_headlines jsonb,
  current_price numeric
);

-- Row Level Security (RLS)
alter table public.assets enable row level security;
alter table public.ai_insights enable row level security;

-- Public reads for the initial single-user prototype.
-- TODO: Add per-user ownership when we add auth.
drop policy if exists "assets_select_public" on public.assets;
create policy "assets_select_public"
  on public.assets for select
  using (true);

drop policy if exists "ai_insights_select_public" on public.ai_insights;
create policy "ai_insights_select_public"
  on public.ai_insights for select
  using (true);

-- Writes are intended for server-side code (service role bypasses RLS).
-- We still keep write policies restrictive by default.
-- If you introduce authenticated users, add INSERT/UPDATE policies for `authenticated`.

