import { env } from "../../config/env";

type GeminiGenerateContentResponse = {
  candidates?: Array<{
    content?: { parts?: Array<{ text?: unknown }> };
    finishReason?: unknown;
  }>;
  promptFeedback?: unknown;
  usageMetadata?: unknown;
};

export class GeminiClient {
  constructor(
    private readonly apiKey: string,
    private readonly model: string = env.GEMINI_MODEL
  ) {}

  async generateJson(prompt: string, opts?: { signal?: AbortSignal }): Promise<string> {
    const url = new URL(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
        this.model
      )}:generateContent`
    );
    url.searchParams.set("key", this.apiKey);

    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      signal: opts?.signal,
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [{ text: prompt }],
          },
        ],
        generationConfig: {
          temperature: 0,
          topK: 1,
          topP: 1,
          // Analyst JSON + reasoning needs headroom; 256 truncates mid-fence and breaks JSON.parse.
          maxOutputTokens: 1024,
        },
      }),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(
        `Gemini request failed (${res.status}). ${text ? `Body: ${text}` : ""}`
      );
    }

    const data: unknown = await res.json();
    const parsed = data as GeminiGenerateContentResponse;
    const text = parsed.candidates?.[0]?.content?.parts?.[0]?.text;
    if (typeof text !== "string" || !text.trim()) {
      throw new Error("Gemini response shape unexpected (missing candidates[0].content.parts[0].text).");
    }

    return text;
  }
}

