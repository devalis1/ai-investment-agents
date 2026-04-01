import { env, assertLlmConfigForLocal, getLlmLocalProvider } from "../config/env";
import { AnalystResponseSchema, type AnalystResponse } from "./schema";
import { OllamaClient } from "./providers/ollama";
import { LmStudioClient } from "./providers/lmstudio";

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
    "This policy is deterministic and overrides any other considerations. Headlines may be used only to add context in reasoning, but MUST NOT change the recommendation away from the RSI policy.",
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

    // Some models wrap the JSON in ```json ... ```
    const fencedMatch = trimmed.match(/```json\s*([\s\S]*?)\s*```/i);
    const maybeJson = fencedMatch?.[1] ?? trimmed;

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

export async function inferAnalyst(
  inputs: AnalystInputs,
  opts?: { signal?: AbortSignal }
): Promise<AnalystResponse> {
  const prompt = buildAnalystPrompt(inputs);

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
      if (validated1) return validated1;

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
    if (validated1) return validated1;

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
    return validated2;
  } catch (err) {
    // Fall through to optional cloud fallback
    // (keep error non-sensitive; do not include prompts/keys)
    if (env.ENABLE_CLOUD_FALLBACK === "true") {
      // TODO: Implement cloud fallback using OpenAI/Gemini when an API key is available.
      // - Add cloud provider config & client
      // - Re-ask for structured JSON with a stricter prompt
      // - Validate with `AnalystResponseSchema`
      // - Log only metadata (ticker/model/latency), never secrets or full prompts
      throw new Error(
        "Local inference failed and cloud fallback is not implemented yet (TODO)."
      );
    }

    throw new Error(
      "Local inference failed; cloud fallback disabled. Check local model + JSON schema."
    );
  }
}

