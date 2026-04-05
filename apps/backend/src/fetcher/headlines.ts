import { sharedYahooFinance as yf } from "./sharedYahooFinance";

/** Stable id for logs and metrics (not a secret). */
export const HEADLINES_PROVIDER_ID = "yahoo-finance2.search";

const MIN_HEADLINES_TARGET = 3;
const MAX_HEADLINES = 5;
const SEARCH_NEWS_COUNT = 8;
const MAX_ATTEMPTS = 3;
const RETRY_DELAYS_MS = [400, 1_200] as const;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeTitle(raw: string): string {
  return raw.replace(/\s+/g, " ").trim();
}

function headlineLine(title: string, publisher?: string): string {
  const t = normalizeTitle(title);
  if (!t) return "";
  if (publisher && normalizeTitle(publisher)) {
    return `${t} — ${normalizeTitle(publisher)}`;
  }
  return t;
}

/**
 * Prefer items tagged with the symbol; fill from the rest of the feed if needed.
 */
function pickHeadlines(ticker: string, articles: Array<{ title?: string; publisher?: string; relatedTickers?: string[] }>): string[] {
  const sym = ticker.toUpperCase();
  const preferred = articles.filter((a) => {
    const related = a.relatedTickers?.map((s) => s.toUpperCase()) ?? [];
    return related.length === 0 || related.includes(sym);
  });
  const rest = articles.filter((a) => !preferred.includes(a));
  const ordered =
    preferred.length >= MIN_HEADLINES_TARGET ? preferred : [...preferred, ...rest];

  const lines: string[] = [];
  const seen = new Set<string>();
  for (const a of ordered) {
    const line = headlineLine(a.title ?? "", a.publisher);
    if (!line || seen.has(line)) continue;
    seen.add(line);
    lines.push(line);
    if (lines.length >= MAX_HEADLINES) break;
  }
  return lines;
}

export type HeadlinesFetchMeta = {
  providerId: string;
  latencyMs: number;
  attempts: number;
  headlineCount: number;
  ok: boolean;
};

function logHeadlinesEvent(ticker: string, meta: HeadlinesFetchMeta, err?: { name: string }): void {
  const payload: Record<string, string | number | boolean> = {
    ticker,
    providerId: meta.providerId,
    latencyMs: meta.latencyMs,
    attempts: meta.attempts,
    headlineCount: meta.headlineCount,
    ok: meta.ok,
  };
  if (!meta.ok && err) {
    payload.errorName = err.name;
  }
  if (meta.ok) {
    // eslint-disable-next-line no-console
    console.log("[headlines]", payload);
  } else {
    // eslint-disable-next-line no-console
    console.warn("[headlines]", payload);
  }
}

async function fetchHeadlinesOnce(ticker: string): Promise<string[]> {
  const result = await yf.search(ticker, {
    quotesCount: 1,
    newsCount: SEARCH_NEWS_COUNT,
    enableFuzzyQuery: false,
  });

  const news = result.news;
  if (!Array.isArray(news) || news.length === 0) {
    return [];
  }

  return pickHeadlines(ticker, news);
}

/**
 * Fetches 3–5 headline-style lines per ticker via Yahoo Finance search news.
 * On failure after retries, returns an empty array (callers keep Analyst schema unchanged).
 */
export async function fetchHeadlinesForTicker(ticker: string): Promise<{ headlines: string[]; meta: HeadlinesFetchMeta }> {
  const started = performance.now();
  let attempts = 0;
  let lastErr: unknown;

  for (let i = 0; i < MAX_ATTEMPTS; i++) {
    attempts = i + 1;
    try {
      const headlines = await fetchHeadlinesOnce(ticker);
      const latencyMs = Math.round(performance.now() - started);
      const meta: HeadlinesFetchMeta = {
        providerId: HEADLINES_PROVIDER_ID,
        latencyMs,
        attempts,
        headlineCount: headlines.length,
        ok: headlines.length > 0,
      };
      logHeadlinesEvent(ticker, meta);
      return { headlines, meta };
    } catch (err) {
      lastErr = err;
      if (i < RETRY_DELAYS_MS.length) {
        await sleep(RETRY_DELAYS_MS[i]!);
      }
    }
  }

  const latencyMs = Math.round(performance.now() - started);
  const meta: HeadlinesFetchMeta = {
    providerId: HEADLINES_PROVIDER_ID,
    latencyMs,
    attempts,
    headlineCount: 0,
    ok: false,
  };
  const errObj = lastErr instanceof Error ? { name: lastErr.name } : { name: "Error" };
  logHeadlinesEvent(ticker, meta, errObj);
  return { headlines: [], meta };
}
