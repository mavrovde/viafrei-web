/**
 * `/sitemap-index.xml` (#715, 2.1.13): every sitemap of the site with its real lastmod (`site/sitemaps.ts`). Since
 * #1025 the exit files' lastmod is the newest day of the exit register, read with the sitemaps' deadline; a register
 * that does not answer leaves them the exit template's day; the station files' (#1041) likewise from the station list.
 * Since #49 it names the indexable languages' files only (de, en: `site/indexable.ts`) and no charging part file.
 */
import type { APIRoute } from "astro";
import { readEnv } from "../lib/env.js";
import { fetchExitRegister } from "../lib/motorway.js";
import { STATION_LIST_TIMEOUT_MS, fetchStationList } from "../lib/station.js";
import { ROAD_LIST_TIMEOUT_MS, fetchRoadList } from "../lib/road-page.js";
import { STATE_LIST_TIMEOUT_MS, fetchStateList } from "../lib/state-page.js";
import { XML_HEADERS, indexFiles, newestDay, sitemapIndexXml } from "../site/sitemaps.js";
import { INDEX_TIMEOUT_MS } from "./sitemap-places.xml.js";

export const GET: APIRoute = async () => {
  const env = readEnv();
  // #1041: the station files' lastmod is the newest day of the station list; a list that does not answer leaves them the template's day
  // #1027: and the road files' from the road list; #1074: the Land files' from the Land list
  // #49 A: no charging part file — a charging site's page is in no sitemap
  const [exits, stations, roads, states] = await Promise.all([
    fetchExitRegister({ baseUrl: env.digestUrl, timeoutMs: INDEX_TIMEOUT_MS }),
    fetchStationList({ baseUrl: env.digestUrl, timeoutMs: STATION_LIST_TIMEOUT_MS }),
    fetchRoadList({ baseUrl: env.digestUrl, timeoutMs: ROAD_LIST_TIMEOUT_MS }),
    fetchStateList({ baseUrl: env.digestUrl, timeoutMs: STATE_LIST_TIMEOUT_MS }),
  ]);
  const day = (xs: readonly { readonly day: string | null }[] | null): string | null => (xs === null ? null : newestDay(xs.map((x) => x.day)));
  return new Response(sitemapIndexXml(indexFiles(day(exits), day(stations), day(roads), day(states))), { headers: XML_HEADERS });
};
