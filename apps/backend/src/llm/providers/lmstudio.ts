import { env } from "../../config/env";

type ChatCompletionResponse = {
  choices?: Array<{
    message?: { content?: unknown };
  }>;
};

export class LmStudioClient {
  constructor(
    private readonly baseUrl: string = env.LMSTUDIO_BASE_URL,
    private readonly model: string = env.LMSTUDIO_MODEL
  ) {}

  async chatCompletionJson(
    messages: Array<{ role: string; content: string }>,
    opts?: { signal?: AbortSignal }
  ): Promise<string> {
    if (!this.model) {
      throw new Error(
        "LMSTUDIO_MODEL is empty. Set it in `.env.local` to the model id/name you installed in LM Studio."
      );
    }

    const res = await fetch(`${this.baseUrl}/chat/completions`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      signal: opts?.signal,
      body: JSON.stringify({
        model: this.model,
        messages,
        temperature: 0.2,
        stream: false,
        max_tokens: 256,
      }),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(
        `LM Studio request failed (${res.status}). ${text ? `Body: ${text}` : ""}`
      );
    }

    const data: unknown = await res.json();
    const parsed = data as ChatCompletionResponse;
    const content = parsed.choices?.[0]?.message?.content;
    if (typeof content !== "string") {
      throw new Error("LM Studio response shape unexpected.");
    }

    return content;
  }
}

