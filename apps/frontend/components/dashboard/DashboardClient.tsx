'use client';

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase/client';

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

const TICKERS_STORAGE_KEY = 'ai-investment-agents:ticker-input';

function formatDateTime(value: string | null | undefined): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString();
}

function normalizeTickers(value: string): string {
  return value
    .split(',')
    .map((t) => t.trim().toUpperCase())
    .filter(Boolean)
    .join(', ');
}

export function DashboardClient() {
  const [tickerInput, setTickerInput] = useState('');
  const [assets, setAssets] = useState<AssetRow[]>([]);
  const [insights, setInsights] = useState<InsightRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(TICKERS_STORAGE_KEY);
      if (saved) setTickerInput(saved);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(TICKERS_STORAGE_KEY, tickerInput);
    } catch {
      // ignore
    }
  }, [tickerInput]);

  useEffect(() => {
    let cancelled = false;

    async function run() {
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

      if (cancelled) return;

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
    }

    run().catch((e: unknown) => {
      if (cancelled) return;
      setError(e instanceof Error ? e.message : 'Unknown error');
      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, []);

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

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-sm text-zinc-600">
          Public read-only dashboard powered by Supabase.
        </p>
      </header>

      <section className="rounded-lg border border-zinc-200 bg-white p-4">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-sm font-medium">Tickers</h2>
            <p className="text-xs text-zinc-600">
              UI-only for now. We just remember your input locally.
            </p>
          </div>
          <div className="w-full md:max-w-xl">
            <input
              value={tickerInput}
              onChange={(e) => setTickerInput(e.target.value)}
              onBlur={() => setTickerInput((v) => normalizeTickers(v))}
              placeholder="e.g. AAPL, MSFT, TSLA"
              className="w-full rounded-md border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-zinc-400"
              inputMode="text"
              autoComplete="off"
              spellCheck={false}
            />
          </div>
        </div>
      </section>

      {loading ? (
        <div className="rounded-lg border border-zinc-200 bg-white p-4 text-sm text-zinc-600">
          Loading assets and insights…
        </div>
      ) : error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          {error}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <section className="rounded-lg border border-zinc-200 bg-white">
            <div className="border-b border-zinc-200 px-4 py-3">
              <h2 className="text-sm font-medium">Assets</h2>
              <p className="text-xs text-zinc-600">
                {assets.length} total
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="border-b border-zinc-200 bg-zinc-50 text-xs text-zinc-600">
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
                        className="px-4 py-6 text-sm text-zinc-600"
                        colSpan={4}
                      >
                        No assets found.
                      </td>
                    </tr>
                  ) : (
                    assets.map((asset) => {
                      const latest = latestInsightByAssetId.get(asset.id) ?? null;
                      return (
                        <tr key={asset.id} className="border-b border-zinc-100">
                          <td className="px-4 py-2 font-medium">
                            {asset.ticker}
                          </td>
                          <td className="px-4 py-2 text-zinc-700">
                            {asset.market}
                          </td>
                          <td className="px-4 py-2 text-zinc-700">
                            {formatDateTime(asset.last_analyzed)}
                          </td>
                          <td className="px-4 py-2 text-zinc-700">
                            {latest?.recommendation ?? '—'}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <section className="rounded-lg border border-zinc-200 bg-white">
            <div className="border-b border-zinc-200 px-4 py-3">
              <h2 className="text-sm font-medium">Latest insights</h2>
              <p className="text-xs text-zinc-600">
                Up to 20 newest (fetched 50)
              </p>
            </div>
            <div className="divide-y divide-zinc-100">
              {latestInsightsJoined.length === 0 ? (
                <div className="px-4 py-6 text-sm text-zinc-600">
                  No insights found.
                </div>
              ) : (
                latestInsightsJoined.map(({ insight, asset }) => (
                  <article key={insight.id} className="px-4 py-4">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <div className="text-sm font-medium">
                        {asset ? (
                          <span>
                            {asset.ticker}{' '}
                            <span className="font-normal text-zinc-500">
                              ({asset.market})
                            </span>
                          </span>
                        ) : (
                          <span className="text-zinc-700">
                            Unknown asset ({insight.asset_id})
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-zinc-500">
                        {formatDateTime(insight.created_at)}
                      </div>
                    </div>

                    <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
                      <span className="rounded-full border border-zinc-200 bg-zinc-50 px-2 py-0.5 text-xs">
                        {insight.recommendation}
                      </span>
                      {insight.current_price != null ? (
                        <span className="text-xs text-zinc-600">
                          Current price: {insight.current_price}
                        </span>
                      ) : null}
                    </div>

                    <p className="mt-2 text-sm text-zinc-700">
                      {insight.reasoning}
                    </p>
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

