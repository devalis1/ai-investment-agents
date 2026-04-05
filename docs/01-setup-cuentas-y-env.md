# Phase 1: Accounts setup and environment variables

Goal: make the project ready so the backend and frontend can communicate with external services.

## Steps

1. **Supabase**
   - Create a project and a database.
   - Copy `NEXT_PUBLIC_SUPABASE_URL` and a client-safe key:
     - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY` (recommended, `sb_publishable_...`)
     - (optional alias) `NEXT_PUBLIC_SUPABASE_ANON_KEY`
2. **Vercel**
   - Connect your repo (GitHub or import).
   - Associate the Vercel environment variables with the project.
3. **Telegram**
   - Create a bot with `@BotFather` and save `TELEGRAM_BOT_TOKEN`.
   - Get `TELEGRAM_CHAT_ID` via Bot API `getUpdates` (recommended) or `@userinfobot`.
4. **LLM provider (cloud or local)**
   - **Local (default):** Ollama or LM Studio — set `LLM_LOCAL_PROVIDER`, endpoints, and model names (see root `.env.example`).
   - **Cloud fallback:** this repo’s backend uses **Google Gemini** when `ENABLE_CLOUD_FALLBACK=true` (e.g. GitHub Actions). Set `GEMINI_API_KEY` and optionally `GEMINI_MODEL`.
5. Create a `.env.local` file at the **repo root** (backend loads it from there; frontend may use `apps/frontend/.env.local` for the same keys). Start from `.env.example`:

```bash
NEXT_PUBLIC_SUPABASE_URL=your_url
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY=your_sb_publishable_key
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_URL=your_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

LLM_DEBUG=false
LLM_LOCAL_PROVIDER=ollama
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=qwen3.5:latest

ENABLE_CLOUD_FALLBACK=false
GEMINI_API_KEY=
GEMINI_MODEL=gemini-1.5-flash

TICKERS=AAPL,MSFT,NVDA

TELEGRAM_BOT_TOKEN=your_telegram_token
TELEGRAM_CHAT_ID=your_chat_id
```

For **on-demand analyze** from the dashboard, set server-side `CYCLE_TRIGGER_URL` and `CYCLE_TRIGGER_SECRET` on the frontend host, and run the backend HTTP worker with the same secret (`docs/status/current.md`).

## Risks and mitigations

- Risk: key exposure in commits. Mitigation: use `.gitignore` and examples with no real values.
- Risk: wrong endpoints/keys. Mitigation: early connection test (read a table or insert a test record).

## How to test (minimum)

- Run a backend “ping” command/function (or a simple Supabase query) to validate credentials.

