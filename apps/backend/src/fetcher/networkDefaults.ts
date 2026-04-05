import dns from "node:dns";

/**
 * Node's default can prefer IPv6 (AAAA). Yahoo's CDN then fails with EHOSTUNREACH / ETIMEDOUT
 * on networks with broken or filtered IPv6 — a common residential/Wi‑Fi issue.
 * Prefer IPv4 for outbound Yahoo Finance connections.
 */
dns.setDefaultResultOrder("ipv4first");
