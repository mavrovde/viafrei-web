/**
 * #1111: what the search page shows for its address — `?q=` (2–60 characters), optionally `&kind=<kind>&page=<n>`
 * (one kind's page of 20). No query: the box alone. A query with nothing found: the empty state (the nearest-spelled
 * place, read by the digest in the same answer, and the motorway index), never an empty page. A malformed kind or page is read as none / the first.
 */
import { t } from "../i18n/index.js";
import type { Lang } from "../site/pages.js";
import { isSearchQuery, SEARCH_MAX } from "../site/search.js";
import { esc } from "./answer-html.js";
import { isKind, renderNone, renderResults, siteSearch, type Kind } from "./site-search.js";
import type { TileFetchOptions } from "./tiles.js";

export type SearchPageAnswer = { readonly q: string; readonly html: string };

/**
 * #1111 AC 7 (2.5.8): how long the results page waits for the digest — its kinds answer within 1 200 ms
 * (`SEARCH_RESULTS_DEADLINE_MS`), so 1 500 ms leaves the render inside the two-second ceiling of a cold page even
 * when the digest does not answer at all. The 2 s a tile may take would put a hanging digest's page past it.
 */
export const SEARCH_PAGE_TIMEOUT_MS = 1_500;

export async function resolveSearchPage(lang: Lang, params: URLSearchParams, o: TileFetchOptions): Promise<SearchPageAnswer> {
  const q = (params.get("q") ?? "").trim().slice(0, SEARCH_MAX * 2);
  const k = params.get("kind") ?? "";
  const kind: Kind | null = isKind(k) ? k : null;
  const p = params.get("page") ?? "1";
  const page = /^[1-9]\d{0,2}$/.test(p) ? Number(p) : 1;
  if (q === "") return { q, html: "" };
  if (!isSearchQuery(q)) return { q, html: `<p class="ss-hint">${esc(t(lang, "search.hint"))}</p>` };
  const r = await siteSearch(lang, q, { ...o, timeoutMs: Math.min(o.timeoutMs, SEARCH_PAGE_TIMEOUT_MS) }, { mode: "page", kind, page });
  if (r !== null && r.groups.length > 0) return { q, html: renderResults(lang, q, r, { mode: "page", kind, page }) };
  const partial = r !== null && r.partial.length > 0 ? `<p class="ss-partial">${esc(t(lang, "search.partial"))}</p>` : "";
  // 2.5.8 (AC 4): the nearest spelling came in the same answer — no second ask of the digest on the empty path
  return { q, html: renderNone(lang, q, r?.nearest ?? null).replace(/<\/div>$/, `${partial}</div>`) };
}
