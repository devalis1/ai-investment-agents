# Phase 4: Frontend PWA (Next.js)

Goal: let the user manage tickers/portfolio and view `ai_insights`.

## What exists now (implemented)

- A Next.js App Router app in `apps/frontend/`.
- A dashboard page that:
  - reads `assets` from Supabase (public select policy)
  - reads recent `ai_insights` from Supabase (public select policy)
  - joins the latest insights with assets **client-side** via `asset_id`
  - shows basic loading/error/empty states (no silent failures)
- A comma-separated tickers input (UI-only) that is saved to `localStorage` so it persists across reloads.
- No auth required (public read policies assumed).

## Checklist

1. Initialize Next.js (App Router) and configure Tailwind.
2. Implement reading `assets` and `ai_insights` from Supabase.
3. Add ticker input persistence (localStorage).
4. (Next) Implement an action to add/update tickers (backend-triggered).
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

These are client-side keys (public). The frontend only performs `select` queries against `assets` and `ai_insights`.

