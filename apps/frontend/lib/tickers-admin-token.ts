/** sessionStorage key for Bearer token matching server `TICKERS_ADMIN_SECRET`. */

export const TICKERS_ADMIN_TOKEN_KEY = 'ai-investment-agents:tickers-admin-token';

export function getTickersAdminToken(): string | null {
  if (typeof sessionStorage === 'undefined') return null;
  const v = sessionStorage.getItem(TICKERS_ADMIN_TOKEN_KEY)?.trim();
  return v || null;
}

export function setTickersAdminToken(token: string): void {
  sessionStorage.setItem(TICKERS_ADMIN_TOKEN_KEY, token.trim());
}

export function clearTickersAdminToken(): void {
  sessionStorage.removeItem(TICKERS_ADMIN_TOKEN_KEY);
}
