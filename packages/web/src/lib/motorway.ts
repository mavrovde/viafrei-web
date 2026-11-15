/**
 * The motorway fragments of #715 (2.1.13), fetched from the digest's internal
 * routes like every tile: one GET, a deadline, an answer that is not
 * recognisably ours is no answer, and nothing here throws past the caller.
 *
 * WHERE THE CACHING IS (owner 2026-10-14, "precompute plus cache"): the pages
 * carry a per-request CSP nonce, so a whole page is not cacheable at the edge
 * and the site says `no-store` on it. The caching is one level down, at the
 * FRAGMENT: the digest answers each motorway fragment with an ETag derived
 * from the per-motorway summary's version and the bytes, and this module keeps
 * the last body per URL and asks again with `If-None-Match`, so a fragment that
 * did not change costs the digest a 304 and no render. The digest's own cache
 * is the second level (`packages/digest/src/server/motorway-service.ts`).
 */
import { MOTORWAY_FILTER_KINDS, showQuery } from "./motorway-filter.js";
import { carriesChargingFilterForm, chargingFilterForward } from "./charging-filter.js";
import type { Lang } from "../site/pages.js";
import { MOTORWAY_NUMBER } from "../site/motorways.js";
import { mapQuery, type FetchLike, type TileFetchOptions } from "./tiles.js";
import { logFragmentFailure } from "./log.js";
import { viaFragmentCache } from "./fragment-cache.js";
import { MOTORWAY_TOP_KEPT_SECONDS, keepHome, keptHome } from "./home-kept.js";
import { digestFetch } from "./agent-class.js";

/**
 * At most this many fragments are kept. Sized at 2.1.13 for 122 motorways × the seven languages of then plus the
 * indexes and lists; since #753 the site has 22 languages (2 684 motorway pages), more than this count — the byte
 * bound below is the one that holds (16 MiB is ~110 Latin or ~55 Cyrillic or Greek fragments of the A7's size),
 * so the count only caps the many small entries.
 */
export const MOTORWAY_FRAGMENT_CACHE_MAX = 1_000;
/**
 * …and at most this many BYTES of them (2.1.15 review S1): the shell runs in
 * 128 MB with a 96 MB old space, and an A7 fragment is 131–150 KB of text
 * since the map, so a count bound alone could hold over 100 MB. Measured as
 * V8 holds the text (`heapBytesOf`); the least recently used goes first.
 */
export const MOTORWAY_FRAGMENT_CACHE_BYTES = 16 * 1024 * 1024;

/** What a string costs on V8's heap: one byte a character while all are Latin-1, two once one is not (the digest's `heapBytesOf`; the shell imports no digest module). */
export function heapBytesOf(s: string): number {
  return s.length * (/[\u0100-\uffff]/.test(s) ? 2 : 1);
}

/**
 * 2.4.6 (prod 2026-10-28 08:20Z: the A8's page a 503 after its fragment missed the 8 s deadline on a busy database):
 * a bare page whose fragment did not arrive — a deadline, a 5xx, a refused connection — is answered from the copy
 * kept here for revalidation, for at most this long after it was last confirmed (a 200 or a 304). The fragment states
 * its own instants, so the page says how old it is; past this age a miss is a miss.
 */
export const MOTORWAY_KEPT_SERVE_SECONDS = 1_800;

type Kept = { readonly etag: string; readonly html: string; readonly bytes: number; readonly at: number };
const kept = new Map<string, Kept>();
let keptBytes = 0;

/** Forget every kept fragment (tests). */
export function clearMotorwayFragments(): void {
  kept.clear();
  keptBytes = 0;
}

/** The kept fragments: how many, and what they cost (tests). */
export function motorwayFragmentsKept(): { readonly entries: number; readonly bytes: number } {
  return { entries: kept.size, bytes: keptBytes };
}

function forget(url: string): void {
  const k = kept.get(url);
  if (k === undefined) return;
  keptBytes -= k.bytes;
  kept.delete(url);
}

function keep(url: string, etag: string, html: string): void {
  const bytes = heapBytesOf(html) + heapBytesOf(url) + etag.length;
  forget(url);
  // larger than the whole bound: served, never kept
  if (bytes > MOTORWAY_FRAGMENT_CACHE_BYTES) return;
  kept.set(url, { etag, html, bytes, at: Date.now() });
  keptBytes += bytes;
  while (kept.size > MOTORWAY_FRAGMENT_CACHE_MAX || keptBytes > MOTORWAY_FRAGMENT_CACHE_BYTES) {
    const oldest = kept.keys().next().value;
    if (oldest === undefined) break;
    forget(oldest);
  }
}

/**
 * A revalidated fragment moves to the newest end: the bound drops the least
 * recently USED. Only while it is still the kept entry — another request may
 * have evicted or replaced it during the 304's round trip, and re-inserting
 * it then would hold bytes `keptBytes` no longer counts.
 */
function touch(url: string, k: Kept): void {
  if (kept.get(url) !== k) return;
  kept.delete(url);
  kept.set(url, { ...k, at: Date.now() });
}

/** `path` (#892): the digest's `Motorway-Path`, the address the asked choice HAS — absent on the index and the lists. */
export type MotorwayFetched = { readonly kind: "ok"; readonly html: string; readonly revalidated: boolean; readonly path?: string } | { readonly kind: "missing" } | { readonly kind: "failed"; readonly reason: string };

/**
 * One fragment: 200 → the body (kept with its ETag), 304 → the kept body,
 * 404 → missing (the digest does not hold that motorway), anything else failed.
 */
/** `serveKept` (2.4.6): a miss is answered from the kept copy (`MOTORWAY_KEPT_SERVE_SECONDS`) — the pages, the index and the list; the home's panel keeps its own bound (`home-kept.ts`). */
export async function getMotorwayFragment(url: string, o: TileFetchOptions, shape: RegExp, end: string, keepIt = true, serveKept = false): Promise<MotorwayFetched> {
  const t0 = Date.now();
  const r = await getMotorwayFragmentRaw(url, o, shape, end, keepIt);
  // #741: a fragment that did not arrive is a line; `missing` (a 404) is an answer.
  if (r.kind === "failed") {
    const m = /^HTTP (\d{3})$/.exec(r.reason);
    logFragmentFailure(url, m === null ? null : Number(m[1]), r.reason, Date.now() - t0);
    // 2.4.6: a kept copy of a bare page answers a miss (`MOTORWAY_KEPT_SERVE_SECONDS`) — never a 503 the copy could have spared
    const k = keepIt && serveKept ? kept.get(url) : undefined;
    if (k !== undefined && Date.now() - k.at < MOTORWAY_KEPT_SERVE_SECONDS * 1000) return { kind: "ok", html: k.html, revalidated: false };
  }
  return r;
}

async function getMotorwayFragmentRaw(url: string, o: TileFetchOptions, shape: RegExp, end: string, keepIt: boolean): Promise<MotorwayFetched> {
  const fetchImpl: FetchLike = o.fetchImpl ?? ((u, init) => digestFetch(u, init));
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), o.timeoutMs);
  // #716 M30: a person's stretch/direction/layer choice never reaches a cache that outlives the request.
  const prior = keepIt ? kept.get(url) : undefined;
  try {
    const headers: Record<string, string> = { accept: "text/html" };
    if (prior !== undefined) headers["if-none-match"] = prior.etag;
    const res = await fetchImpl(url, { signal: controller.signal, headers });
    const path = res.headers.get("motorway-path");
    const at = path !== null && /^\/[a-z]{2}\/autobahn\/a[1-9][0-9]{0,2}(?:\/[a-z0-9]+(?:-[a-z0-9]+)*){0,2}$/.test(path) ? { path } : {};
    if (res.status === 304 && prior !== undefined) {
      touch(url, prior);
      return { kind: "ok", html: prior.html, revalidated: true, ...at };
    }
    if (res.status === 404) return { kind: "missing" };
    if (res.status !== 200) return { kind: "failed", reason: `HTTP ${res.status}` };
    if (!(res.headers.get("content-type") ?? "").startsWith("text/html")) return { kind: "failed", reason: "not text/html" };
    const body = await res.text();
    if (!shape.test(body) || !body.trimEnd().endsWith(end) || /<script|<style|javascript:/i.test(body)) return { kind: "failed", reason: "not a motorway fragment" };
    const etag = res.headers.get("etag");
    if (keepIt && etag !== null && /^"[!#-~]{1,80}"$/.test(etag)) keep(url, etag, body);
    return { kind: "ok", html: body, revalidated: false, ...at };
  } catch (err) {
    return { kind: "failed", reason: err instanceof Error && err.name === "AbortError" ? `timeout after ${o.timeoutMs} ms` : String(err) };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * The person's choice on a motorway page (#716, #892): the stretch and the
 * direction from the PATH (`segments`, at most two: `nesselwang-to-kempten`,
 * `exit-138-nesselwang`, `towards-wuerzburg`), the form's fields (`from`,
 * `to`: junction slugs; `dir`: pos/neg) and the layers (`layer`, with `f=1`
 * when the form was sent) — only these names, each by its own shape, in a
 * fixed order. Empty: the bare page. Anything else in the address is dropped.
 *
 * LEGACY (#892, removed by #898): `from`/`to` may be BASt location codes; the
 * shell's temporary 301 (`site/legacy-redirects.ts`) is the one caller that
 * sends them.
 */
/**
 * #996 (2.3.23): the search text of a motorway page (`?find=`), by the digest's own rule (`pageSearchOf`): letters (an
 * umlaut too), digits, spaces and `.-()/`, at most `MOTORWAY_SEARCH_MAX` characters. "" for none. Not `q`: no measured
 * page but the motorway index carries a parameter Google reads as a site search (privacy page § 5, "Suche").
 */
export const MOTORWAY_SEARCH_MAX = 60;
export function motorwaySearchText(params: URLSearchParams): string {
  return (params.get("find") ?? "")
    .normalize("NFC")
    .replace(/[^\p{L}\p{N} .\-()/]/gu, " ")
    .replace(/\s+/gu, " ")
    .trim()
    .slice(0, MOTORWAY_SEARCH_MAX);
}

export function motorwayChoice(params: URLSearchParams, segments: readonly string[] = []): string {
  const out: string[] = [];
  const seg = (v: string): boolean => /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(v) && v.length <= 80;
  const [first, second] = segments;
  if (first !== undefined && seg(first)) {
    if (first.startsWith("towards-") && second === undefined) out.push(`towards=${first}`);
    else out.push(`stretch=${first}`);
  }
  if (second !== undefined && seg(second)) out.push(`towards=${second}`);
  for (const k of ["from", "to"] as const) {
    const v = params.get(k);
    if (v !== null && (/^\d{1,6}$/.test(v) || seg(v))) out.push(`${k}=${v}`);
  }
  const dir = params.get("dir");
  if (dir === "pos" || dir === "neg") out.push(`dir=${dir}`);
  // #1061: a no-script "?<card>=N" opens that card's first N pages in place (the digest answers it no-store; noindex here)
  for (const k of MOTORWAY_FILTER_KINDS) {
    const v = params.get(k);
    if (v !== null && /^[2-9]$|^[1-9][0-9]$/.test(v)) {
      out.push(`${k}=${v}`);
      break;
    }
  }
  if (params.get("f") === "1") {
    out.push("f=1");
    for (const l of MOTORWAY_LAYERS) if (params.getAll("layer").includes(l)) out.push(`layer=${l}`);
  }
  // #996: a search is a choice like a stretch — sent to the digest, never kept (the digest answers it no-store)
  const q = motorwaySearchText(params);
  if (q !== "") out.push(`find=${encodeURIComponent(q)}`);
  // #1081: the charging list's filter — read from the held rows, never kept (the digest answers it no-store)
  const ev = chargingFilterForward(params);
  if (ev !== "") out.push(ev);
  return out.join("&");
}

/** The view options of a motorway address (#892): the layers, which stay a query and are never part of the path. */
export function motorwayViewQuery(params: URLSearchParams): string {
  // #890: the radius of "around you" is a view option too — kept by a redirect, dropped by the canonical.
  const r = params.get("r");
  const radius = r !== null && /^\d{1,3}$/.test(r) ? [`r=${r}`] : [];
  // #901 D9: the type filter's choice is a view option too (the registry's kinds only, never a position).
  const show = showQuery(params);
  // #996: the search survives a redirect to the canonical path of the stretch it was asked on.
  const q = motorwaySearchText(params);
  // #1081: the charging filter survives a redirect too
  const ev = chargingFilterForward(params);
  const tail = [...radius, ...(show === "" ? [] : [show]), ...(q === "" ? [] : [`find=${encodeURIComponent(q)}`]), ...(ev === "" ? [] : [ev])];
  if (params.get("f") !== "1") return tail.join("&");
  return ["f=1", ...MOTORWAY_LAYERS.filter((l) => params.getAll("layer").includes(l)).map((l) => `layer=${l}`), ...tail].join("&");
}

/** How the digest's filter form begins (`filterHtml` in `presentation/motorway-layers-html.ts`). */
export const MOTORWAY_FORM_MARK = '<form class="motorway__filter"';

/**
 * Whether a motorway fragment carries the filter form (2.1.15 review): the
 * page's `form-action 'self'` follows the fragment it embeds, so a fragment
 * without the form (a road with no junction to choose) keeps `'none'`.
 */
/** #996: how the digest's search form on a motorway page begins (`searchHtml` in `presentation/motorway-search-html.ts`). */
export const MOTORWAY_SEARCH_FORM_MARK = '<form class="mws__form"';

export function carriesMotorwayForm(html: string): boolean {
  return html.includes(MOTORWAY_FORM_MARK) || html.includes(MOTORWAY_SEARCH_FORM_MARK) || carriesChargingFilterForm(html);
}

/** The layer names the digest's filter knows (`LAYER_IDS` of `analysis/motorway-view.ts`, pinned by `test/motorway-716.test.ts`). */
export const MOTORWAY_LAYERS = ["events", "parking", "charging", "weather", "cameras"] as const;

/** One motorway's page fragment (`road` canonical, `A7`), for the person's choice (`motorwayChoice`; "" for the bare page, the only one kept). */
export function fetchMotorwayPage(road: string, lang: Lang, o: TileFetchOptions, choice = ""): Promise<MotorwayFetched> {
  if (!MOTORWAY_NUMBER.test(road)) return Promise.resolve({ kind: "missing" });
  return getMotorwayFragment(`${o.baseUrl}/internal/motorway/${road}?lang=${lang}${choice === "" ? "" : `&${choice}`}${mapQuery(o)}`, { ...o, fetchImpl: viaFragmentCache(o) }, /^<section class="motorway" id="motorway"/, "</section>", choice === "", true);
}

/**
 * The index's search and order (#716 C1, 2.1.16): `q` and `sort=worst`/`sort=number` (#1182: the bare index is
 * most-affected first) —
 * only these, each by its own shape. Empty: the bare index, the only one kept.
 * #996 (2.3.23): `q` is a motorway number (at most 12 characters, as before) or
 * a junction or a town (letters, an umlaut too, digits, spaces, `.` and `-`, at
 * most 40) — the digest's `indexQueryOf` rule.
 */
export function motorwayIndexChoice(params: URLSearchParams): string {
  const out: string[] = [];
  const raw = params.get("q") ?? "";
  const q = raw
    .normalize("NFC")
    .replace(/[^\p{L}\p{N} .\-]/gu, "")
    .replace(/\s+/gu, " ")
    .trim()
    .slice(0, /\d/u.test(raw) ? 12 : 40);
  if (q !== "") out.push(`q=${encodeURIComponent(q)}`);
  // #1182: the bare index is most-affected first; the natural order is the one asked for by name
  const sort = params.get("sort");
  if (sort === "worst" || sort === "number") out.push(`sort=${sort}`);
  return out.join("&");
}

/** The index fragment, for the person's search and order (`motorwayIndexChoice`; "" for the bare index, the only one kept). */
export function fetchMotorwayIndex(lang: Lang, o: TileFetchOptions, choice = ""): Promise<MotorwayFetched> {
  return getMotorwayFragment(`${o.baseUrl}/internal/motorway/index?lang=${lang}${choice === "" ? "" : `&${choice}`}${mapQuery(o)}`, { ...o, fetchImpl: viaFragmentCache(o) }, /^<section class="motorways" id="motorway-index"/, "</section>", choice === "", true);
}

/**
 * The home's compact catalogue (#716 C1): the motorways most affected now. #772: a panel that did not arrive inside
 * the deadline (or failed) is answered from the home's own last good one (`lib/home-kept.ts`) for as long as the
 * digest would answer its own held panel; the LRU above cannot promise that, because a walk over the motorway pages
 * evicts it.
 */
export async function fetchMotorwayTop(lang: Lang, o: TileFetchOptions): Promise<MotorwayFetched> {
  // No `map=` (#944 review): the panel carries no map link, and its kept copy below is keyed by language alone — a
  // platform in the URL would let one platform's render answer another's miss the day the panel gains a map link.
  const r = await getMotorwayFragment(`${o.baseUrl}/internal/motorway/top?lang=${lang}`, { ...o, fetchImpl: viaFragmentCache(o) }, /^<section class="motorway-top" id="motorway-top"/, "</section>");
  if (r.kind === "ok") keepHome("motorway-top", lang, r.html, MOTORWAY_TOP_KEPT_SECONDS);
  if (r.kind !== "failed") return r;
  const k = keptHome("motorway-top", lang);
  return k === null ? r : { kind: "ok", html: k.html, revalidated: false };
}

/** Every motorway the register holds, in natural order, read off the digest's list (the sitemap's source). */
export async function fetchMotorwayList(o: TileFetchOptions): Promise<readonly string[] | null> {
  const r = await getMotorwayFragment(`${o.baseUrl}/internal/motorway/list`, o, /^<ul class="motorway-list">/, "</ul>", true, true);
  if (r.kind !== "ok") return null;
  return [...r.html.matchAll(/<a href="\/de\/autobahn\/(a[1-9][0-9]{0,2})">/g)].map((m) => (m[1] ?? "").toUpperCase());
}

/** One indexable exit page of the digest's exit register (#1025): its motorway, its path segment, and the day its live state last started moving (null: none stated). */
export type ExitRegisterEntry = { readonly road: string; readonly slug: string; readonly day: string | null };

/** The shape of an exit segment (`exit-1-hamburg-horn`, `exit-nesselwang`): what `exitSlug` builds and nothing else. */
export const EXIT_SEGMENT = /^exit(?:-[a-z0-9]+)+$/;

/** The register's text, read line by line: a line that is not `road \t segment \t day|-` in its shapes is dropped, never guessed. */
export function parseExitRegister(text: string): readonly ExitRegisterEntry[] {
  const out: ExitRegisterEntry[] = [];
  for (const line of text.split("\n")) {
    const [road, slug, day, ...rest] = line.split("\t");
    if (road === undefined || slug === undefined || day === undefined || rest.length > 0) continue;
    if (!MOTORWAY_NUMBER.test(road) || !EXIT_SEGMENT.test(slug) || !(day === "-" || /^\d{4}-\d{2}-\d{2}$/.test(day))) continue;
    out.push({ road, slug, day: day === "-" ? null : day });
  }
  return out;
}

/**
 * #1025: the indexable exit pages, from the digest's exit register (`/internal/motorway/exits`) — null when the
 * register does not answer 200 (its first lap not complete, a failure, a timeout): the sitemap is then a 503,
 * never an empty urlset that would tell an index every exit page had gone.
 */
export async function fetchExitRegister(o: TileFetchOptions): Promise<readonly ExitRegisterEntry[] | null> {
  const fetchImpl: FetchLike = o.fetchImpl ?? ((u, init) => digestFetch(u, init));
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), o.timeoutMs);
  try {
    const res = await fetchImpl(`${o.baseUrl}/internal/motorway/exits`, { signal: controller.signal, headers: { accept: "text/plain" } });
    if (res.status !== 200 || !(res.headers.get("content-type") ?? "").startsWith("text/plain")) return null;
    return parseExitRegister(await res.text());
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
