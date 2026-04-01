# AI Investment Agents (Supabase + Next.js PWA)

This project implements an **AI agent investment application** in phases:

1. Preparation (accounts, credentials, environment variables)
2. Database (Supabase/Postgres) + `fetcher` (Yahoo Finance)
3. AI logic (LLM with *structured output* + optional local/cloud fallback)
4. Frontend PWA (Next.js)
5. End-to-end integration (DB + AI + Telegram notifications)
6. Cost optimization and migration to local inference (optional)

## How we organize “in parts”

- Phase decisions and steps live in `docs/`.
- Persistent agent rules live in `.cursor/rules/`.
- Code will be placed in:
  - `apps/backend` (Supabase Functions / Edge / API server)
  - `apps/frontend` (Next.js PWA)

The goal is to start with scaffolding and minimal validations (everything compiles and the flow works) before expanding features.

## Current status

The project is now partially implemented:

- Backend can run an end-to-end analysis cycle (fetch -> LLM -> Supabase -> Telegram).
- Supabase schema is defined and in use (`assets`, `ai_insights`).
- Frontend Next.js dashboard exists and can read `assets`/`ai_insights` from Supabase.
- Automated repo audits exist (see `docs/status/latest-audit.md`).

See `docs/status/current.md` for the authoritative “what works vs what’s pending” checklist and run commands.

