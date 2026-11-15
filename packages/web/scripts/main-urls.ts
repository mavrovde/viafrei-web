/**
 * The site's MAIN URLs (#1110, owner 2026-11-01: "identify main urls and push them to bing") — derived from the page
 * map and the registers, never typed: the home, the motorway index, connect, business and developers in every live
 * language; every motorway page of the register; the place pages of the largest cities (`POPULAR_PLACES`, the chips
 * of the place sheet); and each further page family an SEO issue adds (`MainUrlFamily` names them).
 *
 * The ORDER is the submission priority, because Bing takes only its daily quota of a list
 * (`scripts/search-submit.mjs --urls`): the five site pages in German and English first, then the German place and
 * motorway pages, then the English ones, then every other language in the map's order.
 *
 *   npx tsx packages/web/scripts/main-urls.ts > /tmp/main-urls.txt
 *
 * `test/main-urls.test.ts` holds every line to the sitemaps robots.txt declares, a self-canonical and the English
 * slug rules.
 */
import { fileURLToPath } from "node:url";
import { SITE_ORIGIN } from "../src/site/endpoints.js";
import { MOTORWAY_REGISTER, motorwayPath } from "../src/site/motorways.js";
import { LIVE_LANGS, pathFor, type Lang, type PageId } from "../src/site/pages.js";
import { POPULAR_PLACES, placePath, popularSlug } from "../src/site/places.js";

/** The site pages that are main URLs in every language. */
export const MAIN_PAGES: readonly PageId[] = ["start", "motorways", "connect", "business", "developers"];

/** The page families a main URL belongs to — one test case each. */
export type MainUrlFamily = "page" | "place" | "motorway";
export type MainUrl = { readonly url: string; readonly lang: Lang; readonly family: MainUrlFamily };

function ofLang(lang: Lang, roads: readonly string[]): { readonly pages: MainUrl[]; readonly rest: MainUrl[] } {
  const at = (path: string, family: MainUrlFamily): MainUrl => ({ url: `${SITE_ORIGIN}${path}`, lang, family });
  return {
    pages: MAIN_PAGES.map((p) => at(pathFor(p, lang), "page")),
    rest: [...POPULAR_PLACES.map((p) => at(placePath(lang, popularSlug(p)), "place")), ...roads.map((r) => at(motorwayPath(lang, r), "motorway"))],
  };
}

/** Every main URL, in submission order, each once. */
export function mainUrls(roads: readonly string[] = MOTORWAY_REGISTER): readonly MainUrl[] {
  const [first, second, ...others] = LIVE_LANGS;
  const de = ofLang(first, roads);
  const en = ofLang(second, roads);
  const out = [...de.pages, ...en.pages, ...de.rest, ...en.rest, ...others.flatMap((l) => {
    const x = ofLang(l, roads);
    return [...x.pages, ...x.rest];
  })];
  const seen = new Set<string>();
  return out.filter((u) => (seen.has(u.url) ? false : (seen.add(u.url), true)));
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) process.stdout.write(mainUrls().map((u) => `${u.url}\n`).join(""));
