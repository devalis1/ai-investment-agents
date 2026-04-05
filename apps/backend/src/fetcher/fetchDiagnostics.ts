/**
 * Actionable hints when Yahoo or DNS/IPv6 is flaky (logged when every ticker fetch fails).
 */
export function logYahooNetworkHints(): void {
  // eslint-disable-next-line no-console
  console.error("[fetcher] Yahoo / network troubleshooting:", [
    "IPv4-only fetch: YAHOO_FETCH_IPV4_ONLY=true (default) uses Undici + dns.lookup family 4 — set to false only if you need dual-stack",
    "Optional host: YAHOO_FINANCE_QUERY_HOST=query1.finance.yahoo.com",
    "Per-request timeout: YAHOO_FETCH_TIMEOUT_MS (ms, default 60000, max 120000)",
    "IPv4 preference: repo sets dns.setDefaultResultOrder('ipv4first'); NODE_OPTIONS=--dns-result-order=ipv4first can still help on some runtimes",
    "Offline / CI: FETCH_MARKET_DATA_MODE=dev_stub and a JSON file (see FETCH_DEV_STUB_PATH, data/dev-market-stub.example.json)",
    "Hybrid: FETCH_MARKET_DATA_FALLBACK=dev_stub uses the stub only after Yahoo price/RSI exhausts retries",
  ].join(" · "));
}
