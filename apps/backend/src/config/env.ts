import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";

type Env = Record<string, string | undefined>;

function loadDotEnv(): void {
  // Try to load the project root `.env.local` regardless of where this script is executed from.
  const candidates = [
    path.resolve(process.cwd(), ".env.local"),
    path.resolve(process.cwd(), "..", ".env.local"),
    path.resolve(process.cwd(), "..", "..", ".env.local"),
  ];

  for (const p of candidates) {
    if (fs.existsSync(p)) {
      dotenv.config({ path: p });
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

export type EnvShape = Env & {
  LLM_LOCAL_PROVIDER: LlmLocalProvider;
  OLLAMA_BASE_URL: string;
  OLLAMA_MODEL: string;
  LMSTUDIO_BASE_URL: string;
  LMSTUDIO_MODEL: string;
  ENABLE_CLOUD_FALLBACK: "true" | "false";

  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;

  TELEGRAM_BOT_TOKEN?: string;
  TELEGRAM_CHAT_ID?: string;

  LLM_DEBUG?: string;
};

export const env: EnvShape = {
  ...process.env,
  LLM_LOCAL_PROVIDER:
    process.env.LLM_LOCAL_PROVIDER === "lmstudio" ? "lmstudio" : "ollama",
  OLLAMA_BASE_URL: process.env.OLLAMA_BASE_URL ?? "http://localhost:11434",
  OLLAMA_MODEL: process.env.OLLAMA_MODEL ?? "qwen3.5:latest",
  LMSTUDIO_BASE_URL: process.env.LMSTUDIO_BASE_URL ?? "http://localhost:1234/v1",
  LMSTUDIO_MODEL: process.env.LMSTUDIO_MODEL ?? "",
  ENABLE_CLOUD_FALLBACK:
    process.env.ENABLE_CLOUD_FALLBACK === "true" ? "true" : "false",

  SUPABASE_URL: process.env.SUPABASE_URL ?? "",
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
};

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

