/** Shared server-safe ticker normalization and validation (US-focused symbols). */

const SYMBOL_RE = /^[A-Z0-9][A-Z0-9.\-]{0,15}$/;

export function normalizeTickerList(input: string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of input) {
    const s = String(raw).trim().toUpperCase();
    if (!SYMBOL_RE.test(s) || seen.has(s)) continue;
    seen.add(s);
    out.push(s);
  }
  return out;
}

export const MAX_TRIGGER_TICKERS = 24;
