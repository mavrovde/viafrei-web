/**
 * #1205 review S3/B1 (owner decision, applied by the lead 2026-11-12: a verified crawler is never refused while anything
 * can answer it): the last copy of a database page that a VERIFIED CRAWLER was itself served, kept so that the same
 * kind of request — a search engine or AI crawler on the digest's search lane (`overload/verified-class.ts`,
 * `cls === "search"`) — whose page could not be read now is answered with that copy: a 200 marked `X-VF-Degraded: 1`,
 * the stale marker the held sitemaps carry (`sitemap-held.ts`), logged by the middleware as `page_degraded`, instead
 * of a 503. Only when nothing is held does it keep the 503 with `Retry-After`, counted apart (`verifiedRefused`, the
 * middleware's `verified_refused` line).
 *
 * THE INVARIANT: a copy is held only from a verified crawler's OWN render, and only when that render depends on no
 * visitor. A person's render is never held, with or without a cookie — so nothing a person sees, chose, stored or was
 * located by can reach a crawler, and a person's page never pays for the compression. A crawler's render is refused
 * as well when
 *  - it read the visitor: the request's address, the GeoIP file or the user agent's class decided something in it
 *    (`locals.perVisitor`, set by the station index's near-IP panel, the motorway page's around block, the fuel page
 *    and the home), because such a render is about one client and not about the page;
 *  - the request carried a cookie, or the answer sets one (`Set-Cookie`), varies by one (`Vary: Cookie` or `*`), or
 *    is `Cache-Control: private` (S7) — the pages that are about one visitor (the home, the fuel page) say `private`.
 *    `no-store` alone is NOT a refusal: every database page layout sends it for freshness (no cache may serve a
 *    closure that has ended), so refusing it would hold nothing; what makes a render one visitor's is named above;
 *  - it is not a whole 200 (a degraded answer, any other status, a HEAD).
 * FUEL IS NEVER HELD OR REPLAYED: the fuel pages carry the MTS-K prices (Tankerkönig), which may not be handed to a
 * corpus crawler from a store of ours, so `HELD_PAGE` does not name them at all.
 *
 * The copy is keyed by the address and the map platform (`locals.mapPlatform`, the one per-request input of a database
 * page's links), with the render's CSP nonce removed (the replay gets its own). Bounded by `HeldStore` (gzip level 1,
 * `PAGE_HELD_MAX_BYTES` in all, `PAGE_HELD_ENTRY_MAX_BYTES` each, the least recently used dropped first; the web
 * container's memory is 192 MiB, its old space 96 MB), lost on a restart, never written anywhere.
 */
import { DEGRADED_HEADER } from "./degraded.js";
import { HeldStore } from "./held-store.js";
import { logLine } from "./log.js";

/** The page families held for a verified crawler: a place, a station (and its stop), a motorway, a road, a Land, a charging site, and their indexes — never fuel. */
export const HELD_PAGE = /^\/[a-z]{2}\/(?:place|station|autobahn|road|state|states|charging)(?:\/|$)/;
export const PAGE_HELD_MAX_BYTES = 8 * 1024 * 1024;
export const PAGE_HELD_ENTRY_MAX_BYTES = 1024 * 1024;

/** What the replay needs besides the body: the page's own declarations, which pick its CSP. */
export type HeldFlags = { readonly hasScript: boolean; readonly hasForm: boolean; readonly clarityPage: boolean; readonly cacheControl: string | null };

const store = new HeldStore<HeldFlags>(PAGE_HELD_MAX_BYTES, PAGE_HELD_ENTRY_MAX_BYTES);
let refused = 0;

/** The key of a page's copy: its address (path and query) and the map platform its links were written for. */
export const heldKey = (url: URL, mapPlatform: string | undefined): string => `${url.pathname}${url.search}|${mapPlatform ?? ""}`;

/** Keep `raw` (the body as rendered, before the middleware's nonce) for `key`, its `nonce` attribute removed. */
export function holdPage(key: string, raw: string, nonce: string, flags: HeldFlags): boolean {
  return store.set(key, raw.split(` nonce="${nonce}"`).join(""), flags);
}

/** The copy held for `key` (moved to the young end), or null. */
export function heldPage(key: string): { readonly raw: string; readonly flags: HeldFlags } | null {
  const e = store.get(key);
  return e === null ? null : { raw: e.text, flags: e.meta };
}

const isGet = (method: string): boolean => method === "GET" || method === "HEAD";

/**
 * The middleware's replay, right after the page answered: a VERIFIED crawler's (`cls === "search"`) 503 on a held page
 * family becomes the copy held for its address — a 200 with `X-VF-Degraded: 1` and the copy's own declarations — and
 * anything else is answered as it came. A verified crawler's answer that is still a 5xx after this is the last resort,
 * counted (`countVerifiedRefused`) by the caller.
 */
export function verifiedReplay(o: { readonly method: string; readonly url: URL; readonly mapPlatform?: string; readonly cls: string | null; readonly response: Response }): { readonly response: Response; readonly flags: HeldFlags | null } {
  if (o.cls !== "search" || !isGet(o.method) || o.response.status !== 503 || !HELD_PAGE.test(o.url.pathname)) return { response: o.response, flags: null };
  const copy = heldPage(heldKey(o.url, o.mapPlatform));
  if (copy === null) return { response: o.response, flags: null };
  const headers = { "content-type": "text/html; charset=utf-8", "cache-control": copy.flags.cacheControl ?? "no-store", [DEGRADED_HEADER]: "1" };
  return { response: new Response(o.method === "HEAD" ? null : copy.raw, { status: 200, headers }), flags: copy.flags };
}

/** S7: an answer that says it is one client's — it sets a cookie, varies by one, or is private to its receiver. */
export function answerIsPerClient(headers: Headers): boolean {
  if (headers.has("set-cookie")) return true;
  const vary = (headers.get("vary") ?? "").toLowerCase().split(",").map((v) => v.trim());
  // `X-Forwarded-For` and `User-Agent` too: the home and the fuel page vary by the visitor's address
  if (vary.some((v) => v === "*" || v === "cookie" || v === "x-forwarded-for" || v === "user-agent")) return true;
  return /(?:^|,)\s*private\b/i.test(headers.get("cache-control") ?? "");
}

/** The middleware's keep: a held page family rendered whole (200, not degraded) for a verified crawler's own request that read no visitor. */
export function keepRendered(o: {
  readonly method: string;
  readonly url: URL;
  readonly mapPlatform?: string;
  readonly cls: string | null;
  readonly perVisitor: boolean;
  readonly status: number;
  readonly headers: Headers;
  readonly cookie: boolean;
  readonly raw: string;
  readonly nonce: string;
  readonly flags: Omit<HeldFlags, "cacheControl">;
}): boolean {
  if (o.cls !== "search" || o.perVisitor || o.cookie) return false;
  if (o.method !== "GET" || o.status !== 200 || o.headers.get(DEGRADED_HEADER) !== null || !HELD_PAGE.test(o.url.pathname)) return false;
  if (answerIsPerClient(o.headers)) return false;
  return holdPage(heldKey(o.url, o.mapPlatform), o.raw, o.nonce, { ...o.flags, cacheControl: o.headers.get("cache-control") });
}

/**
 * The last resort: a verified crawler answered with a 503 because nothing was held. Counted and logged at warn — one
 * line per refusal, keyed by the route template — so the evidence read reports it apart from every other 5xx.
 */
export function countVerifiedRefused(route: string | null, status: number, ms: number): void {
  refused += 1;
  logLine(40, { kind: "verified_refused", key: route, status, ms }, "a verified crawler was refused: nothing was held to answer it");
}

/** Tests and the evidence: the copies held, their bytes (and what their allocations really hold), and the verified crawlers refused since this process started. */
export function heldPages(): { readonly pages: number; readonly bytes: number; readonly backingBytes: number; readonly verifiedRefused: number } {
  const s = store.stats();
  return { pages: s.entries, bytes: s.bytes, backingBytes: s.backingBytes, verifiedRefused: refused };
}

/** Forget every held page and the count (tests). */
export function clearHeldPages(): void {
  store.clear();
  refused = 0;
}
