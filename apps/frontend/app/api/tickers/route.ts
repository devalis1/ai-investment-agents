import { NextResponse } from 'next/server';

import { createServiceRoleClient } from '@/lib/supabase/service-role';
import {
  MAX_DB_CYCLE_TICKERS,
  normalizeTickerList,
  normalizeTickerSymbol,
} from '@/lib/ticker-symbols';

function jsonError(
  status: number,
  code: string,
  message: string,
): NextResponse {
  return NextResponse.json({ error: code, message }, { status });
}

function requireTickersAdmin(req: Request): NextResponse | null {
  const secret = process.env.TICKERS_ADMIN_SECRET?.trim();
  if (!secret) {
    return jsonError(
      503,
      'not_configured',
      'Server is missing TICKERS_ADMIN_SECRET. Set it in the monorepo root `.env.local` and restart `next dev`.',
    );
  }
  const auth = req.headers.get('authorization');
  const token = auth?.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  if (!token || token !== secret) {
    return jsonError(
      401,
      'unauthorized',
      'Invalid or missing admin token. It must match TICKERS_ADMIN_SECRET.',
    );
  }
  return null;
}

type PostBody = {
  ticker?: unknown;
  enabled?: unknown;
  tickers?: unknown;
};

/**
 * POST — upsert one symbol (`ticker`) or many (`tickers`), all US-style normalized.
 * PATCH — `{ ticker, enabled }`.
 * DELETE — `?ticker=SYMBOL`
 *
 * Auth: `Authorization: Bearer <TICKERS_ADMIN_SECRET>` (server env).
 */
export async function POST(req: Request): Promise<Response> {
  const authErr = requireTickersAdmin(req);
  if (authErr) return authErr;

  let body: PostBody;
  try {
    body = (await req.json()) as PostBody;
  } catch {
    return jsonError(400, 'invalid_json', 'Request body must be JSON.');
  }

  let supabase;
  try {
    supabase = createServiceRoleClient();
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Supabase misconfiguration';
    return jsonError(503, 'supabase_config', msg);
  }

  if (Array.isArray(body.tickers)) {
    if (body.tickers.some((t) => typeof t !== 'string')) {
      return jsonError(
        400,
        'invalid_body',
        'tickers must be an array of strings.',
      );
    }
    const list = normalizeTickerList(body.tickers);
    if (list.length === 0) {
      return jsonError(
        400,
        'no_valid_tickers',
        'No valid symbols after normalization.',
      );
    }

    const { data: rows, error: selErr } = await supabase
      .from('tickers')
      .select('ticker');
    if (selErr) {
      return jsonError(500, 'db_error', selErr.message);
    }
    const current = new Set((rows ?? []).map((r) => r.ticker));
    for (const t of list) current.add(t);
    if (current.size > MAX_DB_CYCLE_TICKERS) {
      return jsonError(
        400,
        'limit',
        `At most ${MAX_DB_CYCLE_TICKERS} symbols in the cycle list.`,
      );
    }

    const upserts = list.map((ticker) => ({
      ticker,
      enabled: true,
    }));
    const { error } = await supabase
      .from('tickers')
      .upsert(upserts, { onConflict: 'ticker' });
    if (error) {
      return jsonError(500, 'db_error', error.message);
    }
    return NextResponse.json({ ok: true, upserted: list.length });
  }

  if (typeof body.ticker !== 'string') {
    return jsonError(
      400,
      'invalid_body',
      'Expected { ticker: string } or { tickers: string[] }.',
    );
  }

  const sym = normalizeTickerSymbol(body.ticker);
  if (!sym) {
    return jsonError(400, 'invalid_ticker', 'Invalid symbol after normalization.');
  }

  const enabled =
    typeof body.enabled === 'boolean' ? body.enabled : true;

  const { data: existing, error: oneErr } = await supabase
    .from('tickers')
    .select('ticker')
    .eq('ticker', sym)
    .maybeSingle();
  if (oneErr) {
    return jsonError(500, 'db_error', oneErr.message);
  }

  if (!existing) {
    const { count, error: cErr } = await supabase
      .from('tickers')
      .select('*', { count: 'exact', head: true });
    if (cErr) {
      return jsonError(500, 'db_error', cErr.message);
    }
    if ((count ?? 0) >= MAX_DB_CYCLE_TICKERS) {
      return jsonError(
        400,
        'limit',
        `At most ${MAX_DB_CYCLE_TICKERS} symbols in the cycle list.`,
      );
    }
  }

  const { error } = await supabase
    .from('tickers')
    .upsert(
      { ticker: sym, enabled },
      { onConflict: 'ticker' },
    );
  if (error) {
    return jsonError(500, 'db_error', error.message);
  }
  return NextResponse.json({ ok: true, ticker: sym });
}

type PatchBody = {
  ticker?: unknown;
  enabled?: unknown;
};

export async function PATCH(req: Request): Promise<Response> {
  const authErr = requireTickersAdmin(req);
  if (authErr) return authErr;

  let body: PatchBody;
  try {
    body = (await req.json()) as PatchBody;
  } catch {
    return jsonError(400, 'invalid_json', 'Request body must be JSON.');
  }

  if (typeof body.ticker !== 'string' || typeof body.enabled !== 'boolean') {
    return jsonError(
      400,
      'invalid_body',
      'Expected { ticker: string, enabled: boolean }.',
    );
  }

  const sym = normalizeTickerSymbol(body.ticker);
  if (!sym) {
    return jsonError(400, 'invalid_ticker', 'Invalid symbol after normalization.');
  }

  let supabase;
  try {
    supabase = createServiceRoleClient();
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Supabase misconfiguration';
    return jsonError(503, 'supabase_config', msg);
  }

  const { data, error } = await supabase
    .from('tickers')
    .update({ enabled: body.enabled })
    .eq('ticker', sym)
    .select('ticker')
    .maybeSingle();

  if (error) {
    return jsonError(500, 'db_error', error.message);
  }
  if (!data) {
    return jsonError(404, 'not_found', 'Ticker not found.');
  }
  return NextResponse.json({ ok: true, ticker: sym, enabled: body.enabled });
}

export async function DELETE(req: Request): Promise<Response> {
  const authErr = requireTickersAdmin(req);
  if (authErr) return authErr;

  const url = new URL(req.url);
  const raw = url.searchParams.get('ticker');
  if (!raw) {
    return jsonError(400, 'invalid_query', 'Missing ticker query parameter.');
  }

  const sym = normalizeTickerSymbol(raw);
  if (!sym) {
    return jsonError(400, 'invalid_ticker', 'Invalid symbol after normalization.');
  }

  let supabase;
  try {
    supabase = createServiceRoleClient();
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Supabase misconfiguration';
    return jsonError(503, 'supabase_config', msg);
  }

  const { error } = await supabase.from('tickers').delete().eq('ticker', sym);
  if (error) {
    return jsonError(500, 'db_error', error.message);
  }
  return NextResponse.json({ ok: true, ticker: sym });
}
