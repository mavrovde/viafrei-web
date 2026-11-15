/**
 * #1153: the header's ONE search suggests as you type — the place bar's suggestions (#1112) and the site search's
 * (#1111) in one list, grouped by kind (owner 2026-11-03: "one dynamic search field"). POST `/fragment/suggest`,
 * `{ q, lang }`; what was typed travels in the body, never in an address.
 *
 *  - "Orte": the digest's place suggestions (`/internal/place/suggest`) — a Gemeinde, a district, a postcode, a
 *    station's or an address's point, a point of interest. Each is a place KEY or a place page: picking one makes it
 *    the site-wide place (the location island takes the click). The motorway and junction lines that list carries
 *    (#1137) are left to the site search's own groups, so no road is listed twice.
 *  - the site search's groups (`site-search.ts`) for what is no place: the motorways, the Bundes- and Landesstraßen
 *    (2.5.8), the stations, the junctions, the site's pages and the News entries — ordinary links, followed.
 *
 * The groups are ordered by their best match (exact, then prefix, then a word), the kinds' order breaking a tie
 * (`ranked`), so "A7" leads with the motorway, "Köln Hbf" with the station and "Köln" with the place. Each credit
 * line the answers owe is printed once.
 */
import type { Lang } from "../site/pages.js";
import type { TileFetchOptions } from "./tiles.js";
import { fetchSuggest } from "./place.js";
import { t } from "../i18n/index.js";
import { esc } from "./answer-html.js";
import { renderNone, renderResults, score, siteSearch, type Group, type Kind, type Results } from "./site-search.js";

/** The site search's kinds the header lists beside the places (the places, areas and POIs are the place list's). */
export const HEADER_SITE_KINDS: readonly Kind[] = ["motorway", "road", "station", "exit", "page", "news"];

const ITEM = /<li class="place-sug[ "][\s\S]*?<\/li>/g;
const HREF = /<a class="place-opt" href="([^"]*)"/;
const NAME = /<span class="place-opt__name"[^>]*>([^<]*)<\/span>/;
const CREDIT = /<p\b[\s\S]*?<\/p>/g;

/**
 * A line of the place list that is a place: a key the island reads (`#…`), a place page, or (#1158) a station's page
 * with its point beside it (`data-at`), which the island keeps as a station with that page.
 */
export function isPlaceLine(li: string): boolean {
  const href = HREF.exec(li)?.[1] ?? "";
  return href.startsWith("#") || /\/place\/[a-z0-9-]+$/.test(href) || (/\/station\/[a-z0-9-]+$/.test(href) && /^<li class="place-sug[ "][^>]*><a class="place-opt" href="[^"]*" data-at="pt:[-\d.,]+" data-kind="station">/.test(li));
}

/** The digest's place list read back: its place lines and its credit lines; null when it is no such answer. */
export function placeLinesOf(html: string): { readonly items: readonly string[]; readonly credits: string } | null {
  if (!/^<div class="place-suggest[ "]/.test(html)) return null;
  const ul = /<ul class="place-suggest__list"[^>]*>([\s\S]*?)<\/ul>/.exec(html);
  const items = ul === null ? [] : [...(ul[1] ?? "").matchAll(ITEM)].map((m) => m[0]).filter(isPlaceLine);
  const credits = ul === null ? "" : html.slice((ul.index ?? 0) + ul[0].length).replace(/<\/div>\s*$/, "");
  return { items, credits };
}

/** Each credit line once, in the order first met. */
export function oneCreditEach(...parts: readonly string[]): string {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const p of parts)
    for (const m of p.matchAll(CREDIT)) {
      if (seen.has(m[0])) continue;
      seen.add(m[0]);
      out.push(m[0]);
    }
  return out.join("");
}

/**
 * #1111 AC 7 (2.5.8): how long the header's suggestions wait for the digest — a suggestion at p95 within 300 ms. The
 * 2 s a tile may take is a page's deadline, and the header used to wait for it on every keystroke.
 */
export const HEADER_SUGGEST_TIMEOUT_MS = 300;

/** The place list's mark that a stage of the digest's place read missed its deadline (`renderSuggestions`). */
const PLACE_PARTIAL = /^<div class="place-suggest[^"]* place-suggest--partial[ "]/;

/**
 * The merged list, as the header's results box shows it; the place list's own "no place" line when nothing answered.
 * Never nothing (2.5.8): a half that did not answer is left out and said ("some results not shown"), and when neither
 * answered the box says so in words — the route answers 200, never a 502 for a query it accepted.
 */
export function mergeSuggest(lang: Lang, q: string, placeHtml: string | null, site: Results | null): string {
  const places = placeHtml === null ? null : placeLinesOf(placeHtml);
  const placeLate = places === null || (placeHtml !== null && PLACE_PARTIAL.test(placeHtml));
  const sitePartial = site === null ? HEADER_SITE_KINDS : site.partial.filter((k) => HEADER_SITE_KINDS.includes(k));
  const partial: Kind[] = [...(placeLate ? (["place"] as const) : []), ...sitePartial];
  const groups: Group[] = [];
  if (places !== null && places.items.length > 0) {
    const best = Math.max(...places.items.map((li) => score(NAME.exec(li)?.[1] ?? "", q)));
    groups.push({ kind: "place", best, total: places.items.length, items: places.items.join("") });
  }
  for (const g of site?.groups ?? []) if (HEADER_SITE_KINDS.includes(g.kind)) groups.push(g);
  if (groups.length === 0) {
    if (placeHtml !== null && !placeLate && /^<div class="place-suggest place-suggest--none"/.test(placeHtml)) return placeHtml;
    const said = partial.length === 0 ? "" : `<p class="ss-partial">${esc(t(lang, "search.partial"))}</p>`;
    return renderNone(lang, q, null).replace(/<\/div>$/, `${said}</div>`);
  }
  return renderResults(lang, q, { groups, partial, credits: oneCreditEach(places?.credits ?? "", site?.credits ?? "") }, { mode: "suggest" });
}

/**
 * Both asks in parallel, each under the header's own deadline (`HEADER_SUGGEST_TIMEOUT_MS`): one that does not answer
 * leaves its groups out. Null only for what is no question (fewer than 2 or more than 80 characters).
 */
export async function headerSuggest(lang: Lang, q: string, o: TileFetchOptions): Promise<string | null> {
  const typed = q.trim();
  if (typed.length < 2 || typed.length > 80) return null;
  const fast: TileFetchOptions = { ...o, timeoutMs: Math.min(o.timeoutMs, HEADER_SUGGEST_TIMEOUT_MS) };
  const [p, s] = await Promise.all([fetchSuggest(typed, lang, fast), siteSearch(lang, typed, fast, { mode: "suggest" })]);
  return mergeSuggest(lang, typed, p, s);
}
