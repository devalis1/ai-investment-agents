# Phase 4: Frontend PWA (Next.js)

Goal: let the user manage tickers/portfolio and view `ai_insights`.

## What exists now (implemented)

- A Next.js App Router app in `apps/frontend/`.
- A dashboard page that:
  - reads `assets` from Supabase (public select policy)
  - reads recent `ai_insights` from Supabase (public select policy)
  - joins the latest insights with assets **client-side** via `asset_id`
  - uses loading skeletons and clear error/empty states
- **Theme**: light + dark (`next-themes`), system default with manual override; tokens in `app/globals.css` + Tailwind `darkMode: 'class'`.
- **Ticker search**: debounced UI calling `GET /api/ticker-search?q=…` (server proxies Yahoo Finance search JSON) so the browser is not blocked by **CORS** and no market-data API key is required on the client. Rate limits are unofficial—do not rely on this for high-volume use without a paid provider.
- **Watchlist**: structured `WatchlistEntry[]` in `localStorage` (`ai-investment-agents:watchlist`), import/export JSON, legacy compatibility with `ai-investment-agents:ticker-input`.
- **Analyze actions**: `POST /api/trigger-cycle` with `{ "tickers": ["AAPL"] }` (uppercase, validated server-side). Full execution requires a separate HTTP worker and `CYCLE_TRIGGER_URL` + `CYCLE_TRIGGER_SECRET`; until then the API returns **501** and the UI explains the gap.
- Presentation: recommendation badges, truncated reasoning with expand, optional “watchlist only” filter on insights; responsive assets table (cards on small screens, table on `md+`).
- No auth required (public read policies assumed).

## Checklist

1. Initialize Next.js (App Router) and configure Tailwind.
2. Implement reading `assets` and `ai_insights` from Supabase.
3. Add watchlist + ticker search + theme.
4. (Next) Implement a secure backend HTTP entrypoint for the cycle so `CYCLE_TRIGGER_URL` can run analysis in production.
5. (Next) Add PWA bits (manifest, service worker) incrementally.

## How to run

From the repo root:

```bash
cd apps/frontend
npm install
npm run dev
```

Then open `http://localhost:3000`.

## Environment variables

Create `apps/frontend/.env.local` with:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` (or `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY`)

Optional server-only (Vercel / Node):

- `CYCLE_TRIGGER_URL`
- `CYCLE_TRIGGER_SECRET`

These are **not** `NEXT_PUBLIC_*`. See `apps/frontend/README.md`.
