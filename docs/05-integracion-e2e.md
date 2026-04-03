# Phase 5: End-to-end integration (DB + AI + Telegram)

Goal: validate the full flow:

`ticker` -> `fetcher` -> persistence in `assets/ai_insights` -> Telegram notification -> UI shows results.

## Checklist

1. Confirm `fetcher` runs daily and creates/updates records.
2. Implement the analysis cycle that calls the LLM and persists `ai_insights`.
3. Send Telegram notifications when an analysis completes or on critical errors.
4. Confirm the frontend shows the most recent data.

## Current status

- The end-to-end cycle runs locally via `apps/backend` using service role writes to Supabase and Telegram notifications.
- A scheduled GitHub Actions workflow can run the cycle daily (`daily-cycle.yml`).
- The frontend dashboard in `apps/frontend` can list results from Supabase, search tickers, maintain a local watchlist, and call `POST /api/trigger-cycle` when a separate HTTP worker URL + secret are configured—otherwise analysis still runs via backend CLI or Actions.

## Daily Run (scheduling)

The simplest, no-infra option is to run the backend cycle as a cron job on any machine that:

- Has Node.js installed
- Can reach Supabase and your LLM provider (local or cloud)
- Has the project folder available (or a checkout)

### One-off manual run

From `apps/backend/`:

```bash
npm run cycle:daily
```

This reads `TICKERS` from environment and defaults to `AAPL,MSFT,NVDA` if missing.

### Cron (daily)

Example cron entry (runs every day at 06:15):

```cron
15 6 * * * cd /ABS/PATH/ai-investment-agents/apps/backend && /usr/bin/env TICKERS="AAPL,MSFT,NVDA" CYCLE_HARD_TIMEOUT_MS="1800000" npm run -s cycle:daily >> /var/log/ai-cycle.log 2>&1
```

Notes:

- The backend auto-loads `.env.local` (it searches a few parent directories), so Supabase/Telegram/LLM variables can live there.
- `CYCLE_HARD_TIMEOUT_MS` is a safety net so the job never hangs silently (default is 30 minutes).
- Output is appended to a log file so you can inspect the last run.

### GitHub Actions (daily, repo-native)

If you prefer scheduling inside the repo (no server to maintain), use GitHub Actions.

This repo includes a scheduled workflow at `.github/workflows/daily-cycle.yml` that runs daily at **06:15 UTC** and also supports manual runs.

Setup in GitHub:

1. Go to **Repo → Settings → Secrets and variables → Actions**
2. Add **Variables**
   - `TICKERS`: `AAPL,MSFT,NVDA` (comma-separated)
3. Add **Secrets**
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - (optional) `TELEGRAM_BOT_TOKEN`
   - (optional) `TELEGRAM_CHAT_ID`
   - `GEMINI_API_KEY`
   - (optional) `GEMINI_MODEL` as a repo variable (defaults to `gemini-1.5-flash`)

Important:

- GitHub Actions runners cannot reach local LLMs like Ollama/LM Studio. Use a cloud key for scheduled runs.

Verify:

- Go to **Actions → Daily analyze cycle → Run workflow** (manual) and confirm logs show inserts into `assets` and `ai_insights`.

## Tests

- Smoke test: an example ticker generates a recommendation and appears in the UI.
- Resilience test: upstream rate limit -> the job retries and the pipeline does not break.

