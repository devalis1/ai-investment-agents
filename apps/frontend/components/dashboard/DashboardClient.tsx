'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import {
  type WatchlistEntry,
  dedupeWatchlist,
  migrateLegacyTickerInput,
  parseWatchlistJson,
  watchlistToExportJson,
  TICKERS_LEGACY_STORAGE_KEY,
  WATCHLIST_STORAGE_KEY,
} from '@/lib/watchlist';
import { DashboardLoadingSkeleton } from '@/components/dashboard/DashboardLoadingSkeleton';
import { RecommendationBadge } from '@/components/dashboard/RecommendationBadge';
import { MAX_DB_CYCLE_TICKERS } from '@/lib/ticker-symbols';
import {
  clearTickersAdminToken,
  getTickersAdminToken,
  setTickersAdminToken,
} from '@/lib/tickers-admin-token';

type AssetRow = {
  id: string;
  ticker: string;
  market: 'US' | 'AR' | string;
  last_analyzed: string | null;
};

type InsightRow = {
  id: string;
  asset_id: string;
  created_at: string;
  recommendation: string;
  reasoning: string;
  current_price: number | null;
};

type SearchHit = { symbol: string; name?: string; exchange?: string };

type CycleTickerRow = {
  ticker: string;
  enabled: boolean;
  created_at: string;
};

const REASON_PREVIEW_LEN = 220;
const SEARCH_DEBOUNCE_MS = 320;

/** Debounced string for search; clears immediately when empty so stale queries do not refetch after reset. */
function useDebouncedSearchQuery(value: string, ms: number): string {
  const [d, setD] = useState(value);
  useEffect(() => {
    if (value.trim() === '') {
      setD('');
      return;
    }
    const t = setTimeout(() => setD(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return d;
}

function formatDateTime(value: string | null | undefined): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  // Fixed locale + UTC so SSR (Node) and the browser produce the same string (avoids hydration mismatches).
  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'UTC',
  }).format(d);
}

function ReasoningBlock({
  id,
  text,
  expanded,
  onToggle,
}: {
  id: string;
  text: string;
  expanded: boolean;
  onToggle: (id: string) => void;
}) {
  const long = text.length > REASON_PREVIEW_LEN;
  const shown = expanded || !long ? text : `${text.slice(0, REASON_PREVIEW_LEN)}…`;

  return (
    <div className="mt-2 text-sm text-muted-foreground">
      <p className="whitespace-pre-wrap">{shown}</p>
      {long ? (
        <button
          type="button"
          onClick={() => onToggle(id)}
          className="mt-1 min-h-11 text-left text-xs font-medium text-accent hover:underline"
        >
          {expanded ? 'Show less' : 'Show more'}
        </button>
      ) : null}
    </div>
  );
}

export function DashboardClient() {
  const [watchlist, setWatchlist] = useState<WatchlistEntry[]>([]);
  const [hydrated, setHydrated] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearch = useDebouncedSearchQuery(searchQuery, SEARCH_DEBOUNCE_MS);
  const [searchResults, setSearchResults] = useState<SearchHit[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searchDropdownOpen, setSearchDropdownOpen] = useState(false);
  const tickerSearchContainerRef = useRef<HTMLDivElement | null>(null);

  const [pendingEntries, setPendingEntries] = useState<WatchlistEntry[]>([]);

  const [assets, setAssets] = useState<AssetRow[]>([]);
  const [insights, setInsights] = useState<InsightRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [insightFilter, setInsightFilter] = useState<'all' | 'watchlist'>('all');
  const [expandedReason, setExpandedReason] = useState<Record<string, boolean>>({});

  const [cycleBusy, setCycleBusy] = useState(false);
  const [cycleMessage, setCycleMessage] = useState<string | null>(null);
  const [cycleTone, setCycleTone] = useState<'success' | 'error' | 'info'>('info');

  const [cycleTickers, setCycleTickers] = useState<CycleTickerRow[]>([]);
  const [cycleTickersLoading, setCycleTickersLoading] = useState(true);
  const [cycleTickersError, setCycleTickersError] = useState<string | null>(null);
  const [adminTokenDraft, setAdminTokenDraft] = useState('');
  const [hasAdminToken, setHasAdminToken] = useState(false);
  const [cycleListBusy, setCycleListBusy] = useState(false);

  const watchSet = useMemo(
    () => new Set(watchlist.map((w) => w.symbol)),
    [watchlist],
  );

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setError(null);

    const [assetsRes, insightsRes] = await Promise.all([
      supabase
        .from('assets')
        .select('id,ticker,market,last_analyzed')
        .order('ticker', { ascending: true }),
      supabase
        .from('ai_insights')
        .select('id,asset_id,created_at,recommendation,reasoning,current_price')
        .order('created_at', { ascending: false })
        .limit(50),
    ]);

    if (assetsRes.error) {
      setError(`Failed to load assets: ${assetsRes.error.message}`);
      setLoading(false);
      return;
    }

    if (insightsRes.error) {
      setError(`Failed to load insights: ${insightsRes.error.message}`);
      setLoading(false);
      return;
    }

    setAssets((assetsRes.data ?? []) as AssetRow[]);
    setInsights((insightsRes.data ?? []) as InsightRow[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadDashboard().catch((e: unknown) => {
      setError(e instanceof Error ? e.message : 'Unknown error');
      setLoading(false);
    });
  }, [loadDashboard]);

  const loadCycleTickers = useCallback(async () => {
    setCycleTickersLoading(true);
    setCycleTickersError(null);
    const { data, error: qErr } = await supabase
      .from('tickers')
      .select('ticker,enabled,created_at')
      .order('ticker', { ascending: true });
    if (qErr) {
      setCycleTickers([]);
      setCycleTickersError(qErr.message);
      setCycleTickersLoading(false);
      return;
    }
    setCycleTickers((data ?? []) as CycleTickerRow[]);
    setCycleTickersLoading(false);
  }, []);

  useEffect(() => {
    setHasAdminToken(!!getTickersAdminToken());
    loadCycleTickers().catch(() => {
      setCycleTickersError('Failed to load cycle tickers.');
      setCycleTickersLoading(false);
    });
  }, [loadCycleTickers]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(WATCHLIST_STORAGE_KEY);
      let entries: WatchlistEntry[] = [];
      if (raw) {
        const parsed = parseWatchlistJson(raw);
        entries = parsed ?? [];
      }
      const legacy = localStorage.getItem(TICKERS_LEGACY_STORAGE_KEY) ?? '';
      entries = migrateLegacyTickerInput(entries, legacy);
      setWatchlist(entries);
    } catch {
      // ignore
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      const next = dedupeWatchlist(watchlist);
      localStorage.setItem(WATCHLIST_STORAGE_KEY, JSON.stringify(next));
      localStorage.setItem(
        TICKERS_LEGACY_STORAGE_KEY,
        next.map((e) => e.symbol).join(', '),
      );
    } catch {
      // ignore
    }
  }, [watchlist, hydrated]);

  useEffect(() => {
    const q = debouncedSearch.trim();
    if (q.length < 1) {
      setSearchResults([]);
      setSearchError(null);
      setSearchLoading(false);
      return;
    }

    const ac = new AbortController();
    setSearchLoading(true);
    setSearchError(null);

    void (async () => {
      try {
        const res = await fetch(
          `/api/ticker-search?q=${encodeURIComponent(q)}`,
          { signal: ac.signal },
        );
        const data = (await res.json()) as {
          results?: SearchHit[];
          message?: string;
        };
        if (!res.ok) {
          throw new Error(data.message ?? `Search failed (${res.status})`);
        }
        setSearchResults(data.results ?? []);
        setSearchError(null);
      } catch (e: unknown) {
        if (e instanceof DOMException && e.name === 'AbortError') return;
        if (e instanceof Error && e.name === 'AbortError') return;
        setSearchResults([]);
        setSearchError(e instanceof Error ? e.message : 'Search failed');
      } finally {
        if (!ac.signal.aborted) {
          setSearchLoading(false);
        }
      }
    })();

    return () => {
      ac.abort();
    };
  }, [debouncedSearch]);

  useEffect(() => {
    if (!searchDropdownOpen) return;
    function onDocPointerDown(e: PointerEvent): void {
      const el = tickerSearchContainerRef.current;
      const target = e.target;
      if (!el || !(target instanceof Node) || el.contains(target)) return;
      setSearchDropdownOpen(false);
    }
    document.addEventListener('pointerdown', onDocPointerDown);
    return () => document.removeEventListener('pointerdown', onDocPointerDown);
  }, [searchDropdownOpen]);

  const latestInsightByAssetId = useMemo(() => {
    const map = new Map<string, InsightRow>();
    for (const insight of insights) {
      if (!map.has(insight.asset_id)) map.set(insight.asset_id, insight);
    }
    return map;
  }, [insights]);

  const latestInsightsJoined = useMemo(() => {
    const byId = new Map(assets.map((a) => [a.id, a]));
    return insights
      .map((i) => ({ insight: i, asset: byId.get(i.asset_id) ?? null }))
      .slice(0, 20);
  }, [assets, insights]);

  const filteredInsights = useMemo(() => {
    if (insightFilter === 'all') return latestInsightsJoined;
    return latestInsightsJoined.filter(
      ({ asset }) => asset && watchSet.has(asset.ticker),
    );
  }, [latestInsightsJoined, insightFilter, watchSet]);

  const pendingSymbols = useMemo(
    () => pendingEntries.map((e) => e.symbol),
    [pendingEntries],
  );

  function toggleReason(id: string): void {
    setExpandedReason((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  function addPendingFromHit(hit: SearchHit): void {
    const s = hit.symbol.trim().toUpperCase();
    if (!s) return;
    const label =
      hit.name && hit.name.trim().length > 0
        ? hit.name.trim().slice(0, 120)
        : undefined;
    const entry: WatchlistEntry = label ? { symbol: s, label } : { symbol: s };
    setPendingEntries((prev) => {
      if (prev.some((e) => e.symbol === s)) return prev;
      return [...prev, entry];
    });
    setSearchQuery('');
    setSearchResults([]);
    setSearchError(null);
    setSearchLoading(false);
    setSearchDropdownOpen(false);
  }

  function removePendingSymbol(symbol: string): void {
    setPendingEntries((prev) => prev.filter((x) => x.symbol !== symbol));
  }

  function addPendingToWatchlist(): void {
    const next = dedupeWatchlist([...watchlist, ...pendingEntries]);
    setWatchlist(next);
    setPendingEntries([]);
  }

  function removeWatchEntry(symbol: string): void {
    setWatchlist((w) => w.filter((e) => e.symbol !== symbol));
  }

  function clearWatchlist(): void {
    setWatchlist([]);
  }

  async function tickersApi(
    method: 'POST' | 'PATCH' | 'DELETE',
    opts: { body?: Record<string, unknown>; tickerQuery?: string },
  ): Promise<{ ok: boolean; message: string }> {
    const token = getTickersAdminToken();
    if (!token) {
      return {
        ok: false,
        message:
          'Save the admin token below (same value as server TICKERS_ADMIN_SECRET).',
      };
    }
    let url = '/api/tickers';
    if (method === 'DELETE' && opts.tickerQuery) {
      url += `?ticker=${encodeURIComponent(opts.tickerQuery)}`;
    }
    const headers: Record<string, string> = {
      Authorization: `Bearer ${token}`,
    };
    if (opts.body) headers['Content-Type'] = 'application/json';
    const res = await fetch(url, {
      method,
      headers,
      body: opts.body ? JSON.stringify(opts.body) : undefined,
    });
    const data = (await res.json()) as { message?: string };
    if (!res.ok) {
      return {
        ok: false,
        message: data.message ?? `Request failed (${res.status})`,
      };
    }
    return { ok: true, message: 'OK' };
  }

  function saveAdminToken(): void {
    const t = adminTokenDraft.trim();
    if (!t) return;
    setTickersAdminToken(t);
    setHasAdminToken(true);
    setAdminTokenDraft('');
    setCycleTone('success');
    setCycleMessage('Admin token saved for this browser session.');
  }

  function forgetAdminToken(): void {
    clearTickersAdminToken();
    setHasAdminToken(false);
    setCycleTone('info');
    setCycleMessage('Admin token removed from this browser session.');
  }

  async function addPendingToCycleDb(): Promise<void> {
    if (pendingEntries.length === 0) return;
    setCycleListBusy(true);
    setCycleMessage(null);
    const r = await tickersApi('POST', {
      body: { tickers: pendingEntries.map((e) => e.symbol) },
    });
    if (!r.ok) {
      setCycleTone('error');
      setCycleMessage(r.message);
      setCycleListBusy(false);
      return;
    }
    await loadCycleTickers();
    setPendingEntries([]);
    setCycleTone('success');
    setCycleMessage('Symbols added to Supabase cycle list.');
    setCycleListBusy(false);
  }

  async function syncWatchlistToCycleDb(): Promise<void> {
    if (watchlist.length === 0) return;
    setCycleListBusy(true);
    setCycleMessage(null);
    const r = await tickersApi('POST', {
      body: { tickers: watchlist.map((e) => e.symbol) },
    });
    if (!r.ok) {
      setCycleTone('error');
      setCycleMessage(r.message);
      setCycleListBusy(false);
      return;
    }
    await loadCycleTickers();
    setCycleTone('success');
    setCycleMessage('Watchlist merged into Supabase cycle list.');
    setCycleListBusy(false);
  }

  async function setCycleTickerEnabled(
    ticker: string,
    enabled: boolean,
  ): Promise<void> {
    setCycleListBusy(true);
    const r = await tickersApi('PATCH', { body: { ticker, enabled } });
    if (!r.ok) {
      setCycleTone('error');
      setCycleMessage(r.message);
      setCycleListBusy(false);
      return;
    }
    await loadCycleTickers();
    setCycleListBusy(false);
  }

  async function removeCycleTickerRow(ticker: string): Promise<void> {
    setCycleListBusy(true);
    const r = await tickersApi('DELETE', { tickerQuery: ticker });
    if (!r.ok) {
      setCycleTone('error');
      setCycleMessage(r.message);
      setCycleListBusy(false);
      return;
    }
    await loadCycleTickers();
    setCycleListBusy(false);
  }

  async function runCycleFor(symbols: string[]): Promise<void> {
    if (symbols.length === 0) {
      setCycleTone('error');
      setCycleMessage('Select at least one ticker or save a watchlist.');
      return;
    }

    setCycleBusy(true);
    setCycleMessage(null);

    try {
      const res = await fetch('/api/trigger-cycle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tickers: symbols }),
      });

      const data = (await res.json()) as {
        ok?: boolean;
        error?: string;
        message?: string;
      };

      if (res.status === 501) {
        setCycleTone('info');
        setCycleMessage(
          data.message ??
            'Analysis trigger is not configured on the server. Run the backend cycle locally or set CYCLE_TRIGGER_URL / CYCLE_TRIGGER_SECRET for a future HTTP worker.',
        );
        return;
      }

      if (!res.ok) {
        setCycleTone('error');
        setCycleMessage(
          data.message ?? `Request failed (${res.status})`,
        );
        return;
      }

      setCycleTone('success');
      setCycleMessage('Analysis job accepted. Refreshing dashboard data…');
      await loadDashboard();
      await loadCycleTickers();
      setCycleMessage('Dashboard updated from Supabase.');
    } catch (e: unknown) {
      setCycleTone('error');
      setCycleMessage(e instanceof Error ? e.message : 'Request failed');
    } finally {
      setCycleBusy(false);
    }
  }

  function exportWatchlist(): void {
    const blob = new Blob([watchlistToExportJson(watchlist)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'watchlist.json';
    a.click();
    URL.revokeObjectURL(url);
  }

  function onImportFile(file: File | null): void {
    if (!file) return;
    file
      .text()
      .then((text) => {
        const parsed = parseWatchlistJson(text);
        if (!parsed) {
          setCycleTone('error');
          setCycleMessage('Invalid watchlist JSON.');
          return;
        }
        setWatchlist(dedupeWatchlist(parsed));
        setCycleTone('success');
        setCycleMessage('Watchlist imported.');
      })
      .catch(() => {
        setCycleTone('error');
        setCycleMessage('Could not read file.');
      });
  }

  const cycleBannerClass =
    cycleTone === 'success'
      ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-950 dark:text-emerald-100'
      : cycleTone === 'error'
        ? 'border-rose-500/40 bg-rose-500/10 text-rose-950 dark:text-rose-100'
        : 'border-border bg-muted text-foreground';

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Dashboard
        </h1>
        <p className="text-sm text-muted-foreground">
          Supabase-backed dashboard: search tickers, a local watchlist, editable
          cycle symbols in the database, and on-demand analysis when a trigger is
          configured.
        </p>
      </header>

      {cycleMessage ? (
        <div
          role="status"
          className={`rounded-xl border px-4 py-3 text-sm ${cycleBannerClass}`}
        >
          {cycleMessage}
        </div>
      ) : null}

      <section className="rounded-xl border border-border bg-card p-4 shadow-sm">
        <div className="space-y-4">
          <div>
            <h2 className="text-sm font-medium text-card-foreground">
              Find tickers
            </h2>
            <p className="text-xs text-muted-foreground">
              Search by symbol or company name (Yahoo Finance search via server).
            </p>
          </div>

          <div ref={tickerSearchContainerRef} className="relative z-10">
            <label htmlFor="ticker-search" className="sr-only">
              Search tickers
            </label>
            <input
              id="ticker-search"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setSearchDropdownOpen(true);
              }}
              onFocus={() => setSearchDropdownOpen(true)}
              placeholder="e.g. Apple or NVDA"
              className="w-full min-h-11 rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring"
              inputMode="search"
              autoComplete="off"
              spellCheck={false}
            />
            {searchLoading ? (
              <p className="mt-2 text-xs text-muted-foreground">Searching…</p>
            ) : null}
            {searchError ? (
              <p className="mt-2 text-xs text-rose-600 dark:text-rose-400">
                {searchError}
              </p>
            ) : null}
            {searchDropdownOpen && searchResults.length > 0 ? (
              <ul
                className="absolute z-20 mt-1 max-h-56 w-full overflow-auto rounded-lg border border-border bg-card py-1 shadow-lg"
                role="listbox"
              >
                {searchResults.map((hit) => (
                  <li key={hit.symbol} className="px-1">
                    <button
                      type="button"
                      onClick={() => addPendingFromHit(hit)}
                      className="flex w-full min-h-11 flex-col items-start gap-0.5 rounded-md px-3 py-2 text-left text-sm hover:bg-muted"
                    >
                      <span className="font-medium text-card-foreground">
                        {hit.symbol}
                      </span>
                      {(hit.name ?? hit.exchange) ? (
                        <span className="text-xs text-muted-foreground">
                          {hit.name ?? ''}
                          {hit.exchange ? ` · ${hit.exchange}` : ''}
                        </span>
                      ) : null}
                    </button>
                  </li>
                ))}
              </ul>
            ) : searchDropdownOpen &&
              debouncedSearch.trim().length > 0 &&
              !searchLoading &&
              !searchError ? (
              <p className="mt-2 text-xs text-muted-foreground">No matches.</p>
            ) : null}
          </div>

          {pendingEntries.length > 0 ? (
            <div>
              <p className="mb-2 text-xs font-medium text-muted-foreground">
                Selected
              </p>
              <div className="flex flex-wrap gap-2">
                {pendingEntries.map((e) => (
                  <span
                    key={e.symbol}
                    className="inline-flex max-w-full items-center gap-1 rounded-full border border-border bg-muted px-2.5 py-1 text-xs font-medium"
                  >
                    <span className="truncate">
                      {e.symbol}
                      {e.label ? (
                        <span className="ml-1 font-normal text-muted-foreground">
                          ({e.label})
                        </span>
                      ) : null}
                    </span>
                    <button
                      type="button"
                      onClick={() => removePendingSymbol(e.symbol)}
                      className="min-h-8 min-w-8 shrink-0 rounded-full text-muted-foreground hover:bg-background hover:text-foreground"
                      aria-label={`Remove ${e.symbol}`}
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={addPendingToWatchlist}
                  className="min-h-11 rounded-lg border border-border bg-background px-4 text-sm font-medium hover:bg-muted"
                >
                  Save selection to watchlist
                </button>
                <button
                  type="button"
                  onClick={() => setPendingEntries([])}
                  className="min-h-11 rounded-lg px-4 text-sm text-muted-foreground hover:text-foreground"
                >
                  Clear selection
                </button>
                <button
                  type="button"
                  disabled={cycleListBusy || pendingEntries.length === 0}
                  onClick={() => addPendingToCycleDb()}
                  className="min-h-11 rounded-lg border border-border bg-background px-4 text-sm font-medium hover:bg-muted disabled:opacity-50"
                >
                  Add selection to cycle list (DB)
                </button>
                <button
                  type="button"
                  disabled={cycleBusy}
                  onClick={() => runCycleFor(pendingSymbols)}
                  className="min-h-11 rounded-lg bg-accent px-4 text-sm font-medium text-accent-foreground shadow hover:opacity-90 disabled:opacity-50"
                >
                  Analyze selected
                </button>
              </div>
            </div>
          ) : null}

          <div className="border-t border-border pt-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-sm font-medium text-card-foreground">
                  Watchlist
                </h2>
                <p className="text-xs text-muted-foreground">
                  Stored in this browser (localStorage). Export or import JSON.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <label className="inline-flex min-h-11 cursor-pointer items-center rounded-lg border border-border bg-background px-4 text-sm font-medium hover:bg-muted">
                  Import JSON
                  <input
                    type="file"
                    accept="application/json"
                    className="hidden"
                    onChange={(e) => onImportFile(e.target.files?.[0] ?? null)}
                  />
                </label>
                <button
                  type="button"
                  onClick={exportWatchlist}
                  className="min-h-11 rounded-lg border border-border bg-background px-4 text-sm font-medium hover:bg-muted"
                >
                  Export JSON
                </button>
                <button
                  type="button"
                  onClick={clearWatchlist}
                  className="min-h-11 rounded-lg px-4 text-sm text-muted-foreground hover:text-foreground"
                >
                  Clear watchlist
                </button>
              </div>
            </div>

            {watchlist.length === 0 ? (
              <p className="mt-3 text-sm text-muted-foreground">
                No saved tickers yet.
              </p>
            ) : (
              <ul className="mt-3 divide-y divide-border rounded-lg border border-border">
                {watchlist.map((e) => (
                  <li
                    key={e.symbol}
                    className="flex min-h-12 flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm"
                  >
                    <div>
                      <span className="font-medium text-card-foreground">
                        {e.symbol}
                      </span>
                      {e.label ? (
                        <span className="ml-2 text-muted-foreground">
                          {e.label}
                        </span>
                      ) : null}
                    </div>
                    <button
                      type="button"
                      onClick={() => removeWatchEntry(e.symbol)}
                      className="min-h-11 min-w-11 rounded-lg text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
                      aria-label={`Remove ${e.symbol} from watchlist`}
                    >
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
            )}

            <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
              <button
                type="button"
                disabled={cycleListBusy || watchlist.length === 0}
                onClick={() => syncWatchlistToCycleDb()}
                className="min-h-11 w-full rounded-lg border border-border bg-background px-4 text-sm font-medium hover:bg-muted disabled:opacity-50 sm:w-auto"
              >
                Sync watchlist → cycle list (DB)
              </button>
              <button
                type="button"
                disabled={cycleBusy || watchlist.length === 0}
                onClick={() => runCycleFor(watchlist.map((w) => w.symbol))}
                className="min-h-11 w-full rounded-lg bg-accent px-4 text-sm font-semibold text-accent-foreground shadow hover:opacity-90 disabled:opacity-50 sm:w-auto"
              >
                Analyze saved watchlist
              </button>
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-border bg-card p-4 shadow-sm">
        <div className="space-y-4">
          <div>
            <h2 className="text-sm font-medium text-card-foreground">
              Cycle symbols (Supabase)
            </h2>
            <p className="text-xs text-muted-foreground">
              Scheduled / CLI jobs use this list when at least one row is enabled
              (see backend <code className="rounded bg-muted px-1">resolveCycleTickers</code>
              ). Otherwise they fall back to the <code className="rounded bg-muted px-1">TICKERS</code>{' '}
              env var. Max {MAX_DB_CYCLE_TICKERS} symbols.
            </p>
          </div>

          <div className="rounded-lg border border-border bg-muted/30 p-3 text-xs text-muted-foreground">
            <p className="font-medium text-card-foreground">DB edits</p>
            <p className="mt-1">
              Paste the same secret you set as{' '}
              <code className="rounded bg-muted px-1">TICKERS_ADMIN_SECRET</code> on the
              Next.js server. Stored in{' '}
              <code className="rounded bg-muted px-1">sessionStorage</code> for this tab
              only.
            </p>
            <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center">
              <input
                type="password"
                value={adminTokenDraft}
                onChange={(e) => setAdminTokenDraft(e.target.value)}
                placeholder={hasAdminToken ? 'Replace token…' : 'Admin token'}
                autoComplete="off"
                className="min-h-11 w-full flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring"
              />
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => saveAdminToken()}
                  className="min-h-11 rounded-lg bg-accent px-4 text-sm font-medium text-accent-foreground hover:opacity-90"
                >
                  Save token
                </button>
                <button
                  type="button"
                  onClick={() => forgetAdminToken()}
                  className="min-h-11 rounded-lg border border-border bg-background px-4 text-sm hover:bg-muted"
                >
                  Forget token
                </button>
              </div>
            </div>
            {hasAdminToken ? (
              <p className="mt-2 text-emerald-700 dark:text-emerald-400">
                Token is set for this session.
              </p>
            ) : null}
          </div>

          {cycleTickersError ? (
            <p className="text-sm text-rose-600 dark:text-rose-400">
              Could not load <code className="rounded bg-muted px-1">tickers</code>:{' '}
              {cycleTickersError}
            </p>
          ) : null}

          {cycleTickersLoading ? (
            <p className="text-sm text-muted-foreground">Loading cycle list…</p>
          ) : cycleTickers.length === 0 && !cycleTickersError ? (
            <p className="text-sm text-muted-foreground">
              No rows in <code className="rounded bg-muted px-1">public.tickers</code>.
              Add symbols from search or sync the watchlist — the scheduler will use{' '}
              <code className="rounded bg-muted px-1">TICKERS</code> env until you do.
            </p>
          ) : (
            <ul className="divide-y divide-border rounded-lg border border-border">
              {cycleTickers.map((row) => (
                <li
                  key={row.ticker}
                  className="flex min-h-12 flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm"
                >
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="font-medium text-card-foreground">
                      {row.ticker}
                    </span>
                    <label className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
                      <input
                        type="checkbox"
                        checked={row.enabled}
                        disabled={cycleListBusy}
                        onChange={(e) =>
                          setCycleTickerEnabled(row.ticker, e.target.checked)
                        }
                        className="h-4 w-4 rounded border-border"
                      />
                      Enabled for scheduled cycle
                    </label>
                  </div>
                  <button
                    type="button"
                    disabled={cycleListBusy}
                    onClick={() => removeCycleTickerRow(row.ticker)}
                    className="min-h-11 rounded-lg text-sm text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50"
                  >
                    Remove from DB
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {loading ? (
        <DashboardLoadingSkeleton />
      ) : error ? (
        <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-950 dark:text-rose-100">
          {error}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <section className="rounded-xl border border-border bg-card shadow-sm">
            <div className="border-b border-border px-4 py-3">
              <h2 className="text-sm font-medium text-card-foreground">Assets</h2>
              <p className="text-xs text-muted-foreground">{assets.length} total</p>
            </div>

            <div className="md:hidden divide-y divide-border">
              {assets.length === 0 ? (
                <div className="px-4 py-6 text-sm text-muted-foreground">
                  No assets found.
                </div>
              ) : (
                assets.map((asset) => {
                  const latest = latestInsightByAssetId.get(asset.id) ?? null;
                  return (
                    <div key={asset.id} className="space-y-2 px-4 py-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-sm font-semibold text-card-foreground">
                          {asset.ticker}
                        </span>
                        {latest ? (
                          <RecommendationBadge value={latest.recommendation} />
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Market: {asset.market}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Last analyzed: {formatDateTime(asset.last_analyzed)}
                      </p>
                    </div>
                  );
                })
              )}
            </div>

            <div className="hidden overflow-x-auto md:block">
              <table className="min-w-[640px] w-full text-left text-sm">
                <thead className="border-b border-border bg-muted/50 text-xs text-muted-foreground">
                  <tr>
                    <th className="px-4 py-2 font-medium">Ticker</th>
                    <th className="px-4 py-2 font-medium">Market</th>
                    <th className="px-4 py-2 font-medium">Last analyzed</th>
                    <th className="px-4 py-2 font-medium">Latest rec</th>
                  </tr>
                </thead>
                <tbody>
                  {assets.length === 0 ? (
                    <tr>
                      <td
                        className="px-4 py-6 text-sm text-muted-foreground"
                        colSpan={4}
                      >
                        No assets found.
                      </td>
                    </tr>
                  ) : (
                    assets.map((asset) => {
                      const latest = latestInsightByAssetId.get(asset.id) ?? null;
                      return (
                        <tr key={asset.id} className="border-b border-border">
                          <td className="px-4 py-2 font-medium text-card-foreground">
                            {asset.ticker}
                          </td>
                          <td className="px-4 py-2 text-muted-foreground">
                            {asset.market}
                          </td>
                          <td className="px-4 py-2 text-muted-foreground">
                            {formatDateTime(asset.last_analyzed)}
                          </td>
                          <td className="px-4 py-2 text-muted-foreground">
                            {latest ? (
                              <RecommendationBadge value={latest.recommendation} />
                            ) : (
                              '—'
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <section className="rounded-xl border border-border bg-card shadow-sm">
            <div className="flex flex-col gap-3 border-b border-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-sm font-medium text-card-foreground">
                  Latest insights
                </h2>
                <p className="text-xs text-muted-foreground">
                  Up to 20 newest (fetched 50)
                </p>
              </div>
              <label className="flex items-center gap-2 text-xs text-muted-foreground">
                <span className="hidden sm:inline">Show</span>
                <select
                  value={insightFilter}
                  onChange={(e) =>
                    setInsightFilter(e.target.value as 'all' | 'watchlist')
                  }
                  className="min-h-11 rounded-lg border border-border bg-background px-2 py-1 text-sm text-foreground"
                >
                  <option value="all">All tickers</option>
                  <option value="watchlist">Watchlist only</option>
                </select>
              </label>
            </div>
            <div className="divide-y divide-border">
              {filteredInsights.length === 0 ? (
                <div className="px-4 py-6 text-sm text-muted-foreground">
                  No insights for this filter.
                </div>
              ) : (
                filteredInsights.map(({ insight, asset }) => (
                  <article key={insight.id} className="px-4 py-4">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <div className="text-sm font-medium text-card-foreground">
                        {asset ? (
                          <span>
                            {asset.ticker}{' '}
                            <span className="font-normal text-muted-foreground">
                              ({asset.market})
                            </span>
                          </span>
                        ) : (
                          <span className="text-muted-foreground">
                            Unknown asset ({insight.asset_id})
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {formatDateTime(insight.created_at)}
                      </div>
                    </div>

                    <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
                      <RecommendationBadge value={insight.recommendation} />
                      {insight.current_price != null ? (
                        <span className="text-xs text-muted-foreground">
                          Price: {insight.current_price}
                        </span>
                      ) : null}
                    </div>

                    <ReasoningBlock
                      id={insight.id}
                      text={insight.reasoning}
                      expanded={!!expandedReason[insight.id]}
                      onToggle={toggleReason}
                    />
                  </article>
                ))
              )}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
