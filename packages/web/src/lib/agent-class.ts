/**
 * #1141: the user-agent class nginx gave the request (the edge configuration `$vf_ua_class`, sent as `X-VF-Agent-Class`
 * by the edge shell proxy rules), handed on to every fragment this shell asks of the digest — so the digest reads a
 * crawler's page on its own database pool and a crawl cannot take the connections people's pages read through
 * (packages/digest/src/server/agent-pool.ts).
 *
 * nginx's map is the ONE list of who is a crawler; this module keeps none and decides nothing about a user agent. It
 * passes on one of nginx's three non-empty values (`search`, `crawler`, `seo`) and nothing else: an absent, empty or
 * unknown value sends no header, and the digest reads that request as a person's, as before #1141.
 *
 * The class rides an AsyncLocalStorage scope that the middleware opens around the whole request — the render, the
 * body the middleware reads back for its nonce, and every fragment fetched on the way — so no page, endpoint or
 * fetcher has to thread it through its options. A fetch outside any request (the station names' refresh timer) sends
 * no header.
 */
import { AsyncLocalStorage } from "node:async_hooks";

/** The header nginx sets and this shell forwards (lower-case, as Node and fetch spell it). */
export const AGENT_CLASS_HEADER = "x-vf-agent-class";

/** nginx's non-empty `$vf_ua_class` values. */
export const AGENT_CLASSES = ["search", "crawler", "seo"] as const;
export type AgentClass = (typeof AGENT_CLASSES)[number];

/** One of nginx's classes, or null for anything else (no header, empty, unknown). */
export const agentClassOf = (v: string | null | undefined): AgentClass | null => ((AGENT_CLASSES as readonly string[]).includes(v ?? "") ? (v as AgentClass) : null);

const scope = new AsyncLocalStorage<AgentClass | null>();

/** Runs `fn` — a whole request — with `cls` as its class. */
export const withAgentClass = <T>(cls: AgentClass | null, fn: () => T): T => scope.run(cls, fn);

/** The class of the request this code runs for, or null (a person, or no request at all). */
export const currentAgentClass = (): AgentClass | null => scope.getStore() ?? null;

/**
 * `fetch` for a request to the digest: the request's class rides along as `X-VF-Agent-Class`, and a person's request
 * (or no request) is fetched exactly as before. Every fetcher in `lib/` that asks the digest uses this as its default.
 *
 * #1290: the lane marker the digest reads comes from THIS scope and nowhere else. A copy in the caller's headers (a
 * fetcher that handed on a client's headers, or a typo'd literal) is removed before the class is set, so no value that
 * did not come from the request's scope can choose a pool: a person's request sends no marker even when one was handed
 * in, and a crawler's sends its own class over whatever was handed in.
 */
export function digestFetch(url: string, init: RequestInit = {}): Promise<Response> {
  const cls = currentAgentClass();
  const headers = new Headers(init.headers);
  if (cls === null && !headers.has(AGENT_CLASS_HEADER)) return fetch(url, init);
  headers.delete(AGENT_CLASS_HEADER);
  if (cls !== null) headers.set(AGENT_CLASS_HEADER, cls);
  const method = (init.method ?? "GET").toUpperCase();
  if (cls === "search" && (method === "GET" || method === "HEAD")) return searchLaneFetch(url, { ...init, headers });
  return fetch(url, { ...init, headers });
}

/**
 * #1310 A3 (a digest roll causes no priority-crawler 503): the waits between a verified crawler's attempts at one
 * digest read. A roll ends a pod's connections — a reset, a refused connect, the fragment cache's or the Service's
 * 502/504 while the next pod takes over — and a person's page answers that with its degraded 200, a crawler's with a
 * 503 when nothing is held. So a search-lane read that FAILED TO ARRIVE is asked again after these waits, for as long
 * as the caller's own deadline (`init.signal`, the crawler's budget of `page-budget.ts`) lets it. An answer the digest
 * GAVE — any status but 502/504, a 503 refusal among them — is returned as it is: asking again is only for a read that
 * never reached a digest that could answer it. GET and HEAD only, which carry no body to send twice.
 */
export const SEARCH_RETRY_WAITS_MS: readonly number[] = [100, 250, 500, 1_000, 1_000];
const GATEWAY = new Set([502, 504]);

function pause(ms: number, signal: AbortSignal | null | undefined): Promise<boolean> {
  if (signal?.aborted === true) return Promise.resolve(false);
  return new Promise((done) => {
    const timer = setTimeout(() => { signal?.removeEventListener("abort", stop); done(true); }, ms);
    const stop = (): void => { clearTimeout(timer); done(false); };
    signal?.addEventListener("abort", stop, { once: true });
  });
}

async function searchLaneFetch(url: string, init: RequestInit): Promise<Response> {
  for (let attempt = 0; ; attempt += 1) {
    const wait = SEARCH_RETRY_WAITS_MS[attempt];
    try {
      const res = await fetch(url, init);
      if (!GATEWAY.has(res.status) || wait === undefined) return res;
      await res.body?.cancel().catch(() => undefined);
    } catch (err) {
      // the deadline is the caller's: an abort is never asked again
      if (wait === undefined || init.signal?.aborted === true || (err instanceof Error && err.name === "AbortError")) throw err;
    }
    if (!(await pause(wait, init.signal))) throw init.signal?.reason instanceof Error ? init.signal.reason : Object.assign(new Error("aborted"), { name: "AbortError" });
  }
}
