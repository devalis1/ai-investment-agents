# Phase 2: Database (Supabase/Postgres) + `fetcher` (Yahoo Finance)

Goal: create the tables and a process that feeds data from Yahoo Finance into Postgres.

## Minimum schema (tables)

Suggested tables:

- `assets`: one row per ticker (and metadata: market, quantity, average price, etc.)
- `ai_insights`: recommendations per asset and date (`recommendation`, `reasoning`, news, current price)
- `tickers` (`public.tickers`): optional canonical list of symbols for the scheduled/backend cycle (see below)

### SQL apply order

Run scripts in this order in the Supabase SQL Editor (or your migration runner):

1. `docs/sql/phase-2-assets-ai-insights.sql` — creates `assets`, `ai_insights`, and baseline RLS (public `SELECT` for the prototype).
2. `docs/sql/phase-3-public-tickers.sql` — creates `tickers`, enables RLS, and adds the same style of public read policy.

**Single-user prototype:** anon users may read these tables so the dashboard works without auth. Writes to `tickers` use the **service role** on the Next.js server (`/api/tickers` + `TICKERS_ADMIN_SECRET`) or the backend job / SQL editor / Table Editor. There are no anon `INSERT`/`UPDATE` policies on `tickers`.

### Which tickers does the cycle use?

Backend entrypoint `apps/backend/src/jobs/cycle.ts` (e.g. `npm run cycle:daily`) resolves symbols with `resolveCycleTickers`:

- If `public.tickers` has **at least one** row with `enabled = true`, the cycle uses those symbols (normalized with the same rules as `apps/backend/src/ticker-symbols.ts`).
- If the table is empty, all enabled rows normalize to nothing, or the query fails (e.g. migration not applied), the cycle falls back to the **`TICKERS`** environment variable (comma-separated; default `AAPL,MSFT,NVDA` when unset).

The HTTP trigger worker (`cycle-trigger-server`) still runs only the tickers supplied in the JSON body; it does not read `public.tickers` by itself.

## Implementation checklist

1. Create tables in Supabase (SQL editor or migrations).
   - Use `docs/sql/phase-2-assets-ai-insights.sql`, then `docs/sql/phase-3-public-tickers.sql`.
2. Ensure `RLS` and minimal permissions (even for a single-user app).
3. Create the `fetcher` function/endpoint (Edge Function or similar).
4. Schedule daily execution (Cron/webhook).
   - Recommended simplest path (no new infra): cron runs the backend cycle script.
   - Command (from `apps/backend/`): `npm run cycle:daily`
   - It resolves tickers from `public.tickers` when enabled rows exist; otherwise it reads `TICKERS="AAPL,MSFT,NVDA"` from env. Then it writes into `assets` + `ai_insights`.
   - Repo-native alternative: GitHub Actions scheduled workflow (see `docs/05-integracion-e2e.md`).
5. Verify inserts/updates work without errors and avoid unnecessary rate-limit pressure.

Local scaffolding:
- Code lives in `apps/backend/src/fetcher/` (`runFetcher` + Yahoo Finance adapter).
- **Headlines (v1):** `fetchHeadlinesForTicker` in `headlines.ts` pulls **3–5** headline-style lines per ticker via `yahoo-finance2` **`search`** (news bundle). Results are attached on each `runFetcher` row as `headlines: string[]`. If Yahoo news fails after retries, `headlines` is empty and the cycle continues.
- RSI is still computed locally from daily closes (unchanged math); the next step is to write results into Supabase.

## Tests

- Test a valid and an invalid ticker (job must not break).
- Confirm expected rows are inserted and date fields update correctly.

