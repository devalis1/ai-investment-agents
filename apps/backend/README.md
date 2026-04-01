# Backend (Supabase / Edge / Node)

## Local LLM Configuration (Ollama / LM Studio)

This module will host:

- Supabase schema (tables, RLS policies, triggers if needed)
- Serverless functions (e.g. daily `fetcher` for Yahoo Finance)
- AI agent orchestration (model calls with *structured output*)
- Telegram notifications

## Local LLM configuration (Ollama / LM Studio)

1. Create a `.env.local` file in the **project root** (`ai-investment-agents/`), using `.env.example` as the base.
2. Set `LLM_LOCAL_PROVIDER` to:
   - `ollama` or
   - `lmstudio`
3. For `ollama`:
   - `OLLAMA_BASE_URL` (default `http://localhost:11434`)
   - `OLLAMA_MODEL` (default `qwen3.5:latest`)
4. For `lmstudio`:
   - `LMSTUDIO_BASE_URL` (default `http://localhost:1234/v1`)
   - `LMSTUDIO_MODEL` (TODO: set the exact model id installed in LM Studio)

The backend tries local inference first; the cloud fallback is prepared but **disabled by default**.

Next step: initialize the Supabase stack (project/CLI) and define the `assets`/`ai_insights` data contract.

