/**
 * #1205: a sitemap whose list the digest did not answer is served from the last body this process built for the
 * same address — a 200, `X-VF-Degraded: 1` (the middleware logs it, `page_degraded`) — instead of a 503. A sitemap
 * lists addresses that change by the day, so the last good list is the right answer for the minutes the digest is
 * busy. With nothing held (a process that never built it) the answer stays the 503 with `Retry-After`: never an
 * empty or shorter urlset, which would tell an index that the pages are gone.
 *
 * #1205 review S8: bounded in BYTES, gzip-compressed, by the same store as the held pages (`held-store.ts`). Measured
 * by the review: the place sitemaps of all 22 languages are ~23 MB of XML; urlsets of slugs compress at level 1 to
 * roughly a tenth, so `SITEMAP_HELD_MAX_BYTES` (4 MiB) holds every list with room, and when it does not, the least
 * recently built list goes first. One list is at most `SITEMAP_HELD_ENTRY_MAX_BYTES` compressed (a list over it is
 * served and not kept). `SITEMAP_HELD_MAX` still bounds the count.
 */
import { DEGRADED_HEADER } from "./degraded.js";
import { HeldStore } from "./held-store.js";
import { XML_HEADERS } from "../site/sitemaps.js";

/** Bound of the held bodies: every sitemap address of every language and part, with room to spare. */
export const SITEMAP_HELD_MAX = 2_000;
export const SITEMAP_HELD_MAX_BYTES = 4 * 1024 * 1024;
export const SITEMAP_HELD_ENTRY_MAX_BYTES = 1024 * 1024;

const store = new HeldStore<null>(SITEMAP_HELD_MAX_BYTES, SITEMAP_HELD_ENTRY_MAX_BYTES, SITEMAP_HELD_MAX);

export function unavailableSitemap(retryAfterS: number): Response {
  return new Response(null, { status: 503, headers: { "retry-after": String(retryAfterS), "cache-control": "no-store" } });
}

/** `xml` built now (kept for the next miss and answered), or null: the held body for `key`, else the 503. */
export function sitemapAnswer(key: string, xml: string | null, retryAfterS = 300): Response {
  if (xml !== null) {
    store.set(key, xml, null);
    return new Response(xml, { headers: XML_HEADERS });
  }
  const last = store.get(key);
  if (last === null) return unavailableSitemap(retryAfterS);
  const headers = new Headers(XML_HEADERS);
  headers.set(DEGRADED_HEADER, "1");
  return new Response(last.text, { headers });
}

/** Tests and the evidence: the lists held and their compressed bytes. */
export function heldSitemaps(): { readonly lists: number; readonly bytes: number; readonly backingBytes: number } {
  const s = store.stats();
  return { lists: s.entries, bytes: s.bytes, backingBytes: s.backingBytes };
}

/** Forget every held body (tests). */
export function clearHeldSitemaps(): void {
  store.clear();
}
