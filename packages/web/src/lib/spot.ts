/**
 * `POST /fragment/spot` (#1171): the location island's one request that carries a PRECISE position — after a click
 * on "use my location", to ask whether the person stands at one of our objects with a page (a station, a fuel
 * station, a charging site, a motorway service area). It is forwarded to the digest's `POST /internal/spot` and
 * answered with that object's page, or 204.
 *
 * The position is in the BODY both ways, never in an address (the edge's access log records the request line,
 * `the edge configuration` `vf_visits`), and nothing here keeps it: not stored, not cached (`no-store`), not logged — a
 * failure is logged as `logFragmentFailure` logs every fragment, by the digest's PATH alone (`/internal/spot`), with
 * the status and the time. Asked of the digest itself, never of the fragment cache: that is a GET cache.
 *
 * Only a path of one of the four page kinds in the visitor's own language is passed on; anything else is 204, and
 * so is every failure and a digest slower than `SPOT_TIMEOUT_MS` — the island then shows the cell's cards.
 *
 * A person's lookup only (#1171 C3, data-steward 2026-11-04): any coordinate answers a station's name, street and page,
 * so a sweep over a grid would rebuild the list of every station's page the #1076 ruling forbids. Before the body is
 * read, the request must be what `personAsks(req, "fragment")` calls a person's (same-origin, `Sec-Fetch-Dest:
 * empty`, a fetch mode, no crawler user agent, no prefetch) and carry no user-agent class from nginx (`X-VF-Agent-Class`,
 * #1141) — the gate of the fuel station fragment. Anything else is 204, and the digest is never asked.
 */
import { isLang } from "../i18n/index.js";
import { AGENT_CLASS_HEADER, digestFetch } from "./agent-class.js";
import { esc } from "./answer-html.js";
import { bodyOf } from "./fragment-route.js";
import { personAsks } from "./fuel-refresh.js";
import { logFragmentFailure } from "./log.js";

/** Under the island's 2 s, with the digest's own deadlines (connect 500 ms, statement 800 ms) inside it. */
export const SPOT_TIMEOUT_MS = 1_500;
/** The four page kinds an object lookup may open: `/<lang>/<kind>/<slug>`. */
export const SPOT_HREF = /^\/([a-z]{2})\/(?:station|fuel|charging|autobahn)\/[a-z0-9][a-z0-9-]*$/;

export type SpotFetch = (url: string, init: { readonly method: "POST"; readonly headers: Record<string, string>; readonly body: string; readonly signal: AbortSignal }) => Promise<{ readonly status: number; readonly headers: { get(name: string): string | null } }>;
export type SpotOptions = { readonly baseUrl: string; readonly timeoutMs?: number; readonly fetch?: SpotFetch };

const HEADERS = { "cache-control": "no-store", "x-robots-tag": "noindex, nofollow" } as const;
const none = (status = 204): Response => new Response(null, { status, headers: { ...HEADERS } });
const num = (x: unknown): number | null => (typeof x === "number" && Number.isFinite(x) ? x : null);

/** C3: a person's fetch from this origin's page, and no class nginx gave a robot. */
export function spotAsks(req: Request): boolean {
  if ((req.headers.get(AGENT_CLASS_HEADER) ?? "").trim() !== "") return false;
  return personAsks({ method: req.method, headers: req.headers, url: req.url }, "fragment");
}

export async function spotRoute(req: Request, o: SpotOptions): Promise<Response> {
  if (req.method !== "POST") return new Response(null, { status: 405, headers: { ...HEADERS, allow: "POST" } });
  if (!spotAsks(req)) return none();
  const b = await bodyOf(req);
  const lang = typeof b?.["lang"] === "string" && isLang(b["lang"]) ? b["lang"] : null;
  const lat = num(b?.["lat"]);
  const lon = num(b?.["lon"]);
  const acc = num(b?.["acc"]);
  if (lang === null || lat === null || lon === null || acc === null) return none(400);
  const url = `${o.baseUrl}/internal/spot`;
  const t0 = Date.now();
  const f: SpotFetch = o.fetch ?? ((u, init) => digestFetch(u, init));
  try {
    const res = await f(url, { method: "POST", headers: { "content-type": "application/json", accept: "text/html" }, body: JSON.stringify({ lat, lon, acc, lang }), signal: AbortSignal.timeout(o.timeoutMs ?? SPOT_TIMEOUT_MS) });
    if (res.status === 200) {
      const href = res.headers.get("spot-href") ?? "";
      const m = SPOT_HREF.exec(href);
      let label = "";
      try {
        label = decodeURIComponent(res.headers.get("spot-label") ?? "").slice(0, 120);
      } catch {
        label = "";
      }
      if (m !== null && m[1] === lang) {
        return new Response(`<a class="vf-spot" href="${esc(href)}">${esc(label)}</a>`, { status: 200, headers: { ...HEADERS, "content-type": "text/html; charset=utf-8", "spot-href": href, "spot-label": encodeURIComponent(label) } });
      }
      logFragmentFailure(url, res.status, "spot answer not a page of ours", Date.now() - t0);
      return none();
    }
    // 204 no object; 400 a position the digest does not look up (outside Germany, too vague): no failure either
    if (res.status >= 500) logFragmentFailure(url, res.status, "spot upstream", Date.now() - t0);
    return none();
  } catch (e) {
    logFragmentFailure(url, null, e instanceof Error && e.name === "TimeoutError" ? "timeout" : "spot unreachable", Date.now() - t0);
    return none();
  }
}
