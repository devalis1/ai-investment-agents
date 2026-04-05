> Generated: 2026-04-05T10:22:46.825Z

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
- apps/backend/src/fetcher/headlines.ts
- apps/backend/src/fetcher/run.ts
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
- Frontend has a Supabase client helper under `apps/frontend/lib/supabase/client.ts` but dashboard pages are not implemented yet.

## Drift / inconsistencies

- None detected by heuristic checks.

## Recommended next steps

- Align the public Supabase env var contract across docs, `.env.example`, and `apps/frontend` (choose canonical key name and support alias if needed).
- Add a minimal frontend dashboard page: list `assets` and show latest `ai_insights` per asset with loading/error states (if not already complete vs `docs/status/current.md`).
- Decide on one scheduling approach for production (local cron is already documented; consider Vercel Cron only if/when a deployable API endpoint exists).
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

### Frontend dashboard skeleton (assets + ai_insights read)

**Scope (allowed paths)**

- apps/frontend/**
- docs/04-frontend-pwa-nextjs.md
- docs/05-integracion-e2e.md
- scripts/meta-agent/**

**Prompt**

```
Goal: implement the Phase 4 minimum UI: list `assets` and latest `ai_insights` from Supabase with good loading/error states.

Scope boundaries:
- You may edit ONLY these paths:
- `apps/frontend/**`
- `docs/04-frontend-pwa-nextjs.md`
- `docs/05-integracion-e2e.md`
- `scripts/meta-agent/**`
- Do NOT change DB schema.
- Do NOT add secrets or read `.env.local`.

Repo context:
- Supabase schema is defined in `docs/sql/phase-2-assets-ai-insights.sql`.
- RLS currently allows public SELECT on `assets` and `ai_insights` (prototype).

Deliverables:
- A simple page that shows assets and their newest insight (recommendation/reasoning/current_price).
- Loading + error + empty states.
- A short ‘How to run’ section in `docs/04-frontend-pwa-nextjs.md` that matches reality.
```
