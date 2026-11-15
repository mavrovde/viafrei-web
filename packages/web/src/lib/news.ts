/**
 * The News page's traffic announcements (#588), fetched from the digest's
 * `/internal/news/traffic` like every tile: one GET, the tile deadline, and an
 * answer that is not recognisably the announcements fragment is no answer.
 * The shell reads no database (A2); the digest holds the rows and judges
 * expiry with its own clock at render time.
 */
import type { Lang } from "../site/pages.js";
import { getFragment } from "./place.js";
import type { TileFetchOptions } from "./tiles.js";

const SHAPE = /^(<ul class="news-list news-traffic">[\s\S]*<\/ul>|<p class="news-traffic news-traffic--(none|error)">[^<]*<\/p>)\s*$/;

/** The fragment, or null when the digest did not answer in time or answered something else. */
export async function fetchNewsTraffic(lang: Lang, o: TileFetchOptions): Promise<string | null> {
  const r = await getFragment(`${o.baseUrl}/internal/news/traffic?lang=${lang}`, o, SHAPE, "");
  return r.ok ? r.html : null;
}
