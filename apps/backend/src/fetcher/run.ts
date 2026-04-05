import { env } from "../config/env";
import { summarizeUndiciFetchError } from "./errorSummary";
import { loadDevStubFile, stubRowToFetcherResult } from "./devStub";
import { fetchHeadlinesForTicker } from "./headlines";
import { fetchYahooPriceAndRsi } from "./yahooFinance";
import type {
  FetcherAssetInput,
  FetcherAssetResult,
  FetcherRunReport,
  FetcherTickerFailure,
} from "./types";
import type { DevStubFile } from "./devStub";

function stubLookup(data: DevStubFile, ticker: string) {
  return data[ticker] ?? data[ticker.toUpperCase()];
}

export async function runFetcher(
  inputs: FetcherAssetInput[]
): Promise<FetcherRunReport> {
  const fetchedAt = new Date().toISOString();

  const results: FetcherAssetResult[] = [];
  const failures: FetcherTickerFailure[] = [];
  let stubCache: DevStubFile | null = null;

  const ensureStub = (): DevStubFile => {
    if (!stubCache) {
      stubCache = loadDevStubFile(env.FETCH_DEV_STUB_PATH);
    }
    return stubCache;
  };

  for (const input of inputs) {
    const { ticker } = input;
    try {
      if (env.FETCH_MARKET_DATA_MODE === "dev_stub") {
        const data = ensureStub();
        const row = stubLookup(data, ticker);
        if (!row) {
          failures.push({
            ticker,
            detail: `dev_stub: missing ticker "${ticker}" in stub file`,
          });
          continue;
        }
        results.push(stubRowToFetcherResult(ticker, row, fetchedAt));
        // eslint-disable-next-line no-console
        console.log("[fetcher] row ready (dev_stub):", {
          ticker,
          headlineCount: row.headlines?.length ?? 0,
        });
        continue;
      }

      let market: FetcherAssetResult["market"];
      let price_current: number;
      let rsi: number;
      let priceFromStub = false;

      try {
        const y = await fetchYahooPriceAndRsi(ticker);
        market = y.market;
        price_current = y.price_current;
        rsi = y.rsi;
      } catch (err) {
        if (env.FETCH_MARKET_DATA_FALLBACK === "dev_stub") {
          const data = ensureStub();
          const row = stubLookup(data, ticker);
          if (row) {
            market = row.market;
            price_current = row.price_current;
            rsi = row.rsi;
            priceFromStub = true;
          } else {
            failures.push({
              ticker,
              detail: `${summarizeUndiciFetchError(err)} | dev_stub fallback: no entry for "${ticker}" in stub file`,
            });
            continue;
          }
        } else {
          failures.push({
            ticker,
            detail: summarizeUndiciFetchError(err),
          });
          continue;
        }
      }

      const { headlines: yhHeadlines } = await fetchHeadlinesForTicker(ticker);
      let headlines = yhHeadlines;
      if (headlines.length === 0 && priceFromStub) {
        const data = ensureStub();
        const row = stubLookup(data, ticker);
        headlines = row?.headlines ?? [];
      }

      // eslint-disable-next-line no-console
      console.log("[fetcher] row ready:", {
        ticker,
        headlineCount: headlines.length,
        priceSource: priceFromStub ? "dev_stub_fallback" : "yahoo",
      });

      results.push({
        ticker,
        market,
        price_current,
        rsi,
        headlines,
        fetched_at: fetchedAt,
      });
    } catch (err) {
      failures.push({
        ticker,
        detail: summarizeUndiciFetchError(err),
      });
    }
  }

  if (results.length < inputs.length) {
    // eslint-disable-next-line no-console
    console.warn("[fetcher] some tickers skipped:", {
      fetched: results.length,
      requested: inputs.length,
    });
  }

  return { results, failures };
}
