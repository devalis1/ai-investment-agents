export type Market = "US" | "AR";

export type FetcherAssetInput = {
  ticker: string;
};

export type FetcherTickerFailure = {
  ticker: string;
  detail: string;
};

export type FetcherRunReport = {
  results: FetcherAssetResult[];
  failures: FetcherTickerFailure[];
};

export type FetcherAssetResult = {
  ticker: string;
  market: Market;
  price_current: number;
  rsi: number;
  /** 3–5 headline-style lines for LLM context; empty if the news provider fails. */
  headlines: string[];
  fetched_at: string; // ISO timestamp
};

