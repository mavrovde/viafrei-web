/**
 * THE SITEMAP RULE (#715, 2.1.13; #49), in one place:
 *
 *   - The sitemaps are in the SITEMAP LANGUAGES only (#49, owner 2026-11-25: "there must be only en and de, anything
 *     else must be pruned"): `SITEMAP_LANGS`, de and en. robots.txt and every index name the de and en files alone, a
 *     per-language file of another language answers 404, and a `<loc>` is a de or en address. The pages themselves
 *     are untouched: every language still answers, with its own head (robots, canonical, hreflang). An entry of the
 *     pages, motorway and Land files carries its hreflang alternates in EVERY live language and x-default, as the
 *     page's head does; the place, exit, station and road files list address and lastmod only, each page's
 *     alternates being in its own head (2.4.2, see `plainEntry`). `test/sitemaps.test.ts` holds each file to it.
 *   - The large lists are split PER LANGUAGE: `/sitemap-places-<lang>.xml`
 *     (every Gemeinde of 10 000 people or more, the digest's place index),
 *     `/sitemap-motorways-<lang>.xml` (every motorway of the register) and,
 *     since #1025, `/sitemap-exits-<lang>.xml` (the exit pages the exit rule
 *     indexes; a `noindex` exit is never listed) and, since #1041,
 *     `/sitemap-stations-<lang>.xml` (every DB station's page) and, since #1027,
 *     `/sitemap-roads-<lang>.xml` (the indexable Bundes- and Landesstraße pages) and, since #1074,
 *     `/sitemap-states-<lang>.xml` (the sixteen Land pages, with their alternates).
 *   - NO ENERGY SITEMAP (#49 A): the charging site pages (#1076) are in no sitemap since #49 — their part files held
 *     about 1.84 million URLs across 22 languages and took most of a search engine's crawl for discovery. The pages
 *     still answer 200 and stay linked from their place, station and motorway pages; `/sitemap-charging.xml` and its
 *     part files answer 404. A fuel station's page was never in one (#1167, data-steward 2026-11-04 S1: the list
 *     would be the MTS-K station set; `site/energy.ts`).
 *   - `/sitemap-index.xml` names every sitemap; `/sitemap-places.xml` (the
 *     address search engines already hold since #564) is an index of the place
 *     files. `/sitemap.xml` stays the one urlset of the page map in the sitemap
 *     languages, because the deploy's IndexNow diff reads its `<loc>`s
 *     (`the deploy`) and a sitemap index there would submit sitemap
 *     addresses as pages. `robots.txt` names every one of them.
 *   - Large towns first: the place files keep the digest's order, population
 *     descending (`GEMEINDE_INDEX_SQL`); motorways in natural order (A1, A2, …).
 *   - `lastmod` is REAL on every entry: the day that page's content last
 *     changed (`generated/lastmod.json`, per page and language — the place and
 *     motorway pages by their template, since a live figure is not a change a
 *     search engine should re-read daily for), and in an index the newest day
 *     of the file it names. Never the build's or the request's day.
 */
import { DEFAULT_LANG, LIVE_LANGS, PAGES, type Lang } from "./pages.js";
import { SITE_ORIGIN } from "./endpoints.js";
import { lastmodOf } from "./lastmod.js";
import { placePath } from "./places.js";
import { motorwayExitPath, motorwayPath } from "./motorways.js";
import { stationPath } from "./stations.js";
import { roadPath } from "./roads.js";
import { statePath } from "./states.js";

/** #49: the languages a sitemap lists — de and en; every other language's sitemap is retired. */
export const SITEMAP_LANGS: readonly Lang[] = ["de", "en"];
/** True when `lang` has sitemaps (`SITEMAP_LANGS`): a per-language sitemap route of any other language answers 404. */
export const isSitemapLang = (lang: Lang): boolean => SITEMAP_LANGS.includes(lang);

export const SITEMAP_INDEX = "/sitemap-index.xml";
export const PAGES_SITEMAP = "/sitemap.xml";
export const PLACES_INDEX = "/sitemap-places.xml";
export const placesSitemap = (lang: Lang): `/${string}` => `/sitemap-places-${lang}.xml`;
export const motorwaysSitemap = (lang: Lang): `/${string}` => `/sitemap-motorways-${lang}.xml`;
/** #1025: the indexable exit pages of one language (`/sitemap-exits-<lang>.xml`). */
export const exitsSitemap = (lang: Lang): `/${string}` => `/sitemap-exits-${lang}.xml`;
/** #1041: the station pages of one language (`/sitemap-stations-<lang>.xml`). */
export const stationsSitemap = (lang: Lang): `/${string}` => `/sitemap-stations-${lang}.xml`;
/** #1027: the indexable road pages of one language (`/sitemap-roads-<lang>.xml`). */
export const roadsSitemap = (lang: Lang): `/${string}` => `/sitemap-roads-${lang}.xml`;
/** #1074: the sixteen Land pages of one language (`/sitemap-states-<lang>.xml`). */
export const statesSitemap = (lang: Lang): `/${string}` => `/sitemap-states-${lang}.xml`;

/** Every sitemap the site serves, the index first; robots.txt names each. #49: the de and en files only, no energy file. */
export const ALL_SITEMAPS: readonly `/${string}`[] = [SITEMAP_INDEX, PAGES_SITEMAP, PLACES_INDEX, ...SITEMAP_LANGS.map(placesSitemap), ...SITEMAP_LANGS.map(motorwaysSitemap), ...SITEMAP_LANGS.map(exitsSitemap), ...SITEMAP_LANGS.map(stationsSitemap), ...SITEMAP_LANGS.map(roadsSitemap), ...SITEMAP_LANGS.map(statesSitemap)];

const HEAD = `<?xml version="1.0" encoding="UTF-8"?>\n`;
const URLSET = `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">`;

/** One `<url>`: its loc in `lang`, its lastmod, and the alternates of every live language. */
function urlEntry(lang: Lang, pathOf: (l: Lang) => string, day: string | null): string {
  const alts = LIVE_LANGS.map((l) => `<xhtml:link rel="alternate" hreflang="${l}" href="${SITE_ORIGIN}${pathOf(l)}"/>`)
    .concat(`<xhtml:link rel="alternate" hreflang="x-default" href="${SITE_ORIGIN}${pathOf(DEFAULT_LANG)}"/>`)
    .join("");
  return `<url><loc>${SITE_ORIGIN}${pathOf(lang)}</loc>${day === null ? "" : `<lastmod>${day}</lastmod>`}${alts}</url>`;
}

/**
 * An entry of a sitemap that lists pages by the thousand — places, exits, stations — is its address and lastmod
 * only (2.4.2 evidence). With 23 hreflang links an entry, the station file was 12.3 MB in one language and 95 % of
 * it alternates; building it twice at once took the shell past its 192 MiB limit and the kernel killed it
 * (oom_kills 2026-10-26 16:51 UTC, while the search consoles read the 91 sitemaps). Each of these pages declares
 * the same reciprocal set in its own `<head>` (`Base.astro`, held by the seo sweep), which search engines read as
 * the same statement; the small files (pages, motorways) keep the alternates.
 */
function plainEntry(lang: Lang, pathOf: (l: Lang) => string, day: string | null): string {
  return `<url><loc>${SITE_ORIGIN}${pathOf(lang)}</loc>${day === null ? "" : `<lastmod>${day}</lastmod>`}</url>`;
}

export const urlset = (entries: readonly string[]): string => `${HEAD}${URLSET}${entries.join("")}</urlset>\n`;

/** The place pages in one language, in the order given (the digest's: population descending). */
export function placesLangXml(lang: Lang, slugs: readonly string[], day: string | null = lastmodOf("place", lang)): string {
  return urlset(slugs.map((slug) => plainEntry(lang, (l) => placePath(l, slug), day)));
}

/** The motorway pages in one language, natural order. */
export function motorwaysLangXml(lang: Lang, roads: readonly string[], day: string | null = lastmodOf("motorway", lang)): string {
  return urlset(roads.map((road) => urlEntry(lang, (l) => motorwayPath(l, road), day)));
}

/**
 * #1025: the indexable exit pages in one language, in the register's order (road order per motorway). An exit's
 * lastmod is the newer of the exit template's day and the day its live state last started moving — so it moves
 * when something new is reported there, and never says a day older than the page's own template.
 */
export function exitsLangXml(lang: Lang, exits: readonly { readonly road: string; readonly slug: string; readonly day: string | null }[], template: string | null = lastmodOf("motorway", lang)): string {
  return urlset(exits.map((e) => plainEntry(lang, (l) => motorwayExitPath(l, e.road, e.slug), newestDay([template, e.day]))));
}

/**
 * #1041: the station pages in one language, in the digest's order (by slug). A page's lastmod is the newer of the
 * station template's day and the day its record last changed — a closure or a rename moves it, a live figure does not.
 */
export function stationsLangXml(lang: Lang, stations: readonly { readonly slug: string; readonly day: string | null }[], template: string | null = lastmodOf("stations", lang)): string {
  return urlset(stations.map((st) => plainEntry(lang, (l) => stationPath(l, st.slug), newestDay([template, st.day]))));
}

/**
 * #1027: the indexable road pages in one language, in the digest's order (by id). A road's lastmod is the day an item
 * on it last appeared or ended — the digest's, never the request's.
 */
export function roadsLangXml(lang: Lang, roads: readonly { readonly id: string; readonly day: string | null }[]): string {
  return urlset(roads.map((r) => plainEntry(lang, (l) => roadPath(l, r.id), r.day)));
}

/**
 * #1074: the sixteen Land pages in one language, in AGS order (the digest's list). Sixteen entries: each carries its
 * alternates like the motorway file's. A Land's lastmod is the day of the listing it was last shown from — the
 * digest's, never the request's.
 */
export function statesLangXml(lang: Lang, states: readonly { readonly slug: string; readonly day: string | null }[]): string {
  return urlset(states.map((st) => urlEntry(lang, (l) => statePath(l, st.slug), st.day)));
}

/** The newest of some days, or null when none is known. */
export const newestDay = (days: readonly (string | null)[]): string | null => days.filter((d): d is string => d !== null).sort().at(-1) ?? null;

/** A sitemap index: each file with the newest lastmod of what it lists. */
export function sitemapIndexXml(files: readonly { readonly path: `/${string}`; readonly lastmod: string | null }[]): string {
  const body = files.map((f) => `<sitemap><loc>${SITE_ORIGIN}${f.path}</loc>${f.lastmod === null ? "" : `<lastmod>${f.lastmod}</lastmod>`}</sitemap>`).join("");
  return `${HEAD}<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${body}</sitemapindex>\n`;
}

/**
 * The files `/sitemap-index.xml` names, with their real lastmod. `exitsDay`: the newest day of the exit register
 * (#1025) when the index could read it; an exit file's lastmod is the newer of it and the exit template's day.
 * `stationsDay` (#1041): the newest day of the station list, the same way.
 */
export function indexFiles(exitsDay: string | null = null, stationsDay: string | null = null, roadsDay: string | null = null, statesDay: string | null = null): readonly { readonly path: `/${string}`; readonly lastmod: string | null }[] {
  const pagesDay = newestDay(PAGES.filter((p) => p.id !== "404").flatMap((p) => SITEMAP_LANGS.map((l) => lastmodOf(p.id, l))));
  return [
    { path: PAGES_SITEMAP, lastmod: pagesDay },
    ...SITEMAP_LANGS.map((l) => ({ path: placesSitemap(l), lastmod: lastmodOf("place", l) })),
    ...SITEMAP_LANGS.map((l) => ({ path: motorwaysSitemap(l), lastmod: lastmodOf("motorway", l) })),
    ...SITEMAP_LANGS.map((l) => ({ path: exitsSitemap(l), lastmod: newestDay([lastmodOf("motorway", l), exitsDay]) })),
    ...SITEMAP_LANGS.map((l) => ({ path: stationsSitemap(l), lastmod: newestDay([lastmodOf("stations", l), stationsDay]) })),
    // #1027: a road file's lastmod is the newest day of the road list (no template day: the page is the digest's)
    ...SITEMAP_LANGS.map((l) => ({ path: roadsSitemap(l), lastmod: roadsDay })),
    // #1074: a Land file's lastmod is the newest day of the Land list
    ...SITEMAP_LANGS.map((l) => ({ path: statesSitemap(l), lastmod: statesDay })),
  ];
}

/** The place files `/sitemap-places.xml` names. */
export const placeIndexFiles = (): readonly { readonly path: `/${string}`; readonly lastmod: string | null }[] => SITEMAP_LANGS.map((l) => ({ path: placesSitemap(l), lastmod: lastmodOf("place", l) }));

export const XML_HEADERS = { "Content-Type": "application/xml; charset=utf-8", "Cache-Control": "public, max-age=3600" } as const;
