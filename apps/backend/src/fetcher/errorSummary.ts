/**
 * Node's `fetch` often throws TypeError("fetch failed") with `cause` an AggregateError
 * of ETIMEDOUT / ECONNREFUSED across IPv4/v6. Surface that for ops logs.
 */
export function summarizeUndiciFetchError(err: unknown): string {
  if (!(err instanceof Error)) return String(err);

  const lines: string[] = [`${err.name}: ${err.message}`];
  const { cause } = err;

  if (cause instanceof AggregateError) {
    const parts = cause.errors.map((e) => {
      if (e instanceof Error) {
        const code =
          "code" in e && typeof (e as NodeJS.ErrnoException).code === "string"
            ? (e as NodeJS.ErrnoException).code
            : undefined;
        return code ? `${code}: ${e.message}` : e.message;
      }
      return String(e);
    });
    lines.push(`aggregate: ${parts.join("; ")}`);
  } else if (cause instanceof Error) {
    const code =
      "code" in cause && typeof (cause as NodeJS.ErrnoException).code === "string"
        ? (cause as NodeJS.ErrnoException).code
        : undefined;
    lines.push(code ? `cause: ${code} — ${cause.message}` : `cause: ${cause.message}`);
  } else if (cause != null && typeof cause === "object") {
    const c = cause as { code?: unknown; message?: unknown };
    if (typeof c.code === "string") lines.push(`cause.code: ${c.code}`);
    if (typeof c.message === "string") lines.push(`cause.message: ${c.message}`);
  }

  return lines.join(" | ");
}
