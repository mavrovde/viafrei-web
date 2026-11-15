/**
 * `/sitemap-states-<lang>.xml` (#1074): the sixteen Land pages in one language (`site/sitemaps.ts`). The digest not
 * answering, or answering anything but the sixteen, is a 503 — never an empty or a shorter urlset, which would tell an
 * index that a Land's page is gone.
 */
import type { APIRoute } from "astro";
import { isLang } from "../i18n/index.js";
import { readEnv } from "../lib/env.js";
import { STATE_LIST_TIMEOUT_MS, fetchStateList } from "../lib/state-page.js";
import { statesLangXml } from "../site/sitemaps.js";
import { sitemapAnswer } from "../lib/sitemap-held.js";

export const GET: APIRoute = async ({ params }) => {
  const lang = params["lang"] ?? "";
  if (!isLang(lang)) return new Response(null, { status: 404 });
  const env = readEnv();
  const list = await fetchStateList({ baseUrl: env.digestUrl, timeoutMs: STATE_LIST_TIMEOUT_MS });
  // #1205: the digest not answering serves the last list this process built (a 200, logged), else the 503
  return sitemapAnswer(`sitemap-states-${lang}`, list === null ? null : statesLangXml(lang, list), 300);
};
