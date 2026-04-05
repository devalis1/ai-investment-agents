import dns from "node:dns";
import { Agent, fetch as undiciFetch } from "undici";
import { env } from "../config/env";

let ipv4Agent: Agent | null = null;

function getYahooIpv4Agent(): Agent {
  if (!ipv4Agent) {
    ipv4Agent = new Agent({
      connections: 1,
      autoSelectFamily: false,
      connect: {
        lookup: (hostname, _options, callback) => {
          dns.lookup(hostname, { family: 4 }, callback);
        },
      },
    });
  }
  return ipv4Agent;
}

/**
 * Bound each Yahoo HTTP call so flaky networks fail fast instead of hanging on defaults.
 * When `YAHOO_FETCH_IPV4_ONLY` is on (default), uses Undici with IPv4-only lookup so broken IPv6
 * does not produce parallel EHOSTUNREACH entries in AggregateError.
 */
export function createTimeoutFetch(timeoutMs: number): typeof fetch {
  const impl = (
    input: RequestInfo | URL,
    init?: RequestInit
  ): Promise<Response> => {
    const timeoutSignal = AbortSignal.timeout(timeoutMs);
    const parent = init?.signal;
    const signal =
      parent && !parent.aborted
        ? AbortSignal.any([parent, timeoutSignal])
        : timeoutSignal;

    const nextInit = { ...init, signal };

    if (env.YAHOO_FETCH_IPV4_ONLY) {
      return undiciFetch(
        input as Parameters<typeof undiciFetch>[0],
        {
          ...nextInit,
          dispatcher: getYahooIpv4Agent(),
        } as Parameters<typeof undiciFetch>[1]
      ) as unknown as Promise<Response>;
    }

    return fetch(input, nextInit);
  };

  return impl as typeof fetch;
}
