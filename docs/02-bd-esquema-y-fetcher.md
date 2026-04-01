# Phase 2: Database (Supabase/Postgres) + `fetcher` (Yahoo Finance)

Goal: create the tables and a process that feeds data from Yahoo Finance into Postgres.

## Minimum schema (tables)

Suggested tables:

- `assets`: one row per ticker (and metadata: market, quantity, average price, etc.)
- `ai_insights`: recommendations per asset and date (`recommendation`, `reasoning`, news, current price)

## Implementation checklist

1. Create tables in Supabase (SQL editor or migrations).
   - Use `docs/sql/phase-2-assets-ai-insights.sql` as the starting point.
2. Ensure `RLS` and minimal permissions (even for a single-user app).
3. Create the `fetcher` function/endpoint (Edge Function or similar).
4. Schedule daily execution (Cron/webhook).
   - Recommended simplest path (no new infra): cron runs the backend cycle script.
   - Command (from `apps/backend/`): `npm run cycle:daily`
   - It reads `TICKERS="AAPL,MSFT,NVDA"` from env and writes into `assets` + `ai_insights`.
   - Repo-native alternative: GitHub Actions scheduled workflow (see `docs/05-integracion-e2e.md`).
5. Verify inserts/updates work without errors and avoid unnecessary rate-limit pressure.

Local scaffolding:
- Code lives in `apps/backend/src/fetcher/` (`runFetcher` + Yahoo Finance adapter).
- This phase currently computes RSI locally (no `yahoo-finance2.rsi()` call in this setup); the next step is to write results into Supabase.

## Tests

- Test a valid and an invalid ticker (job must not break).
- Confirm expected rows are inserted and date fields update correctly.

