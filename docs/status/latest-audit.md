> Generated: 2026-04-05T12:24:13.600Z

## Current state

**Docs enumerated**

- docs/01-setup-cuentas-y-env.md
- docs/02-bd-esquema-y-fetcher.md
- docs/03-llm-analisis-structured-json.md
- docs/04-frontend-pwa-nextjs.md
- docs/05-integracion-e2e.md
- docs/06-costes-y-migracion-local.md
- docs/sql/phase-2-assets-ai-insights.sql
- docs/sql/phase-3-public-tickers.sql
- docs/status/README.md
- docs/status/current.md

**Key implementation files enumerated**

- README.md
- AGENTS.md
- docs/01-setup-cuentas-y-env.md
- docs/02-bd-esquema-y-fetcher.md
- docs/03-llm-analisis-structured-json.md
- docs/04-frontend-pwa-nextjs.md
- docs/05-integracion-e2e.md
- docs/06-costes-y-migracion-local.md
- docs/sql/phase-2-assets-ai-insights.sql
- docs/sql/phase-3-public-tickers.sql
- docs/status/README.md
- docs/status/current.md
- .cursor/rules/core-project-standards.mdc
- .cursor/rules/db-security-rls.mdc
- .cursor/rules/llm-contracts-structured-json.mdc
- .cursor/rules/workflow-by-phases.mdc
- apps/backend/src/jobs/cycle.ts
- apps/backend/src/llm/inferencer.ts
- apps/backend/src/fetcher/devStub.ts
- apps/backend/src/fetcher/errorSummary.ts
- apps/backend/src/fetcher/fetchDiagnostics.ts
- apps/backend/src/fetcher/headlines.ts
- apps/backend/src/fetcher/networkDefaults.ts
- apps/backend/src/fetcher/run.ts
- apps/backend/src/fetcher/sharedYahooFinance.ts
- apps/backend/src/fetcher/timeoutFetch.ts
- apps/backend/src/fetcher/types.ts
- apps/backend/src/fetcher/yahooFinance.ts
- .env.example

**Capabilities (observed from code/docs)**

- Backend TypeScript module under `apps/backend/` with runnable scripts via `tsx`.
- Daily analysis cycle available: `apps/backend` script `npm run cycle:daily` runs `src/jobs/cycle.ts`.
- Fetcher implemented: Yahoo Finance quote + RSI computed from daily closes (`apps/backend/src/fetcher/*`).
- Supabase service-role writes: upsert `assets` + insert `ai_insights` (`apps/backend/src/supabase/serviceClient.ts`).
- Local-first LLM inference (Ollama or LM Studio) with JSON validation + repair (`apps/backend/src/llm/inferencer.ts`).
- Telegram notifications supported when `TELEGRAM_BOT_TOKEN` + `TELEGRAM_CHAT_ID` set (optional).
- Optional cloud LLM fallback: Gemini when `ENABLE_CLOUD_FALLBACK=true` (`apps/backend/src/llm/inferencer.ts`).
- Headlines for LLM: 3–5 lines per ticker from Yahoo `search` news, with `[headlines]` + `[inferAnalyst]` safe logs (`apps/backend/src/fetcher/headlines.ts`).
- Frontend Next.js app exists under `apps/frontend/` (Next 16 / React 19).
- Supabase client (`apps/frontend/lib/supabase/client.ts`) + dashboard (`DashboardClient.tsx`): assets/insights, watchlist, ticker search, cycle trigger proxy, `/api/tickers` for DB canonical tickers (see `docs/status/current.md`).

## Drift / inconsistencies

- None detected by heuristic checks.

## Recommended next steps

- PWA baseline: manifest + icons per `docs/04-frontend-pwa-nextjs.md` (Linear **AED-24**), then service worker/offline shell (**AED-25**) and status/doc refresh (**AED-26**).
- Align the public Supabase env var contract across docs, `.env.example`, and `apps/frontend` (canonical publishable key name + optional alias).
- Production scheduling: document worker deploy for `cycle:trigger-server` or keep GitHub Actions `daily-cycle.yml`; optional Vercel Cron only if routing fits.
- Optional: persist headline snapshots in `ai_insights.key_headlines` when product wants DB-level news history (v1 keeps analyst JSON schema-only).

## Parallel agent prompts

### Env var contract alignment (frontend↔docs↔examples)

**Scope (allowed paths)**

- apps/frontend/**
- docs/01-setup-cuentas-y-env.md
- .env.example
- scripts/meta-agent/**

**Prompt**

```
Goal: eliminate env-var drift across frontend, docs, and `.env.example` without changing the DB schema.

Scope boundaries:
- You may edit ONLY these paths:
- `apps/frontend/**`
- `docs/01-setup-cuentas-y-env.md`
- `.env.example`
- `scripts/meta-agent/**`
- Do NOT read or modify `.env.local`.

Repo context:
- Frontend currently uses `NEXT_PUBLIC_SUPABASE_ANON_KEY` (see `apps/frontend/lib/supabase/client.ts`).
- Docs + `.env.example` emphasize `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY` as the recommended publishable key, with `NEXT_PUBLIC_SUPABASE_ANON_KEY` as an optional alias.

Deliverables:
- Pick ONE canonical public key name for the frontend and docs (or support both safely).
- Update frontend env loading to match docs/examples and give a clear error message.
- Update the audit script’s drift detection rules if needed.
- Include a tiny test plan (how to run frontend + verify it reads env vars).
```

### E2E ‘cycle’ hardening (news input + observability-lite)

**Scope (allowed paths)**

- apps/backend/src/jobs/cycle.ts
- apps/backend/src/fetcher/**
- apps/backend/src/llm/**
- apps/backend/src/telegram/**
- docs/05-integracion-e2e.md
- scripts/meta-agent/**

**Prompt**

```
Goal: improve the Phase 5 end-to-end cycle reliability and completeness while keeping the project local-first (Supabase + local LLM).

Scope boundaries:
- You may edit ONLY these paths:
- `apps/backend/src/jobs/cycle.ts`
- `apps/backend/src/fetcher/**`
- `apps/backend/src/llm/**`
- `apps/backend/src/telegram/**`
- `docs/05-integracion-e2e.md`
- `scripts/meta-agent/**`
- Do NOT change the database schema (`docs/sql/phase-2-assets-ai-insights.sql`).
- Do NOT add secrets or read `.env.local`.

Repo context:
- `runFetcher` attaches Yahoo `search` headlines (`fetcher/headlines.ts`); `analyzeCycle` passes them into `inferAnalyst`.
- `inferAnalyst` validates JSON and supports repair; optional Gemini fallback when `ENABLE_CLOUD_FALLBACK=true`.

Deliverables:
- Extend structured, non-sensitive logging per ticker: Telegram attempted/skipped, invalid tickers, and LLM timeouts (headlines + `[inferAnalyst]` logs already exist).
- Update `docs/05-integracion-e2e.md` to reflect what is now automated vs manual.
- Include a smoke-test plan (one ticker, invalid ticker, LLM timeout).
```

### PWA baseline: Web App Manifest + icons (Linear AED-24)

**Scope (allowed paths)**

- apps/frontend/**
- docs/04-frontend-pwa-nextjs.md
- docs/status/current.md
- scripts/meta-agent/**

**Prompt**

```
Goal: ship **AED-24** — valid Web App Manifest + icon set so the dashboard is installable as a PWA (no service worker in this task; that is AED-25).

Scope boundaries:
- You may edit ONLY these paths:
- `apps/frontend/**` (prefer `app/manifest.ts` or `public/manifest.webmanifest` + assets under `public/`)
- `docs/04-frontend-pwa-nextjs.md`
- `docs/status/current.md`
- `scripts/meta-agent/**` if audit drift text needs a one-line tweak
- Do NOT register a service worker here.
- Do NOT break existing App Router API routes (`/api/trigger-cycle`, `/api/ticker-search`, `/api/tickers`).
- Do NOT add secrets or read `.env.local`.

Repo context:
- Next.js App Router; dashboard is client-heavy (`DashboardClient.tsx`). See `docs/status/current.md` for capabilities.
- Epic parent: **AED-9** (PWA baseline); follow-up: AED-25 (SW), AED-26 (docs).

Deliverables:
- Installable PWA check passes in Chrome devtools (manifest valid, icons resolve).
- Document local verification steps and known limitations in `docs/04-frontend-pwa-nextjs.md`; mark **AED-24** Done in Linear when merged.
- Short test plan: `npm run build` + manual install prompt smoke test.
```
