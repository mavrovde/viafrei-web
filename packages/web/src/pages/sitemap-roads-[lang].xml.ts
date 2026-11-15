/**
 * `/sitemap-roads-<lang>.xml` (#1027): the indexable Bundes- and Landesstraße pages in one language
 * (`site/sitemaps.ts`) — a road with something in force or ended within seven days, the digest's rule. The digest not
 * answering, or answering with no road, is a 503 — never an empty urlset, which would tell an index that every road
 * page is gone.
 */
import type { APIRoute } from "astro";
import { isLang } from "../i18n/index.js";
import { readEnv } from "../lib/env.js";
import { ROAD_LIST_TIMEOUT_MS, fetchRoadList } from "../lib/road-page.js";
import { roadsLangXml } from "../site/sitemaps.js";
import { sitemapAnswer } from "../lib/sitemap-held.js";

export const GET: APIRoute = async ({ params }) => {
  const lang = params["lang"] ?? "";
  if (!isLang(lang)) return new Response(null, { status: 404 });
  const env = readEnv();
  const list = await fetchRoadList({ baseUrl: env.digestUrl, timeoutMs: ROAD_LIST_TIMEOUT_MS });
  // #1205: the digest not answering serves the last list this process built (a 200, logged), else the 503
  return sitemapAnswer(`sitemap-roads-${lang}`, list === null || list.length === 0 ? null : roadsLangXml(lang, list), 300);
};
