# Backend (Supabase / Edge / Node)

## Local LLM Configuration (Ollama / LM Studio)

This module will host:

- Supabase schema (tables, RLS policies, triggers if needed)
- Serverless functions (e.g. daily `fetcher` for Yahoo Finance)
- AI agent orchestration (model calls with *structured output*)
- Telegram notifications

## Local LLM configuration (Ollama / LM Studio)

1. Create a `.env.local` file in the **project root** (`ai-investment-agents/`), using `.env.example` as the base.
2. Set `LLM_LOCAL_PROVIDER` to:
   - `ollama` or
   - `lmstudio`
3. For `ollama`:
   - `OLLAMA_BASE_URL` (default `http://localhost:11434`)
   - `OLLAMA_MODEL` (default `qwen3.5:latest`)
4. For `lmstudio`:
   - `LMSTUDIO_BASE_URL` (default `http://localhost:1234/v1`)
   - `LMSTUDIO_MODEL` (TODO: set the exact model id installed in LM Studio)

The backend tries local inference first; the cloud fallback is prepared but **disabled by default**.

Next step: initialize the Supabase stack (project/CLI) and define the `assets`/`ai_insights` data contract.

## HTTP cycle trigger (for `CYCLE_TRIGGER_URL`)

Run a minimal server that accepts authenticated POSTs and calls `analyzeCycle` (`apps/backend/src/jobs/cycle.ts`):

```bash
cd apps/backend
npm install
# Uses root `.env.local` for SUPABASE_*, LLM, Telegram (same as CLI). Required:
export CYCLE_TRIGGER_SECRET="same-value-as-vercel-server-env"
npm run cycle:trigger-server
# Listens on CYCLE_TRIGGER_SERVER_PORT or PORT (default 8787)
```

- **POST** `/` or `/trigger` with JSON `{ "tickers": ["AAPL"] }` and header `Authorization: Bearer <CYCLE_TRIGGER_SECRET>`.
- **GET** `/health` for probes.

**Secrets:** `SUPABASE_SERVICE_ROLE_KEY`, LLM keys, and Telegram tokens stay only in the worker environment (or local `.env.local`). Never add them to `NEXT_PUBLIC_*` on the frontend.

**Timeouts:** The job can run a long time (up to ~240s per ticker for LLM in `cycle.ts`). Host the worker on a platform with a request timeout that fits your batch size (always-on VM, Fly, Railway, Cloud Run with high timeout). Vercel **Pro** route handlers can use `maxDuration` up to several minutes for the **Next.js proxy** (`apps/frontend/app/api/trigger-cycle/route.ts`); Hobby limits are lower—see `docs/status/current.md`.

