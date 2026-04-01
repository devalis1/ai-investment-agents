# Status audits (meta-agent)

This folder contains automated “repo audits” that:

- Enumerate the Phase 1–6 docs in `docs/`
- Enumerate key code entrypoints (backend cycle, fetcher, LLM inferencer, Telegram hooks, frontend if present)
- Detect obvious drift between docs and implementation (especially env vars and TODO hotspots)
- Output a short status report with recommended next steps and parallel agent prompts

## Run locally

From the repo root:

```bash
npm install
npm run audit
```

This writes:

- `docs/status/latest-audit.md` (the latest report)

## Scheduling (macOS cron example)

If you want a daily audit on your machine (no new infra), add a crontab entry.

1) Edit your crontab:

```bash
crontab -e
```

2) Add an entry (runs daily at 07:10):

```cron
10 7 * * * cd /ABS/PATH/ai-investment-agents && /usr/bin/env npm run -s audit > docs/status/latest-audit.md 2>&1
```

Notes:

- This audit must never read `.env.local` (by design). It only reads docs, `.env.example`, and code to detect drift.
- If you don’t want to overwrite the report, redirect to a timestamped file instead.

