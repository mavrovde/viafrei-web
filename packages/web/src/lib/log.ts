/**
 * The site shell's structured log (#741). The shell may import none of our
 * database-holding workspaces (`scripts/check_web_boundary.sh`), so it does not
 * share `@viafrei/ingest`'s pino logger: it writes the same shape — one JSON
 * line on stderr, pino's numeric levels — through `log-mask.ts`, a
 * byte-identical copy of the ingest mask held equal by `test/log-mask-drift.test.ts`.
 *
 * Masked HERE, at the source (data-steward T3/T5): the message is a constant
 * sentence, the `key` a route template or a fragment's path (never its query),
 * `err` reduced to its name, code, message and bounded stack.
 */
import { boundKey, boundMessage, serializeLogError } from "./log-mask.js";

/** pino's numbers; 30 (info) only for a COUNT line, the legacy redirects' (#892, `legacy-redirects.ts`) — the collector keeps 40 and up. */
export type LogLevel = 30 | 40 | 50 | 60;
export type LogFields = {
  readonly kind: string;
  readonly key?: string | null;
  readonly status?: number | null;
  readonly ms?: number;
  /** A COUNT line's number (#936: the fragment cache's outcomes over five minutes). */
  readonly count?: number;
  readonly err?: unknown;
};

/** The line `logLine` would write, without writing it — what the tests read. */
export function formatLogLine(level: LogLevel, fields: LogFields, message: string, now: () => number = Date.now): string {
  const out: Record<string, unknown> = { level, time: now(), kind: fields.kind };
  const key = typeof fields.key === "string" ? boundKey(fields.key) : null;
  if (key !== null) out["key"] = key;
  if (typeof fields.status === "number") out["status"] = fields.status;
  if (typeof fields.ms === "number") out["ms"] = fields.ms;
  if (typeof fields.count === "number") out["count"] = fields.count;
  if (fields.err !== undefined) out["err"] = serializeLogError(fields.err);
  out["msg"] = boundMessage(message);
  return `${JSON.stringify(out)}\n`;
}

let sink: (line: string) => void = (line) => { process.stderr.write(line); };

/** One structured line on stderr. Never throws: a log line never fails a page. */
export function logLine(level: LogLevel, fields: LogFields, message: string): void {
  try {
    sink(formatLogLine(level, fields, message));
  } catch { /* a log line never fails a page */ }
}

/** Tests only: where the lines go, and the previous sink back. */
export function setLogSink(next: (line: string) => void): () => void {
  const prev = sink;
  sink = next;
  return () => { sink = prev; };
}

/**
 * A digest fragment that did not arrive (#741): the 2026-10-14 incident was
 * seven of these on `/internal/place/suggest` that nobody could see. Keyed by
 * the internal PATH alone — the query is where a visitor's typing travels.
 * A 404 is not logged: it is the digest's "no such place / no permitted line",
 * an answer and not a fault.
 */
export function logFragmentFailure(url: string, status: number | null, reason: string, ms: number): void {
  let key: string | null = null;
  try {
    key = new URL(url).pathname;
  } catch {
    key = null;
  }
  const timeout = reason.startsWith("timeout");
  logLine(40, { kind: timeout ? "fragment_timeout" : "fragment_upstream", key, status, ms }, timeout ? "a digest fragment missed its deadline" : "a digest fragment could not be used");
}
