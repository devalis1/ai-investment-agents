import { runFetcher } from "../fetcher/run";
import { logYahooNetworkHints } from "../fetcher/fetchDiagnostics";
import type { FetcherRunReport } from "../fetcher/types";
import { createServiceClient } from "../supabase/serviceClient";
import { resolveCycleTickers } from "../tickers/resolveCycleTickers";
import { inferAnalyst } from "../llm/inferencer";
import { type AnalystResponse } from "../llm/schema";
import { sendTelegramNotification } from "../telegram/send";
import { env } from "../config/env";
import path from "node:path";
import { fileURLToPath } from "node:url";

export type AnalyzeCycleOptions = {
  tickers: string[];
  market?: "US" | "AR" | "auto";
};

async function withTimeout<T>(
  label: string,
  promise: unknown,
  timeoutMs: number
): Promise<T> {
  let timer: NodeJS.Timeout | undefined;

  const timeoutPromise = new Promise<T>((_, reject) => {
    timer = setTimeout(() => {
      reject(new Error(`${label} timed out after ${timeoutMs}ms`));
    }, timeoutMs);
  });

  try {
    return await Promise.race([promise as Promise<T>, timeoutPromise]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function maybeNotifyTelegram(params: {
  ticker: string;
  recommendation: string;
  reasoning: string;
  current_price: number;
  rsi: number;
}): Promise<void> {
  if (!env.TELEGRAM_BOT_TOKEN || !env.TELEGRAM_CHAT_ID) return;

  // Skip placeholder values so local demos don't hang on invalid credentials.
  if (
    env.TELEGRAM_BOT_TOKEN.includes("your_") ||
    env.TELEGRAM_CHAT_ID.includes("your_")
  ) {
    return;
  }

  try {
    await sendTelegramNotification(env.TELEGRAM_BOT_TOKEN, env.TELEGRAM_CHAT_ID, {
      ticker: params.ticker,
      recommendation: params.recommendation,
      reasoning: params.reasoning,
      current_price: params.current_price,
      rsi: params.rsi,
    });
  } catch {
    // TODO: Add better error handling + logging once we have observability in place.
  }
}

export async function analyzeCycle(
  options: AnalyzeCycleOptions
): Promise<FetcherRunReport> {
  const supabase = createServiceClient();

  const fetchInputs = options.tickers.map((ticker) => ({ ticker }));
  // Keep a global, hard upper bound per ticker so the job never hangs silently.
  // Local LLM generation can occasionally take > 2 minutes on first load/cold cache.
  const tickerTimeoutMs = 240_000;

  // eslint-disable-next-line no-console
  console.log("Starting analyze cycle:", { tickers: options.tickers });

  const fetchReport = await runFetcher(fetchInputs);

  for (const item of fetchReport.results) {
    const { ticker, market, price_current, rsi, headlines, fetched_at } = item;

    try {
      // eslint-disable-next-line no-console
      console.log("Processing ticker:", { ticker, market });

      const { data: asset, error: assetErr } = await supabase
        .from("assets")
        .upsert(
          {
            ticker,
            name: ticker,
            market,
            last_analyzed: fetched_at,
          },
          { onConflict: "ticker" }
        )
        .select("id,ticker")
        .single();

      if (assetErr || !asset) {
        // eslint-disable-next-line no-console
        console.error("Upsert assets failed:", {
          ticker,
          ok: false,
          error: assetErr?.message ?? null,
        });
        continue;
      }

      // eslint-disable-next-line no-console
      console.log("Calling inferAnalyst:", {
        ticker,
        rsi,
        price_current,
        headlineCount: headlines.length,
      });

      const llmAbort = new AbortController();
      const llmTimeout = setTimeout(() => llmAbort.abort(), tickerTimeoutMs);
      let llmResult: AnalystResponse;
      try {
        llmResult = await inferAnalyst(
          {
            ticker,
            price_current,
            rsi,
            headlines,
          },
          { signal: llmAbort.signal }
        );
      } finally {
        clearTimeout(llmTimeout);
      }

      // eslint-disable-next-line no-console
      console.log("Inserting ai_insights:", { ticker });

      const insertResponse = await withTimeout<{
        error: { message: string } | null;
        data: unknown;
      }>(
        `insert(ai_insights:${ticker})`,
        supabase
          .from("ai_insights")
          .insert({
            asset_id: asset.id,
            recommendation: llmResult.recommendation,
            reasoning: llmResult.reasoning,
            key_headlines: {},
            current_price: price_current,
          })
          .select("id")
          .single() as unknown,
        tickerTimeoutMs
      );

      const { error: insightErr } = insertResponse;

      if (insightErr) {
        // eslint-disable-next-line no-console
        console.error("Insert ai_insights failed:", {
          ticker,
          ok: false,
          error: insightErr.message,
        });
        continue;
      }

      // eslint-disable-next-line no-console
      console.log("Telegram notification step:", { ticker });

      await withTimeout<void>(
        `maybeNotifyTelegram(${ticker})`,
        maybeNotifyTelegram({
          ticker,
          recommendation: llmResult.recommendation,
          reasoning: llmResult.reasoning,
          current_price: price_current,
          rsi,
        }),
        10_000
      );

      // eslint-disable-next-line no-console
      console.log("Cycle complete for:", {
        ticker,
        recommendation: llmResult.recommendation,
      });
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("Cycle step failed for ticker:", {
        ticker,
        error: err instanceof Error ? err.message : String(err),
      });
      continue;
    }
  }

  return fetchReport;
}

// CLI entrypoint
async function main(): Promise<void> {
  const supabase = createServiceClient();
  const { tickers, source } = await resolveCycleTickers(
    supabase,
    process.env.TICKERS
  );
  // eslint-disable-next-line no-console
  console.log("Cycle tickers resolved:", { source, tickers });

  const hardTimeoutMs = Number(process.env.CYCLE_HARD_TIMEOUT_MS ?? 1_800_000);
  const hardTimer = setTimeout(() => {
    // eslint-disable-next-line no-console
    console.error("Analyze cycle hard timeout reached. Exiting.", {
      hardTimeoutMs,
      tickers,
    });
    process.exit(1);
  }, hardTimeoutMs);
  hardTimer.unref();

  try {
    const fetchReport = await analyzeCycle({ tickers });
    if (fetchReport.results.length === 0 && tickers.length > 0) {
      // eslint-disable-next-line no-console
      console.error("[cycle] Every ticker failed market data fetch.", {
        failures: fetchReport.failures,
      });
      logYahooNetworkHints();
      process.exit(1);
    }
  } finally {
    clearTimeout(hardTimer);
  }
}

// Run the CLI only when this file is executed directly (not when imported).
const isExecutedDirectly =
  typeof process.argv[1] === "string" &&
  fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);

if (isExecutedDirectly) {
  main().catch((err) => {
    // eslint-disable-next-line no-console
    console.error(err);
    process.exit(1);
  });
}

