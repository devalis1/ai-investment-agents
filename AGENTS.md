# Agent Orchestration (AI Investment Agents)

This repository is built in phases, following the plan from the “Executive Summary” document you shared.

## Suggested workflow

1. Read the corresponding phase in `docs/`.
2. Implement the minimum needed to pass the validation for that phase.
3. Update `docs/` with “what we did” and “what’s pending”.
4. Repeat until end-to-end integration is complete.

## Agent inventory (when applicable)

- **DB Architect (SQL)**: create/adjust the Postgres schema, FKs, and RLS policies.
- **Backend Developer (Node/Edge)**: implement `fetcher`, AI orchestration, and Telegram integration.
- **Frontend Developer (Next.js)**: dashboard PWA, forms, and Supabase read/write.
- **Financial Analyst**: generate `recommendation` and `reasoning` from structured (JSON) inputs.

## Definition of Done (per phase)

- Works locally (or at least compiles and runs the part it owns).
- Covers common cases and expected failures (e.g. invalid ticker, upstream rate limit).
- No secrets leak (never include keys in prompts/code).

