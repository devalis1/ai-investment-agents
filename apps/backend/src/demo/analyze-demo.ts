import { runFetcher } from "../fetcher/run";
import { createServiceClient } from "../supabase/serviceClient";
import { inferAnalyst } from "../llm/inferencer";

async function main(): Promise<void> {
  const supabase = createServiceClient();

  const tickers = ["AAPL", "MSFT", "NVDA"];

  const fetchResults = await runFetcher(tickers.map((ticker) => ({ ticker })));

  for (const item of fetchResults) {
    // Use the fetcher output to keep prices/RSI consistent across the system.
    const { ticker, market, price_current, rsi, fetched_at } = item;

    // 1) Upsert asset row
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

    // 2) Prepare LLM inputs (headlines will be added in Phase 3/5).
    // TODO: Fetch real headlines/news per ticker and pass them into `inferAnalyst`.
    const llmResult = await inferAnalyst({
      ticker,
      price_current,
      rsi,
      headlines: [],
    });

    // 3) Insert AI insight
    const { error: insightErr } = await supabase.from("ai_insights").insert({
      asset_id: asset.id,
      recommendation: llmResult.recommendation,
      reasoning: llmResult.reasoning,
      key_headlines: {},
      current_price: price_current,
    });

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
    console.log("Analysis complete:", {
      ticker,
      recommendation: llmResult.recommendation,
      rsi,
      price_current,
    });
  }
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});

