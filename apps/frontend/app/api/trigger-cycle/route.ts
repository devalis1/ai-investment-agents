import { NextResponse } from 'next/server';
import { MAX_TRIGGER_TICKERS, normalizeTickerList } from '@/lib/ticker-symbols';

/** Align with `CYCLE_TRIGGER_PROXY_TIMEOUT_MS` default so Pro-tier Fluid workers can finish before the proxy aborts. */
export const maxDuration = 240;

type TriggerBody = {
  tickers?: unknown;
};

/**
 * Proxies a cycle run to a secure backend HTTP endpoint when configured.
 * Never expose Supabase service role keys to the browser — the worker must hold them.
 *
 * Env (server-only):
 * - CYCLE_TRIGGER_URL — POST target (the backend HTTP worker; see apps/backend `cycle:trigger-server`).
 * - CYCLE_TRIGGER_SECRET — shared secret; sent as Authorization: Bearer <secret>.
 * - CYCLE_TRIGGER_PROXY_TIMEOUT_MS — optional; max wait for the upstream worker (default 240000). Match to your Vercel plan / worker hosting limits.
 */
export async function POST(req: Request): Promise<Response> {
  let body: TriggerBody;
  try {
    body = (await req.json()) as TriggerBody;
  } catch {
    return NextResponse.json(
      { error: 'invalid_json', message: 'Request body must be JSON.' },
      { status: 400 },
    );
  }

  const rawList = body.tickers;
  if (!Array.isArray(rawList) || rawList.some((t) => typeof t !== 'string')) {
    return NextResponse.json(
      { error: 'invalid_body', message: 'Expected { tickers: string[] }.' },
      { status: 400 },
    );
  }

  const tickers = normalizeTickerList(rawList);
  if (tickers.length === 0) {
    return NextResponse.json(
      { error: 'no_valid_tickers', message: 'No valid US-style symbols after normalization.' },
      { status: 400 },
    );
  }

  if (tickers.length > MAX_TRIGGER_TICKERS) {
    return NextResponse.json(
      {
        error: 'too_many_tickers',
        message: `Maximum ${MAX_TRIGGER_TICKERS} tickers per request.`,
      },
      { status: 400 },
    );
  }

  const url = process.env.CYCLE_TRIGGER_URL?.trim();
  const secret = process.env.CYCLE_TRIGGER_SECRET?.trim();

  if (!url || !secret) {
    return NextResponse.json(
      {
        error: 'cycle_trigger_not_configured',
        message:
          'Remote cycle trigger is not configured. Set CYCLE_TRIGGER_URL and CYCLE_TRIGGER_SECRET on the server, or run the backend cycle locally / via GitHub Actions (see docs).',
        tickers,
      },
      { status: 501 },
    );
  }

  const proxyTimeoutMs = Number(
    process.env.CYCLE_TRIGGER_PROXY_TIMEOUT_MS ?? 240_000,
  );
  const safeProxyMs =
    Number.isFinite(proxyTimeoutMs) && proxyTimeoutMs > 0
      ? proxyTimeoutMs
      : 240_000;

  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), safeProxyMs);

  try {
    const upstream = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${secret}`,
      },
      body: JSON.stringify({ tickers }),
      signal: ac.signal,
    });

    const text = await upstream.text();
    if (!upstream.ok) {
      return NextResponse.json(
        {
          error: 'upstream_failed',
          message: `Trigger endpoint returned ${upstream.status}.`,
          detail: text.slice(0, 500),
        },
        { status: 502 },
      );
    }

    let parsed: unknown = { raw: text };
    try {
      parsed = text ? JSON.parse(text) : {};
    } catch {
      /* keep as raw */
    }

    return NextResponse.json({ ok: true, tickers, upstream: parsed });
  } catch (e: unknown) {
    const aborted = e instanceof Error && e.name === 'AbortError';
    return NextResponse.json(
      {
        error: aborted ? 'upstream_timeout' : 'trigger_failed',
        message:
          e instanceof Error ? e.message : 'Failed to reach cycle trigger endpoint.',
      },
      { status: aborted ? 504 : 502 },
    );
  } finally {
    clearTimeout(timer);
  }
}
