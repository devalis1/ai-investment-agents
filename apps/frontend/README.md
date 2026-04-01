# Frontend (Next.js PWA)

This module hosts the PWA dashboard:

- Read-only dashboard (current state):
  - assets list (`assets`)
  - latest insights (`ai_insights`)
  - client-side join via `asset_id`
  - ticker input persisted to `localStorage` (UI-only)

## How to run

```bash
cd apps/frontend
npm install
npm run dev
```

Open `http://localhost:3000`.

## Environment variables

Create `apps/frontend/.env.local` with:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY` (recommended) or `NEXT_PUBLIC_SUPABASE_ANON_KEY`

## Next steps

- Add a UI action to manage tickers as a source of truth (DB-backed).
- Add PWA features (manifest/service worker/offline) incrementally.

