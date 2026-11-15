/**
 * `/robots.txt` (#381, Lighthouse SEO; #531): every crawler may crawl every
 * page, the AI search crawlers are named with their own `Allow: /` group, the
 * file points at `/llms.txt`, and the sitemap is named. The fuel page is disallowed in the corpus groups and, since
 * #1182 (data-steward ruling 2026-11-08, B3), in the SEO-tool and paced crawlers' groups too. The text is
 * `robotsTxt()` in `site/discovery.ts`. The owner preview adds
 * `X-Robots-Tag: noindex` at the edge, so a crawler that ever reached it
 * would still not index it.
 */
import type { APIRoute } from "astro";
import { TEXT_HEADERS, robotsTxt } from "../site/discovery.js";
import { STAGING_ROBOTS_TXT, stagingOf } from "../lib/staging.js";

/** #1235: the staging site (`VF_STAGING`, dev.viafrei.de) disallows every path to every crawler. */
export function robotsBody(env: Readonly<Record<string, string | undefined>> = process.env): string {
  return stagingOf(env) ? STAGING_ROBOTS_TXT : robotsTxt();
}

export const GET: APIRoute = () => new Response(robotsBody(), { headers: TEXT_HEADERS });
