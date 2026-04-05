# Current project status (single source of truth)

Updated: 2026-04-03

## What works today

### Supabase (DB)

- Schema files (apply in order): `docs/sql/phase-2-assets-ai-insights.sql`, then `docs/sql/phase-3-public-tickers.sql`
- Tables:
  - `public.assets`
  - `public.ai_insights`
  - `public.tickers` — canonical cycle symbols when at least one `enabled` row exists; otherwise the backend uses `TICKERS` env (see `docs/02-bd-esquema-y-fetcher.md`)
- RLS enabled with public `SELECT` policies on these tables (single-user prototype).
- Server-side writes use the service role key.

### Backend (data -> AI -> DB -> Telegram)

Location: `apps/backend`

- Fetcher:
  - Yahoo Finance quote + RSI computed from daily closes
  - Per-ticker **headlines** (3–5 lines) from Yahoo `search` news, with safe logs (`[headlines]`: latency, attempts, `providerId`, counts — no secrets)
  - Code: `apps/backend/src/fetcher/*`
- LLM:
  - Local-first: Ollama or LM Studio
  - Structured JSON validation + repair retries
  - Deterministic settings to reduce drift
  - Qwen “thinking” models are handled with `think: false` in Ollama requests
  - Optional cloud fallback: Gemini (used by GitHub Actions)
- Cycle job (end-to-end):
  - Resolves ticker list from `public.tickers` when enabled rows exist, else from `TICKERS` env
  - Upserts `assets`
  - Inserts `ai_insights`
  - Sends Telegram notifications if configured
  - Entry: `apps/backend/src/jobs/cycle.ts` (resolution: `apps/backend/src/tickers/resolveCycleTickers.ts`)
- **HTTP cycle worker** (`apps/backend/src/server/cycle-trigger-server.ts`): POST `{ "tickers": string[] }` with `Authorization: Bearer <CYCLE_TRIGGER_SECRET>` (same secret as Vercel `CYCLE_TRIGGER_SECRET`), runs `analyzeCycle`. Start: `cd apps/backend && npm run cycle:trigger-server` (default port `8787`). Health: `GET /health`.

### Frontend (dashboard)

Location: `apps/frontend`

- Next.js App Router dashboard:
  - Reads `assets` + `ai_insights` from Supabase (client join via `asset_id`)
  - Light/dark theme (`next-themes`), calm token-based styling
  - Ticker search via `GET /api/ticker-search` (Yahoo Finance search JSON, server-side; avoids CORS and keeps keys off the client)
  - Structured **watchlist** in `localStorage` (`ai-investment-agents:watchlist`) plus legacy comma field `ai-investment-agents:ticker-input`
  - **Analyze selected / watchlist** calls `POST /api/trigger-cycle`; set Vercel **server** env `CYCLE_TRIGGER_URL` (worker base URL, e.g. `https://host/` or `https://host/trigger`) and `CYCLE_TRIGGER_SECRET` (shared with the worker). Optional `CYCLE_TRIGGER_PROXY_TIMEOUT_MS` (default 240000). Route `maxDuration` is 240s. Without URL/secret the API returns **501**.
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

# Runs a local end-to-end cycle (uses public.tickers when populated; else TICKERS env)
TICKERS=AAPL,MSFT,NVDA npm run dev:cycle

# HTTP worker for the frontend trigger (needs CYCLE_TRIGGER_SECRET + Supabase + LLM in .env.local)
CYCLE_TRIGGER_SECRET=dev-shared-secret npm run cycle:trigger-server
```

**Timeouts / hosting:** Each ticker may take up to ~240s for LLM + DB (`cycle.ts`). The Next.js proxy aborts after `CYCLE_TRIGGER_PROXY_TIMEOUT_MS` (default 240s) per request — one long ticker can hit that ceiling; use fewer tickers per request or host the worker on an always-on VM with no platform wall clock below your needs. On **Vercel**, Fluid route handlers are capped by plan (`maxDuration` on `trigger-cycle` is set to 240s); **Pro** supports long-running functions better than **Hobby**. For heavy batches, run the worker on Fly.io, Railway, Render, a small VPS, or Cloud Run with a high request timeout — never expose service-role keys to the browser.

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
- UI sync to `public.tickers` (local watchlist remains client-only until AED-14).
- PWA features (manifest/service worker/offline).

### Documentation drift to fix

- Root `README.md` and `apps/frontend/README.md` should stay aligned with this file after changes.

## Recommended next steps (minimal)

1. Optional: UI or authenticated policies for editing `public.tickers` (AED-14).
2. Add a minimal headlines provider (even 3–5 headlines per ticker) and pass into the LLM.
