# Current project status (single source of truth)

Updated: 2026-04-03

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
- **No in-repo HTTP server** for the cycle; CLI + scheduled jobs only.

### Frontend (dashboard)

Location: `apps/frontend`

- Next.js App Router dashboard:
  - Reads `assets` + `ai_insights` from Supabase (client join via `asset_id`)
  - Light/dark theme (`next-themes`), calm token-based styling
  - Ticker search via `GET /api/ticker-search` (Yahoo Finance search JSON, server-side; avoids CORS and keeps keys off the client)
  - Structured **watchlist** in `localStorage` (`ai-investment-agents:watchlist`) plus legacy comma field `ai-investment-agents:ticker-input`
  - **Analyze selected / watchlist** calls `POST /api/trigger-cycle`; without `CYCLE_TRIGGER_URL` + `CYCLE_TRIGGER_SECRET` the API returns **501** and the UI explains next steps
  - Loading skeletons, recommendation badges, expandable reasoning, watchlist filter on insights
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
- A “source of truth” for tickers in the **database** (right now: env `TICKERS` + UI localStorage watchlist).
- **HTTP worker** that runs `analyzeCycle` so `CYCLE_TRIGGER_URL` can execute analysis from Vercel without shipping service keys to the browser.
- PWA features (manifest/service worker/offline).

### Documentation drift to fix

- Root `README.md` and `apps/frontend/README.md` should stay aligned with this file after changes.

## Recommended next steps (minimal)

1. Add a small **authenticated** backend HTTP service (or serverless function) that calls `analyzeCycle` with service role env, and point `CYCLE_TRIGGER_URL` at it.
2. Decide how tickers are managed long-term:
   - keep env `TICKERS` + local watchlist (simplest), or
   - add a `tickers` table and sync from the UI.
3. Add a minimal headlines provider (even 3–5 headlines per ticker) and pass into the LLM.
