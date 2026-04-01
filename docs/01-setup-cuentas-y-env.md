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
   - If cloud: create an API key (e.g. OpenAI/Gemini) and save `OPENAI_API_KEY` (or the equivalent variable).
   - If local: install Ollama/LM Studio and define the local endpoint to use.
5. Create a `.env.local` file (in the root or per backend/frontend) with:

```bash
NEXT_PUBLIC_SUPABASE_URL=your_url
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY=your_sb_publishable_key
# Optional alias for older snippets:
# NEXT_PUBLIC_SUPABASE_ANON_KEY=your_sb_publishable_key
OPENAI_API_KEY=your_openai_key
SUPABASE_URL=your_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
TELEGRAM_BOT_TOKEN=your_telegram_token
TELEGRAM_CHAT_ID=your_chat_id
LLM_DEBUG=false
```

## Risks and mitigations

- Risk: key exposure in commits. Mitigation: use `.gitignore` and examples with no real values.
- Risk: wrong endpoints/keys. Mitigation: early connection test (read a table or insert a test record).

## How to test (minimum)

- Run a backend “ping” command/function (or a simple Supabase query) to validate credentials.

