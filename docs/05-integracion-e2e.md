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
- Next step is scheduling the cycle (cron) and building the frontend dashboard in `apps/frontend`.

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

## Tests

- Smoke test: an example ticker generates a recommendation and appears in the UI.
- Resilience test: upstream rate limit -> the job retries and the pipeline does not break.

