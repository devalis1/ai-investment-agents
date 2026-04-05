import { env, assertLlmConfigForLocal, getLlmLocalProvider } from "../config/env";
import { AnalystResponseSchema, type AnalystResponse } from "./schema";
import { OllamaClient } from "./providers/ollama";
import { LmStudioClient } from "./providers/lmstudio";
import { GeminiClient } from "./providers/gemini";

export type AnalystInputs = {
  ticker: string;
  price_current: number;
  rsi: number;
  headlines: string[];
};

function buildAnalystPrompt(inputs: AnalystInputs): string {
  const headlinesText =
    inputs.headlines.length > 0 ? inputs.headlines.join("\n- ") : "N/A";

  return [
    "Act as a financial analyst.",
    "Return ONLY valid JSON, with no extra text.",
    'The JSON must match this schema: {"recommendation":"Hold|Buy|Sell","reasoning":"string"}.',
    "",
    "Decision policy (MUST FOLLOW EXACTLY):",
    "- If rsi < 30: recommendation MUST be \"Buy\"",
    "- If 30 <= rsi <= 70: recommendation MUST be \"Hold\"",
    "- If rsi > 70: recommendation MUST be \"Sell\"",
    "This policy is deterministic and overrides any other considerations.",
    "When headline lines are provided, use them only to enrich `reasoning` (themes, not long quotes). They MUST NOT change `recommendation` away from the RSI policy. If headlines are N/A or empty, reason from price and RSI alone.",
    "",
    "Inputs:",
    `ticker: ${inputs.ticker}`,
    `price_current: ${inputs.price_current}`,
    `rsi: ${inputs.rsi}`,
    "headlines:",
    `- ${headlinesText}`,
  ].join("\n");
}

function tryValidate(outputText: string): AnalystResponse | null {
  try {
    const trimmed = outputText.trim();

    // Some models wrap the JSON in ```json ... ``` (closing fence may be missing if truncated).
    const fencedMatch = trimmed.match(/```json\s*([\s\S]*?)\s*```/i);
    const maybeJson = fencedMatch?.[1] ?? trimmed.replace(/^```(?:json)?\s*/i, "");

    // If the model returned extra text, trim to the first "{" and the last "}".
    const firstBrace = maybeJson.indexOf("{");
    const lastBrace = maybeJson.lastIndexOf("}");
    const jsonCandidate =
      firstBrace >= 0 && lastBrace > firstBrace
        ? maybeJson.slice(firstBrace, lastBrace + 1)
        : maybeJson;

    return AnalystResponseSchema.parse(JSON.parse(jsonCandidate));
  } catch {
    return null;
  }
}

function debugLog(label: string, text: string): void {
  if (env.LLM_DEBUG !== "true") return;
  const sample = text.replace(/\s+/g, " ").slice(0, 300);
  // eslint-disable-next-line no-console
  console.log(`[LLM_DEBUG] ${label}:`, sample);
}

async function inferLocal(prompt: string): Promise<AnalystResponse> {
  const provider = getLlmLocalProvider();
  assertLlmConfigForLocal(provider);

  if (provider === "lmstudio") {
    const localClient = new LmStudioClient();
    const messages = [
      { role: "system", content: "Respond with ONLY valid JSON." },
      { role: "user", content: prompt },
    ];
    const raw = await localClient.chatCompletionJson(messages);
    const validated = tryValidate(raw);
    if (!validated) throw new Error("Local model returned invalid JSON.");
    return validated;
  }

  const localClient = new OllamaClient();
  const raw = await localClient.generate(prompt);
  const validated = tryValidate(raw);
  if (!validated) throw new Error("Local model returned invalid JSON.");
  return validated;
}

function buildRepairPrompt(originalPrompt: string, previousOutput: string): string {
  return [
    originalPrompt,
    "",
    "Your previous output was invalid.",
    "Return ONLY a valid JSON object with the exact keys and allowed values.",
    'Schema: {"recommendation":"Hold|Buy|Sell","reasoning":"string"}',
    "",
    "Invalid output was:",
    previousOutput.slice(0, 1200),
  ].join("\n");
}

async function inferGemini(prompt: string, opts?: { signal?: AbortSignal }): Promise<AnalystResponse> {
  if (!env.GEMINI_API_KEY) {
    throw new Error("Missing GEMINI_API_KEY (required for cloud fallback).");
  }

  const client = new GeminiClient(env.GEMINI_API_KEY, env.GEMINI_MODEL);

  const raw1 = await client.generateJson(
    ["Respond with ONLY valid JSON.", "", prompt].join("\n"),
    { signal: opts?.signal }
  );
  debugLog(`gemini raw1 (${env.GEMINI_MODEL})`, raw1);
  const validated1 = tryValidate(raw1);
  if (validated1) return validated1;

  const raw2 = await client.generateJson(
    ["Respond with ONLY valid JSON.", "", buildRepairPrompt(prompt, raw1)].join("\n"),
    { signal: opts?.signal }
  );
  debugLog(`gemini raw2 (${env.GEMINI_MODEL})`, raw2);
  const validated2 = tryValidate(raw2);
  if (!validated2) {
    throw new Error(
      `Gemini returned invalid JSON. Sample: ${JSON.stringify(raw2.slice(0, 200))}`
    );
  }
  return validated2;
}

export async function inferAnalyst(
  inputs: AnalystInputs,
  opts?: { signal?: AbortSignal }
): Promise<AnalystResponse> {
  const inferStarted = performance.now();
  const prompt = buildAnalystPrompt(inputs);

  const logInferComplete = (providerId: string, schemaRepairAttempts: number): void => {
    // eslint-disable-next-line no-console
    console.log("[inferAnalyst]", {
      ticker: inputs.ticker,
      headlineCount: inputs.headlines.length,
      providerId,
      latencyMs: Math.round(performance.now() - inferStarted),
      schemaRepairAttempts,
    });
  };

  // 1) Local first (Ollama / LM Studio)
  try {
    const provider = getLlmLocalProvider();
    assertLlmConfigForLocal(provider);

    if (provider === "lmstudio") {
      const localClient = new LmStudioClient();
      const messages = [
        { role: "system", content: "Respond with ONLY valid JSON." },
        { role: "user", content: prompt },
      ];
      const raw1 = await localClient.chatCompletionJson(messages, { signal: opts?.signal });
      debugLog(`lmstudio raw1 (${inputs.ticker})`, raw1);
      const validated1 = tryValidate(raw1);
      if (validated1) {
        logInferComplete("lmstudio", 0);
        return validated1;
      }

      const repairMessages = [
        { role: "system", content: "Respond with ONLY valid JSON." },
        { role: "user", content: buildRepairPrompt(prompt, raw1) },
      ];
      const raw2 = await localClient.chatCompletionJson(repairMessages, { signal: opts?.signal });
      debugLog(`lmstudio raw2 (${inputs.ticker})`, raw2);
      const validated2 = tryValidate(raw2);
      if (!validated2) {
        throw new Error(
          `Local model returned invalid JSON. Sample: ${JSON.stringify(raw2.slice(0, 200))}`
        );
      }
      logInferComplete("lmstudio", 1);
      return validated2;
    }

    const localClient = new OllamaClient();
    const raw1 = await localClient.chat(
      [
        { role: "system", content: "Respond with ONLY valid JSON." },
        { role: "user", content: prompt },
      ],
      { signal: opts?.signal }
    );
    debugLog(`ollama raw1 (${inputs.ticker})`, raw1);
    const validated1 = tryValidate(raw1);
    if (validated1) {
      logInferComplete("ollama", 0);
      return validated1;
    }

    const raw2 = await localClient.chat(
      [
        { role: "system", content: "Respond with ONLY valid JSON." },
        { role: "user", content: buildRepairPrompt(prompt, raw1) },
      ],
      { signal: opts?.signal }
    );
    debugLog(`ollama raw2 (${inputs.ticker})`, raw2);
    const validated2 = tryValidate(raw2);
    if (!validated2) {
      throw new Error(
        `Local model returned invalid JSON. Sample: ${JSON.stringify(raw2.slice(0, 200))}`
      );
    }
    logInferComplete("ollama", 1);
    return validated2;
  } catch (err) {
    // Fall through to optional cloud fallback
    // (keep error non-sensitive; do not include prompts/keys)
    const localHint =
      err instanceof Error ? err.message : String(err);
    if (env.ENABLE_CLOUD_FALLBACK === "true") {
      // eslint-disable-next-line no-console
      console.warn("Local inference failed; falling back to cloud model.", {
        ticker: inputs.ticker,
        localProvider: getLlmLocalProvider(),
        localError: localHint,
        cloudProvider: "gemini",
        model: env.GEMINI_MODEL,
      });
      const cloud = await inferGemini(prompt, { signal: opts?.signal });
      logInferComplete(`gemini:${env.GEMINI_MODEL}`, 0);
      return cloud;
    }

    throw new Error(
      "Local inference failed; cloud fallback disabled. Check local model + JSON schema."
    );
  }
}

