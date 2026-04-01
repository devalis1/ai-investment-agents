import { env } from "../../config/env";

type OllamaGenerateResponse = {
  model?: string;
  created_at?: string;
  response?: unknown;
  done?: boolean;
  done_reason?: unknown;
  error?: unknown;
};

type OllamaChatResponse = {
  model?: string;
  created_at?: string;
  message?: { role?: string; content?: unknown };
  done?: boolean;
  done_reason?: unknown;
  error?: unknown;
};

const DETERMINISTIC_OPTIONS = {
  // Reduce drift across reruns for the same prompt+inputs.
  // Ollama supports `seed` for deterministic sampling; combined with temperature 0,
  // this should keep recommendations stable for local inference.
  temperature: 0,
  top_k: 1,
  top_p: 1,
  seed: 42,
  num_predict: 256,
} as const;

export class OllamaClient {
  constructor(
    private readonly baseUrl: string = env.OLLAMA_BASE_URL,
    private readonly model: string = env.OLLAMA_MODEL
  ) {}

  private debug(meta: Record<string, unknown>): void {
    if (env.LLM_DEBUG !== "true") return;
    // eslint-disable-next-line no-console
    console.log("[LLM_DEBUG] ollama meta:", meta);
  }

  async chat(
    messages: Array<{ role: "system" | "user" | "assistant"; content: string }>,
    opts?: { signal?: AbortSignal }
  ): Promise<string> {
    const res = await fetch(`${this.baseUrl}/api/chat`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      signal: opts?.signal,
      body: JSON.stringify({
        model: this.model,
        messages,
        stream: false,
        // Qwen "thinking" models can burn all tokens on hidden reasoning unless this is set.
        // See: ollama/ollama #14793 (2026-03).
        think: false,
        options: {
          ...DETERMINISTIC_OPTIONS,
        },
      }),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(
        `Ollama chat request failed (${res.status}). ${text ? `Body: ${text}` : ""}`
      );
    }

    const data: unknown = await res.json();
    const parsed = data as OllamaChatResponse;

    this.debug({
      endpoint: "chat",
      model: parsed?.model,
      done: parsed?.done,
      done_reason: parsed?.done_reason,
      has_error: Boolean(parsed?.error),
      content_type: typeof parsed?.message?.content,
      content_len:
        typeof parsed?.message?.content === "string"
          ? parsed.message.content.length
          : null,
    });

    if (parsed?.error) throw new Error(`Ollama error: ${String(parsed.error)}`);

    const content = parsed?.message?.content;
    if (typeof content !== "string") {
      throw new Error("Ollama chat response shape unexpected (missing message.content).");
    }
    if (!content.trim()) {
      throw new Error(
        `Ollama returned an empty chat response (done_reason=${String(parsed.done_reason)})`
      );
    }

    return content;
  }

  private async generateOnce(
    prompt: string,
    bodyExtras: Record<string, unknown>,
    opts?: { signal?: AbortSignal }
  ): Promise<string> {
    const res = await fetch(`${this.baseUrl}/api/generate`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      signal: opts?.signal,
      body: JSON.stringify({
        model: this.model,
        prompt,
        stream: false,
        // Qwen "thinking" models can burn all tokens on hidden reasoning unless this is set.
        think: false,
        ...bodyExtras,
        options: {
          ...DETERMINISTIC_OPTIONS,
        },
      }),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(
        `Ollama request failed (${res.status}). ${text ? `Body: ${text}` : ""}`
      );
    }

    const data: unknown = await res.json();
    const parsed = data as OllamaGenerateResponse;

    this.debug({
      model: parsed?.model,
      done: parsed?.done,
      done_reason: parsed?.done_reason,
      has_error: Boolean(parsed?.error),
      response_type: typeof parsed?.response,
      response_len: typeof parsed?.response === "string" ? parsed.response.length : null,
      used_format_json: Boolean((bodyExtras as any)?.format === "json"),
    });

    if (parsed?.error) {
      throw new Error(`Ollama error: ${String(parsed.error)}`);
    }

    if (typeof parsed?.response !== "string") {
      throw new Error("Ollama response shape unexpected (missing string `response`).");
    }

    if (!parsed.response.trim()) {
      throw new Error(
        `Ollama returned an empty response (done_reason=${String(parsed.done_reason)})`
      );
    }

    return parsed.response;
  }

  async generate(prompt: string, opts?: { signal?: AbortSignal }): Promise<string> {
    // First try: ask Ollama to return JSON directly (works on newer versions).
    try {
      const out = await this.generateOnce(prompt, { format: "json" }, opts);
      return out;
    } catch {
      // Fallback: retry without `format`, still constrained via `num_predict`.
      return await this.generateOnce(prompt, {}, opts);
    }
  }
}

