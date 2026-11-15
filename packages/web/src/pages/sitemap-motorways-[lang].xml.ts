/**
 * `/sitemap-motorways-<lang>.xml` (#715, 2.1.13): every motorway page of the
 * register in one language, natural order (`site/sitemaps.ts`). A 503 when the
 * digest does not answer, never an empty urlset.
 */
import type { APIRoute } from "astro";
import { isLang } from "../i18n/index.js";
import { readEnv } from "../lib/env.js";
import { fetchMotorwayList } from "../lib/motorway.js";
import { motorwaysLangXml } from "../site/sitemaps.js";
import { sitemapAnswer } from "../lib/sitemap-held.js";
import { INDEX_TIMEOUT_MS } from "./sitemap-places.xml.js";

export const GET: APIRoute = async ({ params }) => {
  const lang = params["lang"] ?? "";
  if (!isLang(lang)) return new Response(null, { status: 404 });
  const env = readEnv();
  const roads = await fetchMotorwayList({ baseUrl: env.digestUrl, timeoutMs: INDEX_TIMEOUT_MS });
  // #1205: the digest not answering serves the last list this process built (a 200, logged), else the 503
  return sitemapAnswer(`sitemap-motorways-${lang}`, roads === null || roads.length === 0 ? null : motorwaysLangXml(lang, roads), 300);
};
