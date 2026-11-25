/**
 * `/sitemap-places-<lang>.xml` (#715, 2.1.13): the place pages in one language,
 * largest towns first (`site/sitemaps.ts`). The digest not answering is a 503,
 * never an empty urlset — an empty sitemap would tell an index that every place
 * page is gone.
 */
import type { APIRoute } from "astro";
import { isLang } from "../i18n/index.js";
import { readEnv } from "../lib/env.js";
import { fetchPlaceIndex } from "../lib/place.js";
import { isSitemapLang, placesLangXml } from "../site/sitemaps.js";
import { sitemapAnswer } from "../lib/sitemap-held.js";
import { INDEX_TIMEOUT_MS } from "./sitemap-places.xml.js";

export const GET: APIRoute = async ({ params }) => {
  const lang = params["lang"] ?? "";
  // #49: a language other than de and en has no sitemap (`SITEMAP_LANGS`)
  if (!isLang(lang) || !isSitemapLang(lang)) return new Response(null, { status: 404 });
  const env = readEnv();
  const index = await fetchPlaceIndex({ baseUrl: env.digestUrl, timeoutMs: INDEX_TIMEOUT_MS });
  // #1205: the digest not answering serves the last list this process built (a 200, logged), else the 503
  return sitemapAnswer(`sitemap-places-${lang}`, index === null || index.length === 0 ? null : placesLangXml(lang, index.map((i) => i.slug)), 300);
};
