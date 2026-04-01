import { fetchYahooPriceAndRsi } from "./yahooFinance";
import type { FetcherAssetInput, FetcherAssetResult } from "./types";

export async function runFetcher(
  inputs: FetcherAssetInput[]
): Promise<FetcherAssetResult[]> {
  const fetchedAt = new Date().toISOString();

  const results: FetcherAssetResult[] = [];
  for (const input of inputs) {
    const { ticker } = input;
    const { market, price_current, rsi } = await fetchYahooPriceAndRsi(ticker);

    results.push({
      ticker,
      market,
      price_current,
      rsi,
      fetched_at: fetchedAt,
    });
  }

  return results;
}

