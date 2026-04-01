# Current project status (single source of truth)

Updated: 2026-04-01

## What works today

### Supabase (DB)

- Schema file: `docs/sql/phase-2-assets-ai-insights.sql`
- Tables:
  - `public.assets`
  - `public.ai_insights`
- RLS enabled with public `SELECT` policies (prototype).
- Server-side writes use the service role key.

### Backend (data -> AI -> DB -> Telegram)

Location: `apps/backend`

- Fetcher:
  - Yahoo Finance quote + RSI computed from daily closes
  - Code: `apps/backend/src/fetcher/*`
- LLM:
  - Local-first: Ollama or LM Studio
  - Structured JSON validation + repair retries
  - Deterministic settings to reduce drift
  - Qwen “thinking” models are handled with `think: false` in Ollama requests
  - Optional cloud fallback: Gemini (used by GitHub Actions)
- Cycle job (end-to-end):
  - Upserts `assets`
  - Inserts `ai_insights`
  - Sends Telegram notifications if configured
  - Entry: `apps/backend/src/jobs/cycle.ts`

### Frontend (read-only dashboard)

Location: `apps/frontend`

- Next.js App Router dashboard:
  - Reads `assets` + `ai_insights` from Supabase
  - Client-side join via `asset_id`
  - Loading/error/empty states
  - Ticker input persisted in `localStorage` (UI-only)
- Entry:
  - `apps/frontend/app/page.tsx`
  - `apps/frontend/components/dashboard/DashboardClient.tsx`

### Automation

- Meta-audit script:
  - Run: `npm run audit` (repo root)
  - Writes: `docs/status/latest-audit.md`
- GitHub scheduled workflows:
  - `nightly-audit.yml`: runs the audit and uploads `latest-audit.md`
  - `daily-cycle.yml`: runs the daily cycle in GitHub Actions using Gemini cloud (Actions can’t call local Ollama)

## How to run (local)

### Backend

```bash
cd apps/backend
npm install

# Runs a local end-to-end cycle (reads TICKERS from env, defaults exist in the demo)
TICKERS=AAPL,MSFT,NVDA npm run dev:cycle
```

### Frontend

```bash
cd apps/frontend
npm install
npm run dev
```

Open `http://localhost:3000`.

### Repo audit

```bash
cd .
npm install
npm run audit
```

## What is still pending

### Product/feature gaps

- Headlines/news provider for richer reasoning (currently `headlines: []`).
- A “source of truth” for tickers in the DB (right now: env `TICKERS` + UI-localStorage).
- A frontend action to add/update tickers (and/or trigger a cycle run).
- PWA features (manifest/service worker/offline).

### Documentation drift to fix

- Root `README.md` and `apps/frontend/README.md` should reflect that backend cycle + frontend dashboard exist.

## Recommended next steps (minimal)

1. Update `README.md` and `apps/frontend/README.md` to match the current status.
2. Decide how tickers are managed:
   - keep `TICKERS` env-only (simplest single-user), or
   - add a `tickers` table and manage it from the UI.
3. Add a minimal headlines provider (even 3–5 headlines per ticker) and pass into the LLM.

