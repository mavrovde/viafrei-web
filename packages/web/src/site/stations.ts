/**
 * The station pages (#1041): the catalogue `/<lang>/station` (`pages.ts`
 * "stations") and one page per DB station, `/<lang>/station/<slug>` — the
 * stored slug (`station_slugs`, frozen: a renamed station gets a new one and
 * its old one answers 301), the same in every language (#892: English route
 * words, the language prefix the only language marker). Listed in
 * `/sitemap-stations-<lang>.xml`.
 */
import type { Lang } from "./pages.js";
import { ROUTE_WORDS, isSlug, slugify } from "./slug.js";

/** The path segment of a station page: `station` in every language. */
export const STATION_SEGMENT = ROUTE_WORDS.station;

export function stationPath(lang: Lang, slug: string): `/${string}` {
  return `/${lang}/${STATION_SEGMENT}/${slug}`;
}

/** The digest's own words under its station route: never a station's slug (`STATION_RESERVED_SLUGS` in the ingest). */
export const STATION_RESERVED = new Set(["index", "list", "top"]);

/** Whether a path segment can be a station slug: the builder's shape, and not one of the route's own words. */
export const isStationSlug = (s: string): boolean => isSlug(s) && !STATION_RESERVED.has(s);

/**
 * What a station address's segment names: the slug as it is, or another spelling of one (`Köln Hbf`, `KOELN-HBF`,
 * `koeln_hbf`) to 301 to — the builder's fold of it — or nothing.
 */
export function stationAddress(raw: string): { readonly kind: "slug"; readonly slug: string } | { readonly kind: "respell"; readonly slug: string } | { readonly kind: "none" } {
  let decoded = raw;
  try {
    decoded = decodeURIComponent(raw);
  } catch {
    return { kind: "none" };
  }
  if (isStationSlug(raw)) return { kind: "slug", slug: raw };
  const folded = slugify(decoded);
  return isStationSlug(folded) ? { kind: "respell", slug: folded } : { kind: "none" };
}
