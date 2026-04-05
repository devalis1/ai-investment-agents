import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";

function loadDotEnv(): void {
  // Try to load the project root `.env.local` regardless of where this script is executed from.
  const candidates = [
    path.resolve(process.cwd(), ".env.local"),
    path.resolve(process.cwd(), "..", ".env.local"),
    path.resolve(process.cwd(), "..", "..", ".env.local"),
  ];

  for (const p of candidates) {
    if (fs.existsSync(p)) {
      // Prefer repo `.env.local` over inherited shell exports (e.g. stale GEMINI_MODEL).
      dotenv.config({ path: p, override: true });
      return;
    }
  }
}

loadDotEnv();

function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var: ${name}`);
  return v;
}

export type LlmLocalProvider = "ollama" | "lmstudio";

export type FetchMarketDataMode = "yahoo" | "dev_stub";
export type FetchMarketDataFallback = "none" | "dev_stub";

export type EnvShape = {
  /** Comma-separated symbols for `cycle:daily` when `public.tickers` has no enabled rows (or the DB query fails). */
  TICKERS?: string;
  LLM_LOCAL_PROVIDER: LlmLocalProvider;
  OLLAMA_BASE_URL: string;
  OLLAMA_MODEL: string;
  LMSTUDIO_BASE_URL: string;
  LMSTUDIO_MODEL: string;
  ENABLE_CLOUD_FALLBACK: "true" | "false";
  GEMINI_API_KEY?: string;
  GEMINI_MODEL: string;

  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;

  TELEGRAM_BOT_TOKEN?: string;
  TELEGRAM_CHAT_ID?: string;

  LLM_DEBUG?: string;

  /** Optional override for yahoo-finance2 (e.g. `query1.finance.yahoo.com` if query2 is blocked). */
  YAHOO_FINANCE_QUERY_HOST?: string;
  /** Per-request fetch timeout (ms) for Yahoo HTTP calls. Default 60000. */
  YAHOO_FETCH_TIMEOUT_MS: number;
  /**
   * Use Undici with IPv4-only DNS (and disable RFC 8305-style dual-stack racing).
   * Set to "false" only if you need dual-stack (rare). Default on — fixes many residential IPv6 EHOSTUNREACH failures.
   */
  YAHOO_FETCH_IPV4_ONLY: boolean;
  /**
   * `yahoo` — live Yahoo Finance (default).
   * `dev_stub` — read-only JSON fixture for local E2E when Yahoo is unreachable (see FETCH_DEV_STUB_PATH).
   */
  FETCH_MARKET_DATA_MODE: FetchMarketDataMode;
  /**
   * After Yahoo price/RSI exhausts retries, optionally load from the dev stub file (`dev_stub`).
   * Default `none` — no silent substitution.
   */
  FETCH_MARKET_DATA_FALLBACK: FetchMarketDataFallback;
  /** Path to stub JSON (relative to cwd or absolute). Default `data/dev-market-stub.json`. */
  FETCH_DEV_STUB_PATH?: string;
};

export const env = {
  ...process.env,
  LLM_LOCAL_PROVIDER:
    process.env.LLM_LOCAL_PROVIDER === "lmstudio" ? "lmstudio" : "ollama",
  OLLAMA_BASE_URL: process.env.OLLAMA_BASE_URL ?? "http://localhost:11434",
  OLLAMA_MODEL: process.env.OLLAMA_MODEL ?? "qwen3.5:latest",
  LMSTUDIO_BASE_URL: process.env.LMSTUDIO_BASE_URL ?? "http://localhost:1234/v1",
  LMSTUDIO_MODEL: process.env.LMSTUDIO_MODEL ?? "",
  ENABLE_CLOUD_FALLBACK:
    process.env.ENABLE_CLOUD_FALLBACK === "true" ? "true" : "false",
  GEMINI_API_KEY: process.env.GEMINI_API_KEY,
  // Google periodically removes unversioned model ids; use a current Flash id (see AI Studio model list).
  GEMINI_MODEL: process.env.GEMINI_MODEL ?? "gemini-2.5-flash",

  SUPABASE_URL: process.env.SUPABASE_URL ?? "",
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",

  YAHOO_FINANCE_QUERY_HOST: process.env.YAHOO_FINANCE_QUERY_HOST,

  YAHOO_FETCH_IPV4_ONLY: process.env.YAHOO_FETCH_IPV4_ONLY !== "false",

  YAHOO_FETCH_TIMEOUT_MS: (() => {
    const raw = process.env.YAHOO_FETCH_TIMEOUT_MS;
    if (raw === undefined || raw === "") return 60_000;
    const n = Number(raw);
    if (!Number.isFinite(n) || n < 5_000) return 60_000;
    return Math.min(Math.floor(n), 120_000);
  })(),

  FETCH_MARKET_DATA_MODE:
    process.env.FETCH_MARKET_DATA_MODE === "dev_stub" ? "dev_stub" : "yahoo",

  FETCH_MARKET_DATA_FALLBACK:
    process.env.FETCH_MARKET_DATA_FALLBACK === "dev_stub" ? "dev_stub" : "none",

  FETCH_DEV_STUB_PATH: process.env.FETCH_DEV_STUB_PATH,
} as EnvShape;

export function getLlmLocalProvider(): LlmLocalProvider {
  return env.LLM_LOCAL_PROVIDER;
}

export function assertLlmConfigForLocal(provider: LlmLocalProvider): void {
  if (provider === "lmstudio" && !env.LMSTUDIO_MODEL) {
    // LM Studio model name is provider-specific; keep it explicit.
    throw new Error(
      "Missing LMSTUDIO_MODEL. Set it in your `.env.local` (e.g. the model id shown in LM Studio)."
    );
  }
}

export function getEnv(name: string): string {
  return required(name);
}

export function assertSupabaseConfigForServer(): void {
  if (!env.SUPABASE_URL) {
    throw new Error("Missing SUPABASE_URL in `.env.local`.");
  }
  if (!env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY in `.env.local`.");
  }
}

