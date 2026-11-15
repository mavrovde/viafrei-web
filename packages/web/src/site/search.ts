/**
 * #1111: the site search's address — `/<lang>/search`, the same English word in every language (#892), outside the
 * page map: a results page is `noindex, follow`, kept off every sitemap (a page a sitemap lists and a search engine
 * is told not to index is a contradiction Search Console reports), `Disallow`ed in robots.txt, and probed by the
 * deploy like every page (`scripts/site-pages.txt`). The home's `SearchAction` points here.
 */
import { LIVE_LANGS, type Lang } from "./pages.js";

export const searchPath = (lang: Lang): `/${string}` => `/${lang}/search`;

/** Every language's search page, for the alternates of one. */
export const SEARCH_ALTERNATES: Readonly<Record<Lang, `/${string}`>> = Object.fromEntries(LIVE_LANGS.map((l) => [l, searchPath(l)])) as Record<Lang, `/${string}`>;

/** The robots.txt lines for it: the bare page and any query of it, never a path that merely begins with the word. */
export const SEARCH_DISALLOW: readonly string[] = ["/*/search$", "/*/search?"];

/** What a query may be: 2–60 characters once trimmed (the station search's bounds, the digest's `SEARCH_QUERY_MIN/MAX`). */
export const SEARCH_MIN = 2;
export const SEARCH_MAX = 60;
export const isSearchQuery = (q: string): boolean => q.trim().length >= SEARCH_MIN && q.trim().length <= SEARCH_MAX;
