/**
 * Client-side watchlist persistence (Phase A: localStorage).
 * Types are stable for a future Phase B Supabase `tickers` table sync.
 */

export const TICKERS_LEGACY_STORAGE_KEY = 'ai-investment-agents:ticker-input';
export const WATCHLIST_STORAGE_KEY = 'ai-investment-agents:watchlist';

export type WatchlistEntry = {
  symbol: string;
  label?: string;
};

function normalizeSymbol(symbol: string): string {
  return symbol.trim().toUpperCase();
}

function isValidSymbol(symbol: string): boolean {
  if (symbol.length < 1 || symbol.length > 16) return false;
  return /^[A-Z0-9][A-Z0-9.\-]{0,15}$/.test(symbol);
}

export function parseWatchlistJson(raw: string): WatchlistEntry[] | null {
  try {
    const data = JSON.parse(raw) as unknown;
    if (!Array.isArray(data)) return null;
    const out: WatchlistEntry[] = [];
    for (const item of data) {
      if (!item || typeof item !== 'object') continue;
      const rec = item as Record<string, unknown>;
      const sym = typeof rec.symbol === 'string' ? normalizeSymbol(rec.symbol) : '';
      if (!isValidSymbol(sym)) continue;
      const label =
        typeof rec.label === 'string' && rec.label.trim().length > 0
          ? rec.label.trim().slice(0, 120)
          : undefined;
      out.push(label ? { symbol: sym, label } : { symbol: sym });
    }
    return dedupeWatchlist(out);
  } catch {
    return null;
  }
}

export function dedupeWatchlist(entries: WatchlistEntry[]): WatchlistEntry[] {
  const seen = new Set<string>();
  const out: WatchlistEntry[] = [];
  for (const e of entries) {
    const s = normalizeSymbol(e.symbol);
    if (!isValidSymbol(s) || seen.has(s)) continue;
    seen.add(s);
    out.push(
      e.label
        ? { symbol: s, label: e.label.trim().slice(0, 120) }
        : { symbol: s },
    );
  }
  return out;
}

export function watchlistToExportJson(entries: WatchlistEntry[]): string {
  return JSON.stringify(entries, null, 2);
}

/** Merge legacy comma-separated tickers into structured list if watchlist empty. */
export function migrateLegacyTickerInput(
  existing: WatchlistEntry[],
  legacyComma: string,
): WatchlistEntry[] {
  if (existing.length > 0 || !legacyComma.trim()) return existing;
  const fromLegacy = legacyComma
    .split(',')
    .map((s) => normalizeSymbol(s))
    .filter(isValidSymbol)
    .map((symbol) => ({ symbol }));
  return dedupeWatchlist(fromLegacy);
}
