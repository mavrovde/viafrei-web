/**
 * `/sitemap-stations-<lang>.xml` (#1041): every DB station's page in one
 * language (`site/sitemaps.ts`). The digest not answering, or answering with
 * no station, is a 503 — never an empty urlset, which would tell an index that
 * every station page is gone.
 */
import type { APIRoute } from "astro";
import { isLang } from "../i18n/index.js";
import { readEnv } from "../lib/env.js";
import { STATION_LIST_TIMEOUT_MS, fetchStationList } from "../lib/station.js";
import { stationsLangXml } from "../site/sitemaps.js";
import { sitemapAnswer } from "../lib/sitemap-held.js";

export const GET: APIRoute = async ({ params }) => {
  const lang = params["lang"] ?? "";
  if (!isLang(lang)) return new Response(null, { status: 404 });
  const env = readEnv();
  const list = await fetchStationList({ baseUrl: env.digestUrl, timeoutMs: STATION_LIST_TIMEOUT_MS });
  // #1205: the digest not answering serves the last list this process built (a 200, logged), else the 503
  return sitemapAnswer(`sitemap-stations-${lang}`, list === null || list.length === 0 ? null : stationsLangXml(lang, list), 300);
};
