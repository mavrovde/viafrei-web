/**
 * TEMPORARY — THE LEGACY REDIRECTS OF #892, removed by #898 (v2.9.0).
 *
 * #892 gave every public address of viafrei.de a readable slug: English page
 * words in every language, `autobahn` as the motorway word everywhere, a place
 * by its stored name slug (`/de/place/muenchen`), a motorway stretch as a path
 * (`/de/autobahn/a7/nesselwang-to-kempten/towards-wuerzburg`). The addresses
 * before it are in search indexes and in other people's links, so each one
 * answers a 301 to its new address — ONE hop, never a chain — until #898 shows
 * nobody uses them any more and deletes this file.
 *
 * Everything legacy lives HERE and is wired at ONE place, the first lines of
 * `src/middleware.ts`; its test is `test/legacy-redirects.test.ts`. Removing
 * it is: this file, its test, the middleware's call, the `legacy` rows of
 * `scripts/site-pages.txt` (generated from `LEGACY_FIXED` below by
 * `scripts/site-map.ts`), and the two helpers it reads in the digest — the
 * `?ags=` direction of `/internal/place/key` and the BASt-code arm of
 * `filterOf` (both marked "#898").
 *
 * Every hit is COUNTED: one line on stderr, `{"kind":"legacy_redirect","key":<rule>}`,
 * the rule's name and nothing else — no address, no query value, no client
 * (`logLine`'s level 30). `docker logs viafrei-web | grep -c legacy_redirect`
 * (per rule: `grep '"key":"place-ags"'`) is the evidence #898 asks for.
 *
 * The rules, generated from the same builder as the new addresses (the page
 * map `pathFor`, `placePath`, `motorwayPath`, the digest's `Motorway-Path`) and
 * never typed as a list of addresses:
 *
 *   page-word    `/<lang>/neuigkeiten`, `/<lang>/beispiele` and the feed
 *                `/<lang>/neuigkeiten.xml` → the page's English path
 *   motorway     `/<lang>/motorway[/<rest>]` → `/<lang>/autobahn[/<rest>]`
 *   place-ort    `/<lang>/ort/<slug>` → `/<lang>/place/<slug>`; a typed name
 *                (`/de/ort/K%C3%B6ln`) → its one page by the name lookup, in the same hop
 *   place-ags    `/<lang>/{ort,place}/<AGS>[-<name>]` → `/<lang>/place/<stored slug>`
 *   stretch-lcl  `/<lang>/{autobahn,motorway}/<road>?from=<code>&to=<code>&dir=…`, or a
 *                bare `?dir=pos|neg` (no `from`/`to`: the form always sends both)
 *                → the stretch's path, the layers kept as the query
 *
 * A rule whose lookup the digest cannot answer passes the request on (the page
 * route then answers it as it would any address); a lookup the digest answers
 * with "no such place" passes it on too, and the page route's 404 stands. Two
 * exceptions keep the old WORD from surviving: a `/motorway/` stretch the
 * digest cannot name is the `motorway` rule's 301, and a typed `/ort/` name
 * with no single page is the 301 to `/place/<name>`, where the page route's
 * lookup offers the choice (a page, not a further redirect).
 */
import { LIVE_LANGS, pathFor, type Lang, type PageId } from "../site/pages.js";
import { isPlaceSlug, placePath, placesByName } from "../site/places.js";
import { cachedPlaceIndex } from "./place-page.js";
import { canonicalMotorway, motorwayPath } from "../site/motorways.js";
import { logLine } from "./log.js";
import { getFragment } from "./place.js";
import { fetchMotorwayPage, motorwayChoice, motorwayViewQuery } from "./motorway.js";
import type { TileFetchOptions } from "./tiles.js";
import { withDeadline } from "./fill.js";
import { budgetFrom, budgetLeft, withinBudget } from "./page-budget.js";

/** The rules, by the name each hit is counted under. */
export const LEGACY_RULES = ["page-word", "motorway", "place-ort", "place-ags", "stretch-lcl"] as const;
export type LegacyRule = (typeof LEGACY_RULES)[number];

/** The page words before #892, per page: German's own words (and, in every other language, their 301s). */
const FORMER_PAGE_WORDS: readonly { readonly id: PageId; readonly word: string }[] = [
  { id: "news", word: "neuigkeiten" },
  { id: "examples", word: "beispiele" },
];

/**
 * The fixed legacy addresses — every one a route of `scripts/site-pages.txt`
 * with the flags `redirect=<to>,legacy`, so the deploy probes each and the
 * two-vantage smoke compares each (`scripts/site-map.ts`).
 */
export const LEGACY_FIXED: readonly { readonly from: `/${string}`; readonly to: `/${string}` }[] = LIVE_LANGS.flatMap((lang) => [
  ...FORMER_PAGE_WORDS.map((w) => ({ from: `/${lang}/${w.word}` as const, to: pathFor(w.id, lang) })),
  { from: `/${lang}/neuigkeiten.xml` as const, to: `${pathFor("news", lang)}.xml` as const },
  { from: `/${lang}/motorway` as const, to: pathFor("motorways", lang) },
]);

/** What a legacy address needs: a fixed target, or a lookup the digest answers. */
export type LegacyDecision =
  | { readonly rule: LegacyRule; readonly to: `/${string}` }
  | { readonly rule: "place-ags"; readonly lang: Lang; readonly ags: string }
  /** A typed name (`/de/ort/Köln`): its one page by the name lookup, else `fallback` (the page route's own lookup then answers). */
  | { readonly rule: "place-ort"; readonly lang: Lang; readonly name: string; readonly fallback: `/${string}` }
  /** `fallback`: where a pre-#892 `/motorway/` address goes when the digest cannot name the stretch (never a 404). */
  | { readonly rule: "stretch-lcl"; readonly lang: Lang; readonly road: string; readonly params: URLSearchParams; readonly fallback: `/${string}` | null };

const isLang = (s: string): s is Lang => (LIVE_LANGS as readonly string[]).includes(s);

/** Which rule an address falls under, if any — pure, no digest. */
export function legacyDecision(url: URL): LegacyDecision | null {
  const path = url.pathname;
  const fixed = LEGACY_FIXED.find((f) => f.from === path);
  if (fixed !== undefined) return { rule: fixed.from.endsWith("/motorway") ? "motorway" : "page-word", to: fixed.to };
  const m = /^\/([a-z]{2})\/(ort|place|motorway|autobahn)\/(.+)$/.exec(path);
  if (m === null || !isLang(m[1]!)) return null;
  const lang = m[1];
  const seg = m[2]!;
  const rest = m[3]!;
  if (seg === "ort" || seg === "place") {
    const ags = /^(\d{8})(?:-[a-z0-9-]*)?$/.exec(rest);
    if (ags !== null) return { rule: "place-ags", lang, ags: ags[1]! };
    if (seg === "ort" && !rest.includes("/")) {
      // a slug-shaped name goes straight to its page; a typed one (`K%C3%B6ln`, `Frankfurt am Main`) is resolved to its
      // slug by the name lookup in the same hop (review 2.3.4), so the old address never takes a second redirect
      if (isPlaceSlug(rest)) return { rule: "place-ort", to: placePath(lang, rest) };
      return { rule: "place-ort", lang, name: decodeSafe(rest), fallback: placePath(lang, rest) };
    }
    return null;
  }
  // a motorway: a BASt location code in the query is the pre-#892 stretch, whichever word the path used
  const [first, ...more] = rest.split("/");
  const road = canonicalMotorway(decodeSafe(first ?? ""));
  const codes = ["from", "to"].some((k) => /^\d{1,6}$/.test(url.searchParams.get(k) ?? ""));
  // review 2.3.4: a bare `?dir=pos|neg` is a pre-#892 direction link too (the filter form always sends `from` and
  // `to`, so a form submission is not one) — one counted 301 to its `towards-` path, never the form's 303
  const dir = /^(pos|neg)$/.test(url.searchParams.get("dir") ?? "") && !url.searchParams.has("from") && !url.searchParams.has("to");
  if (road !== null && more.length === 0 && (codes || dir)) {
    return { rule: "stretch-lcl", lang, road, params: url.searchParams, fallback: seg === "motorway" ? `${motorwayPath(lang, road)}${url.search}` as `/${string}` : null };
  }
  if (seg === "motorway") {
    // one hop: an address naming no motorway number goes straight to the index (the new page would 301 it there again)
    if (road === null) return { rule: "motorway", to: pathFor("motorways", lang) };
    const tail = more.length === 0 ? motorwayPath(lang, road) : `${motorwayPath(lang, road)}/${more.join("/")}`;
    return { rule: "motorway", to: `${tail}${url.search}` as `/${string}` };
  }
  return null;
}

function decodeSafe(s: string): string {
  try {
    return decodeURIComponent(s);
  } catch {
    return "";
  }
}

/** Count one hit: the rule's name only (#898's evidence). */
export function countLegacyHit(rule: LegacyRule): void {
  logLine(30, { kind: "legacy_redirect", key: rule, status: 301 }, "a pre-#892 address was redirected (temporary, #898)");
}

const moved = (to: string): Response => new Response(null, { status: 301, headers: { location: to, "cache-control": "public, max-age=86400" } });

/**
 * The one entry point (`src/middleware.ts`): a 301 for a legacy address, or
 * null to pass the request on. Never throws: a lookup that fails passes it on.
 *
 * #1166: `endsAt` is the REQUEST's two-second budget (`locals.budgetEndsAt`), not a fresh one: the lookup gets what is
 * left of it, and the page a null passes the request on to reads under the same budget, so the lookup and the page's
 * own reads share the two seconds instead of adding up. The lookup is decided when the budget ends, whatever it does.
 */
export async function legacyRedirect(url: URL, o: TileFetchOptions, endsAt: number = budgetFrom()): Promise<Response | null> {
  const d = legacyDecision(url);
  if (d === null) return null;
  if ("to" in d) {
    countLegacyHit(d.rule);
    return moved(d.to);
  }
  return withDeadline(lookup(d, withinBudget(o, endsAt)), budgetLeft(endsAt), null);
}

async function lookup(d: Exclude<LegacyDecision, { readonly to: `/${string}` }>, o: TileFetchOptions): Promise<Response | null> {
  try {
    if (d.rule === "place-ags") {
      const r = await getFragment(`${o.baseUrl}/internal/place/key?ags=${d.ags}`, o, /^<p class="place-slug">/, "</p>");
      const slug = r.ok ? /^<p class="place-slug">([a-z0-9-]{1,80})<\/p>$/.exec(r.html.trim())?.[1] : undefined;
      if (slug === undefined) return null;
      countLegacyHit(d.rule);
      return moved(placePath(d.lang, slug));
    }
    if (d.rule === "place-ort") {
      const found = await placesNamed(d.name, o);
      countLegacyHit(d.rule);
      return moved(found !== null && found.length === 1 ? placePath(d.lang, found[0]!.slug) : d.fallback);
    }
    // stretch-lcl: the digest names the path the old codes' stretch has now
    const f = await fetchMotorwayPage(d.road, d.lang, o, motorwayChoice(d.params));
    if (f.kind !== "ok") {
      // a `/motorway/` address the digest cannot answer still leaves the old word, in the same one hop
      if (d.fallback === null) return null;
      countLegacyHit("motorway");
      return moved(d.fallback);
    }
    const view = motorwayViewQuery(d.params);
    countLegacyHit(d.rule);
    return moved(`${f.path ?? motorwayPath(d.lang, d.road)}${view === "" ? "" : `?${view}`}`);
  } catch {
    return null;
  }
}

/** The place pages a typed name stands for, off the cached index the page route reads too; null when there is no index. */
async function placesNamed(name: string, o: TileFetchOptions): Promise<readonly { readonly slug: string }[] | null> {
  const index = await cachedPlaceIndex(o);
  return index === null ? null : placesByName(index, name);
}
