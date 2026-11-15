/**
 * The developers page's "try it" (#992): ONE whole `tools/call` result as our own server received it minutes ago,
 * read from the MCP process's internal listener (`/internal/examples/call?key=charging`, compose network only — the
 * MCP side's `INTERNAL_EXAMPLE_CALL_ROUTE`). The MCP side serves it only while it is younger than its own age ceiling;
 * this side refuses anything older than `TRY_IT_MAX_AGE_MS` as well, so a page can never print a stale call as the
 * server's answer, and refuses any shape it does not know. No call held, a slow listener or a refused body is the
 * page's error state, never a sample: there is no recorded fallback by construction.
 *
 * Nothing here calls the public server: a test serves the route from a loopback stub (`e2e/asks-stub.ts`).
 */
import type { FetchLike } from "./tiles.js";

export const TRY_IT_PATH = "/internal/examples/call?key=charging";
/** The page's own ceiling (#992 "no example answer older than 24 h"); the MCP side's is far shorter. */
export const TRY_IT_MAX_AGE_MS = 24 * 3_600_000;
/** The largest result the page prints; a bigger one is not shown rather than cut (a cut JSON is not a response). */
export const TRY_IT_MAX_BYTES = 64_000;

export type TryItCall = { readonly tool: string; readonly args: Readonly<Record<string, unknown>>; readonly askedAt: string; readonly result: Readonly<Record<string, unknown>> };

const obj = (v: unknown): Record<string, unknown> | null => (typeof v === "object" && v !== null && !Array.isArray(v) ? (v as Record<string, unknown>) : null);

/** The route's body as a call, or null: a known shape, young enough at `now`, no consumer-only source in it. */
export function parseTryIt(body: unknown, now: Date): TryItCall | null {
  const c = obj(obj(body)?.["call"]);
  if (c === null) return null;
  const tool = c["tool"];
  const args = obj(c["args"]);
  const askedAt = c["askedAt"];
  const result = obj(c["result"]);
  if (typeof tool !== "string" || !/^[a-z][a-z_]{2,40}$/u.test(tool) || args === null || result === null) return null;
  if (typeof askedAt !== "string" || askedAt.length > 40) return null;
  const at = Date.parse(askedAt);
  if (Number.isNaN(at) || now.getTime() - at > TRY_IT_MAX_AGE_MS || at - now.getTime() > 5 * 60_000) return null;
  // a result is something a client can read: a text block or a structured answer; an empty shell is a placeholder
  const content = result["content"];
  if (!Array.isArray(content)) return null;
  const texts = content.filter((b): b is { type: "text"; text: string } => obj(b)?.["type"] === "text" && typeof obj(b)?.["text"] === "string" && (obj(b)?.["text"] as string).trim() !== "");
  if (texts.length === 0 && obj(result["structuredContent"]) === null) return null;
  if (result["isError"] === true) return null;
  const text = JSON.stringify(result);
  if (text.length > TRY_IT_MAX_BYTES) return null;
  // Only a person's own request may ask Tankerkönig (data-steward C5); MTS-K data is never a page's example.
  if (/tankerk(?:oe|ö)nig|MTS-K/iu.test(text)) return null;
  return { tool, args, askedAt, result };
}

/** One GET under its deadline; no listener configured, a timeout, a non-200 or a refused body: null. */
export async function fetchTryIt(o: { readonly baseUrl: string | undefined; readonly timeoutMs: number; readonly fetchImpl?: FetchLike; readonly now?: Date }): Promise<TryItCall | null> {
  if (o.baseUrl === undefined) return null;
  const f: FetchLike = o.fetchImpl ?? ((url, init) => fetch(url, init));
  try {
    const r = await f(`${o.baseUrl}${TRY_IT_PATH}`, { signal: AbortSignal.timeout(o.timeoutMs), headers: { accept: "application/json" } });
    if (r.status !== 200) return null;
    return parseTryIt(JSON.parse(await r.text()), o.now ?? new Date());
  } catch {
    return null;
  }
}

/** The JSON-RPC response the curl's last request receives, as the page prints it. */
export const tryItResponse = (c: TryItCall): string => JSON.stringify({ jsonrpc: "2.0", id: 2, result: c.result }, null, 2);
