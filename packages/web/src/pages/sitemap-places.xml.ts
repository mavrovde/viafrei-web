/**
 * `/sitemap-places.xml` (#564 § 5): since 2.1.13 (#715) an INDEX of the place
 * sitemaps, one per language (`/sitemap-places-<lang>.xml`) — the address
 * search engines already hold, so it keeps working. The rule is
 * `site/sitemaps.ts`.
 */
import type { APIRoute } from "astro";
import { XML_HEADERS, placeIndexFiles, sitemapIndexXml } from "../site/sitemaps.js";

/** The digest's index can take longer than one tile: it lists every town. */
export const INDEX_TIMEOUT_MS = 8_000;

export const GET: APIRoute = () => new Response(sitemapIndexXml(placeIndexFiles()), { headers: XML_HEADERS });
