/**
 * `/sitemap-exits-<lang>.xml` (#1025, 2.4.1): the exit pages the exit rule indexes, in one language — read from the
 * digest's exit register (`/internal/motorway/exits`). A 503 while the register cannot answer (its first lap after a
 * boot, a failure), never an empty urlset: an empty sitemap would tell an index that every exit page had gone.
 * Retry-After 180: the digest's first lap after a boot is about two minutes (2.4.1 review S1). A 503 WITH a Retry-After
 * is what the deploy's IndexNow step and `scripts/search-submit.mjs` read as "not ready": skipped and named, never a
 * failure that holds back the other sitemaps.
 */
import type { APIRoute } from "astro";
import { isLang } from "../i18n/index.js";
import { readEnv } from "../lib/env.js";
import { fetchExitRegister } from "../lib/motorway.js";
import { exitsLangXml } from "../site/sitemaps.js";
import { sitemapAnswer } from "../lib/sitemap-held.js";
import { INDEX_TIMEOUT_MS } from "./sitemap-places.xml.js";

export const GET: APIRoute = async ({ params }) => {
  const lang = params["lang"] ?? "";
  if (!isLang(lang)) return new Response(null, { status: 404 });
  const env = readEnv();
  const exits = await fetchExitRegister({ baseUrl: env.digestUrl, timeoutMs: INDEX_TIMEOUT_MS });
  // #1205: the digest not answering serves the last list this process built (a 200, logged), else the 503
  return sitemapAnswer(`sitemap-exits-${lang}`, exits === null ? null : exitsLangXml(lang, exits), 180);
};
