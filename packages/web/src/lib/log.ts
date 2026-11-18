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
import { boundKey, boundMessage, KEY_MAX_CHARS, KEY_SHAPE, serializeLogError } from "./log-mask.js";

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
  /** The key is a digest fragment's pathname, built by `logFragmentFailure`: bounded by `boundFragmentKey`. */
  readonly fragmentKey?: true;
};

/** The bounded key of a line: a fragment key's own bound when it is one, null without a key. */
function keyOf(fields: LogFields): string | null {
  if (typeof fields.key !== "string") return null;
  return fields.fragmentKey === true ? boundFragmentKey(fields.key) : boundKey(fields.key);
}

/** The line `logLine` would write, without writing it — what the tests read. */
export function formatLogLine(level: LogLevel, fields: LogFields, message: string, now: () => number = Date.now): string {
  const out: Record<string, unknown> = { level, time: now(), kind: fields.kind };
  const key = keyOf(fields);
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
/**
 * 2.6.19 (#1312, review B1): a long SLUG of our own is kept, but only here. The general rule (`maskLogText`, the
 * host collector's `token_run`) masks any path segment of 32 or more characters, so after 2.6.18 a timeout on
 * `/internal/exit/A40/<slug>/area` or `/internal/charging/<slug>/area` still named no fragment. Widening the general
 * rule would have kept long letter-only values everywhere (a `ghp-…`, `whsec-…` or `xoxb-…` value, a diceware reset
 * path), so the exception is narrow: a fragment pathname of our own (`/internal/<kind>/…`), at its slug position
 * alone (`/internal/exit|motorway/<road>/<slug>`, else `/internal/<kind>/<slug>`), and only a segment of slug shape —
 * lower-case words joined by `-`, at least one of four or more letters, each word letters only, digits with at most one
 * trailing letter (`100a`), or a road reference (`a40`). Every other segment, and every other key, goes through
 * `boundKey`, the 2.6.18 rule.
 */
// 2.6.19 review r2 S4: a letters-only word is at most 24 letters (a random letter run is longer; the longest German
// place word, 26 letters, is then masked — the 2.6.18 answer, no leak), and no two digit-only words stand side by side
// (`xoxb-1234-5678-<letters>`, a token's numeric groups, read as a slug: our slugs carry one number in a row)
const SLUG_WORD = /^(?:[a-z]{1,24}|[0-9]+[a-z]?|[a-z]{1,3}[0-9]{1,4})$/;
function isOurSlug(seg: string): boolean {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)+$/.test(seg)) return false;
  const words = seg.split("-");
  if (words.some((w, i) => i > 0 && /^\d+$/.test(w) && /^\d+$/.test(words[i - 1] ?? ""))) return false;
  return words.every((w) => SLUG_WORD.test(w)) && words.some((w) => /^[a-z]{4,}$/.test(w));
}
const SLUG_HOLD = "s";

/** A fragment pathname's key: the slug position kept when it is a slug of ours, everything else `boundKey`'s. */
export function boundFragmentKey(path: string): string | null {
  const segs = path.split("/");
  if (segs[0] !== "" || segs[1] !== "internal" || segs.length < 4 || !/^[a-z-]+$/.test(segs[2] ?? "")) return boundKey(path);
  const at = segs[2] === "exit" || segs[2] === "motorway" ? 4 : 3;
  const slug = segs[at];
  if (slug === undefined || !isOurSlug(slug)) return boundKey(path);
  const rest = boundKey(segs.map((s, i) => (i === at ? SLUG_HOLD : s)).join("/"));
  if (rest === null) return null;
  const restSegs = rest.split("/");
  if (restSegs.length !== segs.length || restSegs[at] !== SLUG_HOLD) return rest;
  // review r2 N5: the slug goes back only when the whole key fits; a cut would halve a marker or the slug
  const key = restSegs.map((s, i) => (i === at ? slug : s)).join("/");
  return key.length <= KEY_MAX_CHARS && KEY_SHAPE.test(key) ? key : boundKey(path);
}

export function logFragmentFailure(url: string, status: number | null, reason: string, ms: number): void {
  let key: string | null = null;
  try {
    key = new URL(url).pathname;
  } catch {
    key = null;
  }
  const timeout = reason.startsWith("timeout");
  logLine(40, { kind: timeout ? "fragment_timeout" : "fragment_upstream", key, status, ms, fragmentKey: true }, timeout ? "a digest fragment missed its deadline" : "a digest fragment could not be used");
}
