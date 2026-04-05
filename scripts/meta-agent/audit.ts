import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

type DriftItem = {
  severity: "high" | "medium" | "low";
  title: string;
  details: string;
};

type AgentPrompt = {
  title: string;
  scope: string[];
  prompt: string;
};

function repoRootFromHere(): string {
  // scripts/meta-agent/audit.ts -> repo root
  const here = path.dirname(fileURLToPath(import.meta.url));
  return path.resolve(here, "..", "..");
}

function posix(p: string): string {
  return p.split(path.sep).join("/");
}

function safeReadText(filePath: string): string | null {
  try {
    return fs.readFileSync(filePath, "utf8");
  } catch {
    return null;
  }
}

function listFilesRecursively(
  dir: string,
  opts?: { ignoreDirNames?: Set<string>; onlyExtensions?: Set<string> }
): string[] {
  const ignore = opts?.ignoreDirNames ?? new Set<string>();
  const onlyExt = opts?.onlyExtensions;

  const out: string[] = [];
  const stack: string[] = [dir];
  while (stack.length > 0) {
    const current = stack.pop()!;
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(current, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const ent of entries) {
      const full = path.join(current, ent.name);
      if (ent.isDirectory()) {
        if (ignore.has(ent.name)) continue;
        stack.push(full);
      } else if (ent.isFile()) {
        if (onlyExt) {
          const ext = path.extname(ent.name);
          if (!onlyExt.has(ext)) continue;
        }
        out.push(full);
      }
    }
  }
  out.sort();
  return out;
}

function parseEnvExampleVars(envExampleText: string): Set<string> {
  const vars = new Set<string>();
  for (const rawLine of envExampleText.split("\n")) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq <= 0) continue;
    const key = line.slice(0, eq).trim();
    if (/^[A-Z0-9_]+$/.test(key)) vars.add(key);
  }
  return vars;
}

function extractEnvVarMentions(text: string): Set<string> {
  // Heuristic: capture ENV_VAR style identifiers.
  // This intentionally ignores values and avoids `.env.local`.
  const matches = text.match(/\b[A-Z][A-Z0-9_]{2,}\b/g) ?? [];
  const out = new Set<string>();
  for (const m of matches) {
    // Filter out very generic constants that show up a lot in markdown (SQL keywords etc.)
    if (m === "UUID" || m === "JSON" || m === "RLS") continue;
    out.add(m);
  }
  return out;
}

function uniq<T>(items: T[]): T[] {
  return Array.from(new Set(items));
}

function fmtList(items: string[], max = 12): string {
  const slice = items.slice(0, max);
  const more = items.length > max ? `\n- …and ${items.length - max} more` : "";
  return slice.map((s) => `- ${s}`).join("\n") + more;
}

function detectTodoHotspots(files: string[], repoRoot: string): string[] {
  const hotspots: Array<{ file: string; count: number }> = [];
  for (const f of files) {
    const txt = safeReadText(f);
    if (!txt) continue;
    const count = (txt.match(/\bTODO:\b/g) ?? []).length;
    if (count > 0) {
      hotspots.push({ file: posix(path.relative(repoRoot, f)), count });
    }
  }
  hotspots.sort((a, b) => b.count - a.count || a.file.localeCompare(b.file));
  return hotspots.slice(0, 10).map((h) => `${h.file} (${h.count})`);
}

function exists(filePath: string): boolean {
  try {
    fs.accessSync(filePath);
    return true;
  } catch {
    return false;
  }
}

function buildPrompts(context: {
  repoRoot: string;
  drift: DriftItem[];
  hasFrontend: boolean;
  hasBackend: boolean;
}): AgentPrompt[] {
  const prompts: AgentPrompt[] = [];

  prompts.push({
    title: "Env var contract alignment (frontend↔docs↔examples)",
    scope: [
      "apps/frontend/**",
      "docs/01-setup-cuentas-y-env.md",
      ".env.example",
      "scripts/meta-agent/**",
    ],
    prompt: [
      "Goal: eliminate env-var drift across frontend, docs, and `.env.example` without changing the DB schema.",
      "",
      "Scope boundaries:",
      "- You may edit ONLY these paths:",
      "- `apps/frontend/**`",
      "- `docs/01-setup-cuentas-y-env.md`",
      "- `.env.example`",
      "- `scripts/meta-agent/**`",
      "- Do NOT read or modify `.env.local`.",
      "",
      "Repo context:",
      "- Frontend currently uses `NEXT_PUBLIC_SUPABASE_ANON_KEY` (see `apps/frontend/lib/supabase/client.ts`).",
      "- Docs + `.env.example` emphasize `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY` as the recommended publishable key, with `NEXT_PUBLIC_SUPABASE_ANON_KEY` as an optional alias.",
      "",
      "Deliverables:",
      "- Pick ONE canonical public key name for the frontend and docs (or support both safely).",
      "- Update frontend env loading to match docs/examples and give a clear error message.",
      "- Update the audit script’s drift detection rules if needed.",
      "- Include a tiny test plan (how to run frontend + verify it reads env vars).",
    ].join("\n"),
  });

  prompts.push({
    title: "E2E ‘cycle’ hardening (news input + observability-lite)",
    scope: [
      "apps/backend/src/jobs/cycle.ts",
      "apps/backend/src/fetcher/**",
      "apps/backend/src/llm/**",
      "apps/backend/src/telegram/**",
      "docs/05-integracion-e2e.md",
      "scripts/meta-agent/**",
    ],
    prompt: [
      "Goal: improve the Phase 5 end-to-end cycle reliability and completeness while keeping the project local-first (Supabase + local LLM).",
      "",
      "Scope boundaries:",
      "- You may edit ONLY these paths:",
      "- `apps/backend/src/jobs/cycle.ts`",
      "- `apps/backend/src/fetcher/**`",
      "- `apps/backend/src/llm/**`",
      "- `apps/backend/src/telegram/**`",
      "- `docs/05-integracion-e2e.md`",
      "- `scripts/meta-agent/**`",
      "- Do NOT change the database schema (`docs/sql/phase-2-assets-ai-insights.sql`).",
      "- Do NOT add secrets or read `.env.local`.",
      "",
      "Repo context:",
      "- `runFetcher` attaches Yahoo `search` headlines (`fetcher/headlines.ts`); `analyzeCycle` passes them into `inferAnalyst`.",
      "- `inferAnalyst` validates JSON and supports repair; optional Gemini fallback when `ENABLE_CLOUD_FALLBACK=true`.",
      "",
      "Deliverables:",
      "- Extend structured, non-sensitive logging per ticker: Telegram attempted/skipped, invalid tickers, and LLM timeouts (headlines + `[inferAnalyst]` logs already exist).",
      "- Update `docs/05-integracion-e2e.md` to reflect what is now automated vs manual.",
      "- Include a smoke-test plan (one ticker, invalid ticker, LLM timeout).",
    ].join("\n"),
  });

  if (context.hasFrontend) {
    prompts.push({
      title: "Frontend dashboard skeleton (assets + ai_insights read)",
      scope: [
        "apps/frontend/**",
        "docs/04-frontend-pwa-nextjs.md",
        "docs/05-integracion-e2e.md",
        "scripts/meta-agent/**",
      ],
      prompt: [
        "Goal: implement the Phase 4 minimum UI: list `assets` and latest `ai_insights` from Supabase with good loading/error states.",
        "",
        "Scope boundaries:",
        "- You may edit ONLY these paths:",
        "- `apps/frontend/**`",
        "- `docs/04-frontend-pwa-nextjs.md`",
        "- `docs/05-integracion-e2e.md`",
        "- `scripts/meta-agent/**`",
        "- Do NOT change DB schema.",
        "- Do NOT add secrets or read `.env.local`.",
        "",
        "Repo context:",
        "- Supabase schema is defined in `docs/sql/phase-2-assets-ai-insights.sql`.",
        "- RLS currently allows public SELECT on `assets` and `ai_insights` (prototype).",
        "",
        "Deliverables:",
        "- A simple page that shows assets and their newest insight (recommendation/reasoning/current_price).",
        "- Loading + error + empty states.",
        "- A short ‘How to run’ section in `docs/04-frontend-pwa-nextjs.md` that matches reality.",
      ].join("\n"),
    });
  }

  return prompts.slice(0, 4);
}

function generateReport(params: {
  repoRoot: string;
  docsFiles: string[];
  keyFiles: string[];
  drift: DriftItem[];
  capabilities: string[];
  nextSteps: string[];
  prompts: AgentPrompt[];
}): string {
  const relDocs = params.docsFiles.map((f) => posix(path.relative(params.repoRoot, f)));
  const relKey = params.keyFiles.map((f) => posix(path.relative(params.repoRoot, f)));

  const lines: string[] = [];
  lines.push(`> Generated: ${new Date().toISOString()}`);
  lines.push("");

  lines.push("## Current state");
  lines.push("");
  lines.push("**Docs enumerated**");
  lines.push("");
  lines.push(fmtList(relDocs, 50));
  lines.push("");
  lines.push("**Key implementation files enumerated**");
  lines.push("");
  lines.push(fmtList(relKey, 50));
  lines.push("");
  lines.push("**Capabilities (observed from code/docs)**");
  lines.push("");
  lines.push(fmtList(params.capabilities, 50));
  lines.push("");

  lines.push("## Drift / inconsistencies");
  lines.push("");
  if (params.drift.length === 0) {
    lines.push("- None detected by heuristic checks.");
  } else {
    for (const d of params.drift) {
      lines.push(`- **${d.severity.toUpperCase()}**: ${d.title}`);
      lines.push(`  - ${d.details}`);
    }
  }
  lines.push("");

  lines.push("## Recommended next steps");
  lines.push("");
  lines.push(fmtList(params.nextSteps, 50));
  lines.push("");

  lines.push("## Parallel agent prompts");
  lines.push("");
  for (const p of params.prompts) {
    lines.push(`### ${p.title}`);
    lines.push("");
    lines.push("**Scope (allowed paths)**");
    lines.push("");
    lines.push(fmtList(p.scope, 50));
    lines.push("");
    lines.push("**Prompt**");
    lines.push("");
    lines.push("```");
    lines.push(p.prompt);
    lines.push("```");
    lines.push("");
  }

  return lines.join("\n");
}

function main(): void {
  const repoRoot = repoRootFromHere();

  const requiredPaths = [
    "README.md",
    "AGENTS.md",
    "docs",
    ".cursor/rules",
    "apps/backend/src/jobs/cycle.ts",
    "apps/backend/src/llm/inferencer.ts",
    "apps/backend/src/fetcher",
    "docs/sql/phase-2-assets-ai-insights.sql",
    ".env.example",
  ];

  const missingRequired = requiredPaths
    .map((p) => ({ p, abs: path.join(repoRoot, p) }))
    .filter((x) => !exists(x.abs))
    .map((x) => x.p);

  const ignoreDirs = new Set<string>([
    "node_modules",
    ".git",
    ".next",
    "dist",
    "build",
    ".turbo",
  ]);

  const docsDir = path.join(repoRoot, "docs");
  const docsFiles = listFilesRecursively(docsDir, {
    ignoreDirNames: ignoreDirs,
    onlyExtensions: new Set([".md", ".sql"]),
  }).filter((p) => !p.endsWith("docs/status/latest-audit.md"));

  const rulesDir = path.join(repoRoot, ".cursor", "rules");
  const rulesFiles = listFilesRecursively(rulesDir, {
    ignoreDirNames: ignoreDirs,
    onlyExtensions: new Set([".mdc"]),
  });

  const keyFiles: string[] = uniq([
    path.join(repoRoot, "README.md"),
    path.join(repoRoot, "AGENTS.md"),
    ...docsFiles,
    ...rulesFiles,
    path.join(repoRoot, "apps/backend/src/jobs/cycle.ts"),
    path.join(repoRoot, "apps/backend/src/llm/inferencer.ts"),
    ...listFilesRecursively(path.join(repoRoot, "apps/backend/src/fetcher"), {
      ignoreDirNames: ignoreDirs,
      onlyExtensions: new Set([".ts"]),
    }),
    path.join(repoRoot, "docs/sql/phase-2-assets-ai-insights.sql"),
    path.join(repoRoot, ".env.example"),
  ]);

  const hasBackend = exists(path.join(repoRoot, "apps/backend/package.json"));
  const hasFrontend = exists(path.join(repoRoot, "apps/frontend/package.json"));

  const drift: DriftItem[] = [];

  if (missingRequired.length > 0) {
    drift.push({
      severity: "high",
      title: "Missing required files/paths for audit",
      details: `Missing: ${missingRequired.join(", ")}`,
    });
  }

  // Env var drift checks: docs mention vs `.env.example`
  const envExampleText = safeReadText(path.join(repoRoot, ".env.example")) ?? "";
  const envExampleVars = parseEnvExampleVars(envExampleText);

  const docsText = docsFiles
    .filter((p) => p.endsWith(".md"))
    .map((p) => safeReadText(p) ?? "")
    .join("\n\n");
  const docsVarMentions = extractEnvVarMentions(docsText);

  const mentionedNotInExample = Array.from(docsVarMentions).filter(
    (v) =>
      !envExampleVars.has(v) &&
      v.includes("_") &&
      !v.endsWith("_") &&
      (v.includes("SUPABASE") ||
        v.includes("TELEGRAM") ||
        v.includes("LLM") ||
        v.includes("OPENAI"))
  );
  const exampleNotMentioned = Array.from(envExampleVars).filter(
    (v) => (v.includes("SUPABASE") || v.includes("TELEGRAM") || v.includes("LLM") || v.includes("OPENAI")) && !docsVarMentions.has(v)
  );

  if (mentionedNotInExample.length > 0) {
    drift.push({
      severity: "medium",
      title: "Docs mention env vars not present in `.env.example`",
      details: `Examples missing: ${mentionedNotInExample.sort().slice(0, 20).join(", ")}`,
    });
  }

  if (exampleNotMentioned.length > 0) {
    drift.push({
      severity: "low",
      title: "`.env.example` contains env vars not mentioned in docs",
      details: `Docs may need update: ${exampleNotMentioned.sort().slice(0, 20).join(", ")}`,
    });
  }

  // Frontend env key drift (observed)
  const frontendSupabaseClient = safeReadText(
    path.join(repoRoot, "apps/frontend/lib/supabase/client.ts")
  );
  if (frontendSupabaseClient?.includes("NEXT_PUBLIC_SUPABASE_ANON_KEY")) {
    if (!envExampleVars.has("NEXT_PUBLIC_SUPABASE_ANON_KEY")) {
      drift.push({
        severity: "high",
        title: "Frontend expects `NEXT_PUBLIC_SUPABASE_ANON_KEY` but `.env.example` does not define it",
        details:
          "See `apps/frontend/lib/supabase/client.ts`. Docs suggest `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY` as canonical and `NEXT_PUBLIC_SUPABASE_ANON_KEY` as an optional alias (commented). Align the frontend env contract.",
      });
    } else {
      const envExampleHasAnonKeyLine = /\bNEXT_PUBLIC_SUPABASE_ANON_KEY=/.test(envExampleText);
      if (!envExampleHasAnonKeyLine) {
        drift.push({
          severity: "medium",
          title: "Frontend uses `NEXT_PUBLIC_SUPABASE_ANON_KEY` but `.env.example` only mentions it as a commented alias",
          details:
            "Either switch frontend to `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY` or support both keys explicitly.",
        });
      }
    }
  }

  // README "current status" drift: if backend cycle exists but README says scaffold only.
  const readme = safeReadText(path.join(repoRoot, "README.md")) ?? "";
  if (readme.includes("Initial scaffold created") && hasBackend) {
    drift.push({
      severity: "medium",
      title: "README current status appears outdated",
      details:
        "README states only 'initial scaffold', but backend has runnable cycle scripts (`apps/backend/package.json` includes `cycle:daily`) and frontend exists under `apps/frontend/`.",
    });
  }

  // TODO hotspots (ignore node_modules)
  const codeFiles = listFilesRecursively(repoRoot, {
    ignoreDirNames: ignoreDirs,
    onlyExtensions: new Set([".ts", ".tsx", ".md"]),
  }).filter((p) => !p.endsWith(".d.ts"));
  const todoHotspots = detectTodoHotspots(codeFiles, repoRoot);
  if (todoHotspots.length > 0) {
    drift.push({
      severity: "low",
      title: "TODO hotspots (top files)",
      details: todoHotspots.join(", "),
    });
  }

  const capabilities: string[] = [];
  if (hasBackend) {
    capabilities.push("Backend TypeScript module under `apps/backend/` with runnable scripts via `tsx`.");
    capabilities.push("Daily analysis cycle available: `apps/backend` script `npm run cycle:daily` runs `src/jobs/cycle.ts`.");
    capabilities.push("Fetcher implemented: Yahoo Finance quote + RSI computed from daily closes (`apps/backend/src/fetcher/*`).");
    capabilities.push("Supabase service-role writes: upsert `assets` + insert `ai_insights` (`apps/backend/src/supabase/serviceClient.ts`).");
    capabilities.push(
      "Local-first LLM inference (Ollama or LM Studio) with JSON validation + repair (`apps/backend/src/llm/inferencer.ts`)."
    );
    capabilities.push("Telegram notifications supported when `TELEGRAM_BOT_TOKEN` + `TELEGRAM_CHAT_ID` set (optional).");
    capabilities.push(
      "Optional cloud LLM fallback: Gemini when `ENABLE_CLOUD_FALLBACK=true` (`apps/backend/src/llm/inferencer.ts`)."
    );
    capabilities.push(
      "Headlines for LLM: 3–5 lines per ticker from Yahoo `search` news, with `[headlines]` + `[inferAnalyst]` safe logs (`apps/backend/src/fetcher/headlines.ts`)."
    );
  } else {
    capabilities.push("Backend package not detected under `apps/backend/`.");
  }
  if (hasFrontend) {
    capabilities.push("Frontend Next.js app exists under `apps/frontend/` (Next 16 / React 19).");
    capabilities.push("Frontend has a Supabase client helper under `apps/frontend/lib/supabase/client.ts` but dashboard pages are not implemented yet.");
  } else {
    capabilities.push("Frontend package not detected under `apps/frontend/`.");
  }

  const nextSteps: string[] = [
    "Align the public Supabase env var contract across docs, `.env.example`, and `apps/frontend` (choose canonical key name and support alias if needed).",
    "Add a minimal frontend dashboard page: list `assets` and show latest `ai_insights` per asset with loading/error states (if not already complete vs `docs/status/current.md`).",
    "Decide on one scheduling approach for production (local cron is already documented; consider Vercel Cron only if/when a deployable API endpoint exists).",
    "Optional: persist headline snapshots in `ai_insights.key_headlines` when product wants DB-level news history (v1 keeps analyst JSON schema-only).",
  ];

  const prompts = buildPrompts({ repoRoot, drift, hasFrontend, hasBackend });

  const report = generateReport({
    repoRoot,
    docsFiles,
    keyFiles,
    drift,
    capabilities,
    nextSteps,
    prompts,
  });

  const statusDir = path.join(repoRoot, "docs", "status");
  fs.mkdirSync(statusDir, { recursive: true });
  const outPath = path.join(statusDir, "latest-audit.md");
  fs.writeFileSync(outPath, report, "utf8");

  // Output to stdout as well.
  // eslint-disable-next-line no-console
  console.log(report);
}

main();

