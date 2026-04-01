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

Initial scaffold created (documentation + Cursor rules). Next step: initialize the base project (Supabase backend and Next.js frontend) and define the data contract for `assets`/`ai_insights`.

