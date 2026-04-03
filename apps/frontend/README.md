# Frontend (Next.js)

Next.js 16 App Router dashboard: read `assets` and `ai_insights` from Supabase, ticker search, local watchlist, and optional remote cycle trigger.

## Run locally

```bash
cd apps/frontend
npm install
npm run dev
```

Open `http://localhost:3000`.

```bash
npm run build
```

## Environment variables

Create `apps/frontend/.env.local`.

### Public (browser / `NEXT_PUBLIC_*`)

Required for the dashboard:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY` (recommended) or `NEXT_PUBLIC_SUPABASE_ANON_KEY`

These are used only for `select` on `assets` and `ai_insights` (anon / publishable key).

### Server-only (never prefix with `NEXT_PUBLIC_`)

Optional — remote analysis trigger from the Next.js Route Handler:

- `CYCLE_TRIGGER_URL` — URL of a **future** HTTP worker that runs the backend cycle with service credentials (not included in this repo today).
- `CYCLE_TRIGGER_SECRET` — shared secret; the frontend server sends `Authorization: Bearer <secret>` when POSTing `{ "tickers": ["AAPL"] }`.

If these are unset, **Analyze** actions return HTTP `501` with a clear JSON message; the UI explains that local/GitHub/backend HTTP integration is required.

Ticker search uses Yahoo Finance’s public search JSON endpoint from `GET /api/ticker-search` (no API key). Treat it as **best-effort**: no SLA, unofficial surface, and your deployment IP may be throttled if traffic is high. Keeping search on the server avoids **CORS** blocks and keeps any future paid provider keys off the client.

## Features

- Light/dark theme (system default + toggle), persisted as `ai-investment-agents:theme`.
- Watchlist persisted as JSON in `localStorage` (`ai-investment-agents:watchlist`), with legacy sync to `ai-investment-agents:ticker-input` (comma list) for backward compatibility.
- `app/api/ticker-search/route.ts` — server-side symbol/name search.
- `app/api/trigger-cycle/route.ts` — validates tickers (uppercase, max 24 per request) and optionally forwards to `CYCLE_TRIGGER_URL`.

## Vercel

Set the same variables in the project settings. Do **not** expose Supabase service role keys or LLM keys to the browser; run heavy analysis in Actions, a private worker, or local `apps/backend`.
