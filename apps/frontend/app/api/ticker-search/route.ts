import { NextResponse } from 'next/server';

type YahooQuote = {
  symbol?: string;
  shortname?: string;
  longname?: string;
  exchDisp?: string;
};

type YahooSearchResponse = {
  quotes?: YahooQuote[];
};

const MAX_QUERY_LEN = 64;
const MIN_QUERY_LEN = 1;
const QUOTES_COUNT = 15;

function clampQuery(q: string): string | null {
  const t = q.trim();
  if (t.length < MIN_QUERY_LEN || t.length > MAX_QUERY_LEN) return null;
  return t;
}

export async function GET(req: Request): Promise<Response> {
  const { searchParams } = new URL(req.url);
  const rawQ = searchParams.get('q') ?? '';
  const q = clampQuery(rawQ);
  if (!q) {
    return NextResponse.json(
      { error: 'invalid_query', message: 'Provide q between 1 and 64 characters.' },
      { status: 400 },
    );
  }

  const yUrl = new URL('https://query1.finance.yahoo.com/v1/finance/search');
  yUrl.searchParams.set('q', q);
  yUrl.searchParams.set('quotesCount', String(QUOTES_COUNT));
  yUrl.searchParams.set('newsCount', '0');

  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), 12_000);

  try {
    const res = await fetch(yUrl.toString(), {
      headers: {
        Accept: 'application/json',
        // Yahoo sometimes responds poorly without a browser-like UA.
        'User-Agent':
          'Mozilla/5.0 (compatible; AI-Investment-Agents/1.0; +https://example.local)',
      },
      signal: ac.signal,
      next: { revalidate: 0 },
    });

    if (!res.ok) {
      return NextResponse.json(
        {
          error: 'upstream_error',
          message: `Search provider returned ${res.status}.`,
        },
        { status: 502 },
      );
    }

    const body = (await res.json()) as YahooSearchResponse;
    const quotes = Array.isArray(body.quotes) ? body.quotes : [];

    const results = quotes
      .map((row) => {
        const symbol = typeof row.symbol === 'string' ? row.symbol.trim().toUpperCase() : '';
        if (!symbol) return null;
        const name =
          (typeof row.longname === 'string' && row.longname.trim()) ||
          (typeof row.shortname === 'string' && row.shortname.trim()) ||
          undefined;
        const exchange =
          typeof row.exchDisp === 'string' && row.exchDisp.trim()
            ? row.exchDisp.trim()
            : undefined;
        return { symbol, name, exchange };
      })
      .filter(Boolean) as { symbol: string; name?: string; exchange?: string }[];

    return NextResponse.json({ results });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    const aborted = e instanceof Error && e.name === 'AbortError';
    return NextResponse.json(
      {
        error: aborted ? 'timeout' : 'search_failed',
        message: aborted ? 'Search request timed out.' : message,
      },
      { status: aborted ? 504 : 500 },
    );
  } finally {
    clearTimeout(t);
  }
}
