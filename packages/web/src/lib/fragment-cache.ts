/**
 * The fragment cache in front of the digest (#936 D): `fragcache`, one nginx
 * on the compose network (the fragment cache configuration), for the place
 * cards, the motorway pages and (#1042) the station pages and their live part. The shell knows it only as a URL,
 * `DIGEST_FRAGMENT_URL`; the digest never knows it exists.
 *
 * WHEN THE CACHE IS AWAY the shell asks the digest directly, inside the SAME
 * deadline — today's path, never an error: a connection the cache refuses or
 * resets, a name that does not resolve, or a gateway answer of the cache's own
 * (502, 504: it could not reach the digest and held no stale copy) is asked
 * again of `baseUrl` with whatever time is left. A timeout is not retried: the
 * deadline is spent. Unset (the default), nothing here runs and every request
 * goes to the digest exactly as before 2.3.18.
 *
 * The cache's `X-Cache` (HIT, STALE, UPDATING, MISS, EXPIRED, BYPASS,
 * REVALIDATED) is counted per outcome and written as one count line per
 * outcome every five minutes — never the key, never a query.
 */
import type { FetchLike, TileFetchOptions } from "./tiles.js";
import { logLine } from "./log.js";
import { readEnv } from "./env.js";
import { digestFetch } from "./agent-class.js";

/** The options of a fetch that may go through the fragment cache (`fragmentUrl`: the cache's origin). */
export type CachedFetchOptions = TileFetchOptions;

/**
 * The cache this PROCESS is configured with, for the digest it is configured
 * with: read once from the environment (`readEnv`), and used only when a
 * fetch is for that digest and names no cache of its own. So the pages pass
 * nothing new, and a test that asks another origin is never routed anywhere.
 */
let configured: { readonly digestUrl: string; readonly fragmentUrl: string | undefined } | null = null;
function processFragmentUrl(baseUrl: string): string | undefined {
  if (configured === null) {
    try {
      const e = readEnv(process.env);
      configured = { digestUrl: e.digestUrl, fragmentUrl: e.fragmentUrl };
    } catch {
      configured = { digestUrl: "", fragmentUrl: undefined };
    }
  }
  return configured.digestUrl === baseUrl ? configured.fragmentUrl : undefined;
}

/** Tests only: forget the environment read above. */
export function resetConfiguredFragmentUrl(): void {
  configured = null;
}

/**
 * The digest paths the cache SERVES — `the fragment cache configuration`'s locations, held equal to that file by
 * `test/fragment-cache.test.ts`. Every other path is a `404` of the cache's own (`location / { return 404; }`), which
 * is not a gateway answer and was taken for the digest's: 2.4.5's home station block (`/internal/station/top`) asked
 * through it and showed its error state on every render. So a path the cache does not serve is asked of the digest
 * directly — one rule for every caller, never a per-caller list of exceptions.
 */
export const FRAGMENT_CACHE_PATHS: readonly RegExp[] = [
  /^\/internal\/place\/cards$/,
  /^\/internal\/motorway\/(?:index|top|A[1-9][0-9]{0,2})$/,
  /^\/internal\/motorway\/A[1-9][0-9]{0,2}\/more\/[a-z]{3,12}$/,
  /^\/internal\/place\/[a-z0-9-]{1,80}\/[a-z]{3,12}$/,
  // #1042: one station's page, the bare catalogue and a station's live part (never `list`, `top` or a card alone)
  /^\/internal\/station\/(?!(?:top|list)$)[a-z0-9-]{1,80}(?:\/live)?$/,
];

/** Whether the cache serves a digest path (the part before `?`). */
export const cacheServes = (path: string): boolean => FRAGMENT_CACHE_PATHS.some((re) => re.test(path.split("?")[0] ?? ""));

/** The cache's own gateway answers: it could not reach the digest. */
const GATEWAY = new Set([502, 504]);

/** The outcomes nginx reports in `$upstream_cache_status`; anything else is counted as `other`. */
export const CACHE_OUTCOMES = ["HIT", "STALE", "UPDATING", "MISS", "EXPIRED", "BYPASS", "REVALIDATED"] as const;
type Outcome = (typeof CACHE_OUTCOMES)[number] | "other" | "fallback";

const FLUSH_MS = 300_000;
const counts = new Map<Outcome, number>();
let since = Date.now();

/** Count one outcome; every five minutes write the counts and start again. Exported for the tests. */
export function countCacheOutcome(outcome: string | null, now: () => number = Date.now): void {
  const o: Outcome = (CACHE_OUTCOMES as readonly string[]).includes(outcome ?? "") ? (outcome as Outcome) : outcome === "fallback" ? "fallback" : "other";
  counts.set(o, (counts.get(o) ?? 0) + 1);
  if (now() - since < FLUSH_MS) return;
  for (const [k, n] of counts) logLine(30, { kind: "fragment_cache", key: k, count: n }, "fragment cache outcomes over the last five minutes");
  counts.clear();
  since = now();
}

/** Tests only: the counts so far, and a reset. */
export function cacheOutcomeCounts(reset = false): ReadonlyMap<string, number> {
  const out = new Map(counts);
  if (reset) {
    counts.clear();
    since = Date.now();
  }
  return out;
}

/**
 * A FetchLike for `o` that asks the fragment cache first when one is
 * configured, and the digest directly when the cache is away. The URL it is
 * handed is the DIGEST's (`baseUrl` + path); only its origin is swapped.
 */
export function viaFragmentCache(o: CachedFetchOptions): FetchLike {
  const base: FetchLike = o.fetchImpl ?? ((u, init) => digestFetch(u, init));
  const cache = o.fragmentUrl ?? processFragmentUrl(o.baseUrl);
  if (cache === undefined || cache === "" || cache === o.baseUrl) return base;
  return async (url, init) => {
    if (!url.startsWith(`${o.baseUrl}/`) || !cacheServes(url.slice(o.baseUrl.length))) return base(url, init);
    const viaCache = `${cache}${url.slice(o.baseUrl.length)}`;
    try {
      const res = await base(viaCache, init);
      if (!GATEWAY.has(res.status)) {
        countCacheOutcome(res.headers.get("x-cache"));
        return res;
      }
    } catch (err) {
      // The deadline is the caller's and is spent: no second request after an abort.
      if (init.signal.aborted || (err instanceof Error && err.name === "AbortError")) throw err;
    }
    countCacheOutcome("fallback");
    return base(url, init);
  };
}
