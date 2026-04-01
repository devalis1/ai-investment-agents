export type Market = "US" | "AR";

export type FetcherAssetInput = {
  ticker: string;
};

export type FetcherAssetResult = {
  ticker: string;
  market: Market;
  price_current: number;
  rsi: number;
  fetched_at: string; // ISO timestamp
};

