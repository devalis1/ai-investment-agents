# Current project status (single source of truth)

Updated: 2026-04-05

## What works today

### Supabase (DB)

- Schema files:
  - `docs/sql/phase-2-assets-ai-insights.sql` — `public.assets`, `public.ai_insights`, baseline RLS
  - `docs/sql/phase-3-public-tickers.sql` — `public.tickers` (+ RLS public `SELECT`)
- Server-side writes use the **service role** key (backend job, GitHub Actions, Next.js server routes that are documented as server-only).

### Backend (data → AI → DB → Telegram)

Location: `apps/backend`

- **Fetcher**
  - Yahoo Finance quote + RSI from daily closes (`yahoo-finance2`).
  - **Headlines (v1):** 3–5 lines per ticker via Yahoo `search` (`fetcher/headlines.ts`); on failure, `headlines: []` and the cycle continues.
  - **Residential / IPv6 resilience:** Undici-based fetch with **IPv4-only DNS** by default (`YAHOO_FETCH_IPV4_ONLY`, see `.env.example`); bounded timeouts (`YAHOO_FETCH_TIMEOUT_MS`); optional `YAHOO_FINANCE_QUERY_HOST`; optional **`FETCH_MARKET_DATA_MODE=dev_stub`** / **`FETCH_MARKET_DATA_FALLBACK=dev_stub`** with `data/dev-market-stub.json` (see `apps/backend/data/dev-market-stub.example.json`).
  - `runFetcher` returns `{ results, failures }`; quote vs chart errors are labeled; **CLI exits non-zero** if every ticker fails fetch (`cycle.ts`). HTTP trigger returns **502** when all market fetches fail.
- **LLM**
  - Local-first: Ollama or LM Studio; structured JSON + repair retries.
  - Optional **Gemini** fallback (`ENABLE_CLOUD_FALLBACK`); default model id kept current in `.env.example`; **`maxOutputTokens`** sized for JSON + reasoning; **`.env.local` overrides shell** (`dotenv` `override: true` in `config/env.ts`).
- **Cycle**
  - **`npm run cycle:daily`** → `src/jobs/cycle.ts`: upsert `assets`, insert `ai_insights`, optional Telegram.
  - Tickers: **`resolveCycleTickers`** — `public.tickers` when any row has `enabled = true`, else **`TICKERS`** env (comma-separated).
- **HTTP worker (on-demand)**
  - `npm run cycle:trigger-server` — `apps/backend/src/server/cycle-trigger-server.ts`; `POST` with `Authorization: Bearer <CYCLE_TRIGGER_SECRET>` and `{ "tickers": string[] }`. Frontend **`CYCLE_TRIGGER_URL`** + **`CYCLE_TRIGGER_SECRET`** proxy to this host.

### Frontend (dashboard)

Location: `apps/frontend`

- Next.js App Router: `assets` + `ai_insights` (client read from Supabase); theme (`next-themes`); watchlist in **localStorage**; ticker search via **`/api/ticker-search`** (server-side).
- **Run analysis:** `POST /api/trigger-cycle` forwards to the backend worker when `CYCLE_TRIGGER_URL` + `CYCLE_TRIGGER_SECRET` are set; otherwise **501** with guidance.
- **Canonical tickers in DB:** `GET`/`POST`/`PATCH`/`DELETE` **`/api/tickers`** (server-side Supabase + **`TICKERS_ADMIN_SECRET`** gate for mutating methods). Local dev: prefer `npm run dev` from `apps/frontend` using **`scripts/run-with-root-env.mjs`** so root `.env.local` loads (see root `.env.example`).

### Automation

- Meta-audit: `npm run audit` (repo root) → `docs/status/latest-audit.md`
- Workflows: `nightly-audit.yml`, `daily-cycle.yml` (GitHub Actions; cloud LLM / secrets as configured)

## How to run (local)

### Backend

```bash
cd apps/backend
npm install
npm run cycle:daily
# or
TICKERS=AAPL,MSFT npm run dev:cycle
```

### Frontend

```bash
cd apps/frontend
npm install
npm run dev
```

Open `http://localhost:3000`.

### HTTP cycle worker (optional)

```bash
cd apps/backend
CYCLE_TRIGGER_SECRET=your_secret npm run cycle:trigger-server
```

### Repo audit

```bash
cd .
npm install
npm run audit
```

## What is still pending

- **PWA baseline (Epic 4):** web app manifest + icons (**AED-24**), then service worker + offline shell (**AED-25**), then docs (**AED-26**). See `docs/04-frontend-pwa-nextjs.md`.
- **Multi-user / auth:** current RLS is prototype-oriented (broad read where documented); tighten when you add real users.
- **Observability:** structured logging / metrics for production (beyond console + GitHub logs).

## Documentation drift to fix (ongoing)

- Keep root `README.md` and `apps/frontend/README.md` aligned with this file after merges.
- Re-run `npm run audit` after sizable changes to refresh `latest-audit.md`.

## Recommended next steps (minimal)

1. **Ship PWA v1:** **AED-24** (manifest + icons), then **AED-25** / **AED-26** as scoped.
2. Optional: deploy **cycle-trigger-server** to a small always-on host or PaaS and set Vercel env for `CYCLE_TRIGGER_*`.
