import fs from "node:fs";
import path from "node:path";
import { z } from "zod";
import type { FetcherAssetResult } from "./types";

const StubTickerSchema = z.object({
  market: z.enum(["US", "AR"]),
  price_current: z.number().finite().positive(),
  rsi: z.number().finite(),
  headlines: z.array(z.string()).optional(),
});

const StubFileSchema = z.record(z.string(), StubTickerSchema);

export type DevStubFile = z.infer<typeof StubFileSchema>;

function resolveStubPath(configured?: string): string {
  const rel = configured?.trim() || "data/dev-market-stub.json";
  return path.isAbsolute(rel) ? rel : path.resolve(process.cwd(), rel);
}

export function loadDevStubFile(configuredPath?: string): DevStubFile {
  const full = resolveStubPath(configuredPath);
  if (!fs.existsSync(full)) {
    throw new Error(
      `Dev market stub file missing: ${full}. Copy data/dev-market-stub.example.json, tune tickers, and set FETCH_DEV_STUB_PATH if needed.`
    );
  }
  const raw = fs.readFileSync(full, "utf8");
  const parsed: unknown = JSON.parse(raw);
  return StubFileSchema.parse(parsed);
}

export function stubRowToFetcherResult(
  ticker: string,
  row: z.infer<typeof StubTickerSchema>,
  fetchedAt: string
): FetcherAssetResult {
  return {
    ticker,
    market: row.market,
    price_current: row.price_current,
    rsi: row.rsi,
    headlines: row.headlines ?? [],
    fetched_at: fetchedAt,
  };
}
