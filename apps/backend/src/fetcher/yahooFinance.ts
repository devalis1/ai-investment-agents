import YahooFinance from "yahoo-finance2";
import type { Market } from "./types";

const yf = new YahooFinance();

function inferMarketFromTicker(ticker: string): Market {
  // Argentina tickers often end with `.BA` in Yahoo Finance conventions.
  return ticker.toUpperCase().endsWith(".BA") ? "AR" : "US";
}

function toFiniteNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function extractPrice(quote: Record<string, unknown>): number | null {
  // yahoo-finance2 fields can differ by version; try common candidates.
  const candidates = [
    quote.regularMarketPrice,
    quote.price,
    quote.bid,
    quote.ask,
    quote.lastPrice,
  ];
  for (const c of candidates) {
    const n = toFiniteNumber(c);
    if (n !== null) return n;
  }
  return null;
}

function extractRsi(rsi: unknown): number | null {
  return null;
}

function computeRsiFromCloses(closes: number[], period = 14): number | null {
  if (closes.length < period + 1) return null;

  // Wilder's RSI (smoothed moving averages of gains/losses)
  let gainsSum = 0;
  let lossesSum = 0;
  for (let i = 1; i <= period; i++) {
    const change = closes[i] - closes[i - 1];
    if (change >= 0) gainsSum += change;
    else lossesSum += -change;
  }

  let avgGain = gainsSum / period;
  let avgLoss = lossesSum / period;

  if (avgLoss === 0) return 100;
  let rs = avgGain / avgLoss;
  let rsi = 100 - 100 / (1 + rs);

  for (let i = period + 1; i < closes.length; i++) {
    const change = closes[i] - closes[i - 1];
    const gain = change > 0 ? change : 0;
    const loss = change < 0 ? -change : 0;

    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;

    if (avgLoss === 0) {
      rsi = 100;
    } else {
      rs = avgGain / avgLoss;
      rsi = 100 - 100 / (1 + rs);
    }
  }

  return Number.isFinite(rsi) ? rsi : null;
}

function extractClosesFromChart(chart: unknown): number[] | null {
  // yahoo-finance2 chart returns `{ meta, quotes, events }` for daily ranges.
  const maybe = chart as {
    quotes?: Array<{ close?: number | null | undefined }>;
    indicators?: {
      quote?: Array<{ close?: Array<number | null | undefined> }>;
    };
  };

  const quoteCloses =
    maybe.quotes
      ?.map((q) => toFiniteNumber(q.close))
      .filter((v): v is number => v !== null) ?? [];

  if (quoteCloses.length > 0) return quoteCloses;

  // Fallback for indicator-based response shapes.
  const closeSeries = maybe.indicators?.quote?.[0]?.close;
  if (!Array.isArray(closeSeries)) return null;

  const closes = closeSeries
    .map((v) => toFiniteNumber(v))
    .filter((v): v is number => v !== null);

  return closes.length > 0 ? closes : null;
}

export async function fetchYahooPriceAndRsi(
  ticker: string
): Promise<{ market: Market; price_current: number; rsi: number }> {
  const market = inferMarketFromTicker(ticker);

  const quote = (await yf.quote(ticker)) as Record<string, unknown>;
  const price = extractPrice(quote);
  if (price === null) {
    throw new Error(`Unable to extract price for ticker: ${ticker}`);
  }

  const now = Math.floor(Date.now() / 1000);
  const period1 = now - 60 * 60 * 24 * 90; // last ~90 days
  const chart = await yf.chart(ticker, {
    period1,
    period2: now,
    interval: "1d",
  });

  const closes = extractClosesFromChart(chart);
  if (!closes) {
    throw new Error(`Unable to extract close series for ticker: ${ticker}`);
  }

  const rsi = computeRsiFromCloses(closes, 14);
  if (rsi === null) {
    throw new Error(`Unable to compute RSI for ticker: ${ticker}`);
  }

  return { market, price_current: price, rsi };
}

