> Generated: 2026-03-31T10:53:35.492Z

## Current state

**Docs enumerated**

- docs/01-setup-cuentas-y-env.md
- docs/02-bd-esquema-y-fetcher.md
- docs/03-llm-analisis-structured-json.md
- docs/04-frontend-pwa-nextjs.md
- docs/05-integracion-e2e.md
- docs/06-costes-y-migracion-local.md
- docs/sql/phase-2-assets-ai-insights.sql
- docs/status/README.md

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
- docs/status/README.md
- .cursor/rules/core-project-standards.mdc
- .cursor/rules/db-security-rls.mdc
- .cursor/rules/llm-contracts-structured-json.mdc
- .cursor/rules/workflow-by-phases.mdc
- apps/backend/src/jobs/cycle.ts
- apps/backend/src/llm/inferencer.ts
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
- Cloud fallback is gated by `ENABLE_CLOUD_FALLBACK=true` but not implemented yet (TODO).
- Headlines/news input to LLM is currently empty (`headlines: []`) in the cycle (TODO).
- Frontend Next.js app exists under `apps/frontend/` (Next 16 / React 19).
- Frontend has a Supabase client helper under `apps/frontend/lib/supabase/client.ts` but dashboard pages are not implemented yet.

## Drift / inconsistencies

- **MEDIUM**: Docs mention env vars not present in `.env.example`
  - Examples missing: LLM, LLM_DEBUG, NEXT_PUBLIC_SUPABASE_ANON_KEY
- **LOW**: `.env.example` contains env vars not mentioned in docs
  - Docs may need update: LLM_LOCAL_PROVIDER
- **HIGH**: Frontend expects `NEXT_PUBLIC_SUPABASE_ANON_KEY` but `.env.example` does not define it
  - See `apps/frontend/lib/supabase/client.ts`. Docs suggest `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY` as canonical and `NEXT_PUBLIC_SUPABASE_ANON_KEY` as an optional alias (commented). Align the frontend env contract.
- **MEDIUM**: README current status appears outdated
  - README states only 'initial scaffold', but backend has runnable cycle scripts (`apps/backend/package.json` includes `cycle:daily`) and frontend exists under `apps/frontend/`.

## Recommended next steps

- Align the public Supabase env var contract across docs, `.env.example`, and `apps/frontend` (choose canonical key name and support alias if needed).
- Implement minimal headlines/news sourcing so `inferAnalyst` reasoning uses real context (keep recommendation deterministic per RSI policy).
- Add a minimal frontend dashboard page: list `assets` and show latest `ai_insights` per asset with loading/error states.
- Decide on one scheduling approach for production (local cron is already documented; consider Vercel Cron only if/when a deployable API endpoint exists).
- Optionally implement cloud fallback behind `ENABLE_CLOUD_FALLBACK=true` with structured JSON validation and non-sensitive logs.

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
- `analyzeCycle()` currently passes `headlines: []` into `inferAnalyst` (TODO in `apps/backend/src/jobs/cycle.ts`).
- `inferAnalyst` validates JSON and supports repair, with optional cloud fallback marked TODO.

Deliverables:
- Add a minimal ‘headlines/news’ provider (even if it’s stubbed or uses existing Yahoo endpoints) so reasoning is not always empty-context.
- Add structured, non-sensitive logging per ticker: latency, provider (ollama/lmstudio), retry count, and whether Telegram was attempted.
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
