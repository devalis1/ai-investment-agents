import type { SupabaseClient } from "@supabase/supabase-js";

import { normalizeTickerList } from "../ticker-symbols";

const DEFAULT_TICKERS_CSV = "AAPL,MSFT,NVDA";

function tickersFromEnvCsv(
  raw: string | undefined,
  defaultCsv: string
): string[] {
  const csv = raw ?? defaultCsv;
  const parts = csv
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return normalizeTickerList(parts);
}

export type CycleTickerSource = "database" | "env";

/**
 * Prefer enabled rows in `public.tickers` when at least one valid symbol remains
 * after normalization; otherwise use TICKERS (comma-separated) with defaults.
 */
export async function resolveCycleTickers(
  supabase: SupabaseClient,
  envTickers: string | undefined
): Promise<{ tickers: string[]; source: CycleTickerSource }> {
  const envFallback = tickersFromEnvCsv(envTickers, DEFAULT_TICKERS_CSV);

  const { data, error } = await supabase
    .from("tickers")
    .select("ticker")
    .eq("enabled", true)
    .order("ticker", { ascending: true });

  if (error) {
    // eslint-disable-next-line no-console
    console.warn(
      "resolveCycleTickers: query failed; using TICKERS env:",
      error.message
    );
    return { tickers: envFallback, source: "env" };
  }

  const fromDb = normalizeTickerList((data ?? []).map((r) => r.ticker));
  if (fromDb.length === 0) {
    return { tickers: envFallback, source: "env" };
  }

  return { tickers: fromDb, source: "database" };
}
