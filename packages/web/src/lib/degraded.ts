/**
 * #1205 (owner 2026-11-11: about 1 % of 503s at most, people first, search engines and AI assistants never refused):
 * what a database page answers when the part it cannot do without — its fragment, its list — was refused, late or
 * failed (`kind: "unavailable"` of every page's resolver).
 *
 *  - A PERSON gets a 200: a small page in their language saying the page is on its way, `no-store`, `noindex`, that
 *    asks for itself again — after 5 s, then 10, 20, 40, and every 60 s from then on (`degradedRefreshS`, counted in
 *    the `vf_wait` query of the address it reloads), so a page that stays unavailable does not add load every 5 s.
 *    A `<meta refresh>`, no script, so no CSP nonce and nothing stored. A person was shown a bare 503 before.
 *  - A CLIENT THAT IS NOT A PERSON keeps the 503 with `Retry-After`: the one answer a search engine reads as "come back,
 *    keep what you indexed", where a 200 holding a loading sentence would be indexed in place of the page. Not a person
 *    (#1205 review): nginx gave it a user-agent class, the edge marked it a verified bot, its User-Agent claims a listed
 *    crawler (`CRAWLER_FAMILIES`), or it names an AI assistant (`AI_ASSISTANTS` in `site/crawlers.ts`: an assistant fetching
 *    the page for a person reads the 503 and can say so; a loading sentence it would read as the page).
 *    Verified search engines and AI assistants are kept off this path by capacity (their own digest lane, #1205, #1290), not by a hollow 200, and a
 *    verified crawler's 503 is then answered by the middleware with the copy a verified crawler was last served (`page-held.ts`, #1205
 *    review S3) — the 503 reaches it only when nothing is held, counted apart as `verified_refused`.
 *
 * Either way the answer carries `X-VF-Degraded: 1` and the middleware logs it (`page_degraded`), so the refusal stays
 * counted and visible (owner 2026-11-08: never hide a problem); a 503 is logged as `route_5xx` as before.
 */
import { t } from "../i18n/index.js";
import { currentAgentClass } from "./agent-class.js";
import { declaresAgent } from "../overload/crawler-verify.js";
import { edgeVerified } from "../overload/verified-class.js";
import type { Lang } from "../site/pages.js";

export const DEGRADED_HEADER = "x-vf-degraded";
/** The query the person's degraded page counts its reloads in. */
export const DEGRADED_WAIT_PARAM = "vf_wait";
/** The first wait, and the ceiling the doubling stops at. */
export const DEGRADED_REFRESH_S = 5;
export const DEGRADED_REFRESH_MAX_S = 60;

/**
 * #1205 review N5: the reload SUCCEEDED once the real page renders at `?vf_wait=N`, so that page takes the counter out
 * of its own address (`history.replaceState`, no reload, no request): a bookmark, a shared link or the next reload is
 * the page's own address again, and the backoff starts from 5 s if the page is ever unavailable again. Rendered by the
 * layout only when the request carries the counter. The canonical never carries it either way: it is built from the
 * page's path alone (`layouts/Base.astro`).
 */
export const DROP_WAIT_SCRIPT = `(function(){var u=new URL(location.href);if(!u.searchParams.has("${DEGRADED_WAIT_PARAM}"))return;u.searchParams.delete("${DEGRADED_WAIT_PARAM}");history.replaceState(history.state,"",u.pathname+u.search+u.hash)})();`;

const step = (n: number): number => (Number.isInteger(n) && n > 0 ? Math.min(n, 8) : 0);

/** The wait before reload number `n` (0 first): 5, 10, 20, 40, then 60 s for good. */
export function degradedRefreshS(n: number): number {
  return Math.min(DEGRADED_REFRESH_S * 2 ** step(n), DEGRADED_REFRESH_MAX_S);
}

/** Whether this request is NOT a person's: a class from nginx, the edge's verified-bot marker, or a crawler or AI fetcher UA. */
export function notAPerson(headers: Headers): boolean {
  if (currentAgentClass() !== null || edgeVerified(headers)) return true;
  return declaresAgent(headers.get("user-agent"));
}

const esc = (s: string): string => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** The degraded page's HTML: one heading, one sentence, a link home; it reloads `url` with its wait counter raised. */
export function degradedPage(lang: Lang, url: URL): string {
  const n = step(Number(url.searchParams.get(DEGRADED_WAIT_PARAM) ?? "0"));
  const next = new URL(url);
  next.searchParams.set(DEGRADED_WAIT_PARAM, String(n + 1));
  return (
    `<!doctype html><html lang="${lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">` +
    `<meta name="robots" content="noindex"><meta http-equiv="refresh" content="${String(degradedRefreshS(n))};url=${esc(`${next.pathname}${next.search}`)}"><title>ViaFrei</title></head>` +
    `<body><main><h1>${esc(t(lang, "tile.loading"))}</h1><p>${esc(t(lang, "tile.loadingNote"))}</p>` +
    `<p><a href="/${lang}">ViaFrei</a></p></main></body></html>`
  );
}

/** The answer of a page whose fragment was refused, late or failed: a person's degraded 200, anyone else's 503. */
export function unavailableAnswer(lang: Lang, request: Request, retryAfterS = 60): Response {
  if (notAPerson(request.headers)) {
    return new Response(null, { status: 503, headers: { "retry-after": String(retryAfterS), "cache-control": "no-store", [DEGRADED_HEADER]: "1" } });
  }
  return new Response(degradedPage(lang, new URL(request.url)), {
    status: 200,
    headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store", "x-robots-tag": "noindex", [DEGRADED_HEADER]: "1" },
  });
}
