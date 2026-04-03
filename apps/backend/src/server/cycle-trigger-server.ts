import http from "node:http";
import { assertSupabaseConfigForServer } from "../config/env";
import { analyzeCycle } from "../jobs/cycle";
import { MAX_TRIGGER_TICKERS, normalizeTickerList } from "../ticker-symbols";

type TriggerBody = {
  tickers?: unknown;
};

function parseBearer(req: http.IncomingMessage): string | null {
  const auth = req.headers.authorization;
  if (!auth || !auth.toLowerCase().startsWith("bearer ")) return null;
  return auth.slice(7).trim();
}

async function readBody(req: http.IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(chunk as Buffer);
  }
  return Buffer.concat(chunks).toString("utf8");
}

function sendJson(res: http.ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(body));
}

function isTriggerPath(urlPath: string): boolean {
  return urlPath === "/" || urlPath === "/trigger";
}

export function createCycleTriggerServer(expectedSecret: string): http.Server {
  assertSupabaseConfigForServer();

  return http.createServer((req, res) => {
    void (async () => {
      const urlPath = (req.url?.split("?")[0] ?? "/").replace(/\/$/, "") || "/";

      if (req.method === "GET" && urlPath === "/health") {
        sendJson(res, 200, { ok: true, service: "cycle-trigger" });
        return;
      }

      if (req.method !== "POST" || !isTriggerPath(urlPath)) {
        if (req.method !== "POST") {
          sendJson(res, 405, { error: "method_not_allowed" });
        } else {
          sendJson(res, 404, { error: "not_found" });
        }
        return;
      }

      const token = parseBearer(req);
      if (!token || token !== expectedSecret) {
        sendJson(res, 401, {
          error: "unauthorized",
          message: "Invalid or missing Authorization: Bearer token.",
        });
        return;
      }

      let body: TriggerBody;
      try {
        const raw = await readBody(req);
        body = (raw ? JSON.parse(raw) : {}) as TriggerBody;
      } catch {
        sendJson(res, 400, {
          error: "invalid_json",
          message: "Request body must be JSON.",
        });
        return;
      }

      const rawList = body.tickers;
      if (!Array.isArray(rawList) || rawList.some((t) => typeof t !== "string")) {
        sendJson(res, 400, {
          error: "invalid_body",
          message: "Expected { tickers: string[] }.",
        });
        return;
      }

      const tickers = normalizeTickerList(rawList);
      if (tickers.length === 0) {
        sendJson(res, 400, {
          error: "no_valid_tickers",
          message: "No valid US-style symbols after normalization.",
        });
        return;
      }

      if (tickers.length > MAX_TRIGGER_TICKERS) {
        sendJson(res, 400, {
          error: "too_many_tickers",
          message: `Maximum ${MAX_TRIGGER_TICKERS} tickers per request.`,
        });
        return;
      }

      const startedAt = new Date().toISOString();
      try {
        await analyzeCycle({ tickers });
        sendJson(res, 200, {
          ok: true,
          tickers,
          startedAt,
          finishedAt: new Date().toISOString(),
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        sendJson(res, 500, {
          ok: false,
          tickers,
          error: "cycle_failed",
          message,
        });
      }
    })().catch((err) => {
      const message = err instanceof Error ? err.message : String(err);
      sendJson(res, 500, { ok: false, error: "internal_error", message });
    });
  });
}

function main(): void {
  const secret = process.env.CYCLE_TRIGGER_SECRET?.trim();
  if (!secret) {
    throw new Error(
      "Missing CYCLE_TRIGGER_SECRET. Set the same value on this worker and on Vercel (server-only)."
    );
  }

  const portRaw = process.env.CYCLE_TRIGGER_SERVER_PORT ?? process.env.PORT ?? "8787";
  const port = Number(portRaw);
  if (!Number.isFinite(port) || port < 1) {
    throw new Error(`Invalid port: ${portRaw}`);
  }

  const server = createCycleTriggerServer(secret);
  server.listen(port, () => {
    // eslint-disable-next-line no-console
    console.log(`Cycle trigger server listening on http://127.0.0.1:${port}`);
  });
}

main();
