/**
 * The road pages (#1027): one page per Bundesstraße, `/<lang>/road/b51`, and one per Landes- or Staatsstraße under its
 * Land's ISO code, `/<lang>/road/nw/l249` — a Land's road number is not unique in Germany (an L 249 exists in more than
 * one Land), a Bundesstraße's is. English route words in every language, the language prefix the only language marker
 * (#892). A Kreisstraße has no page. Listed in `/sitemap-roads-<lang>.xml` while something on the road is in force or
 * ended within seven days (the digest's rule, `roadPageIndexable`).
 *
 * The id grammar is stated here a second time because the shell reads no ingest package (A2): it is the digest's
 * `roadPageId` / `roadRefOfId` (`packages/ingest/src/domain/roads/road-ref.ts`), and `test/roads.test.ts` holds the two
 * equal over the same samples.
 */
import type { Lang } from "./pages.js";
import { ROUTE_WORDS } from "./slug.js";

/** The path segment of a road page: `road` in every language. */
export const ROAD_SEGMENT = ROUTE_WORDS.road;

/** The sixteen Länder's ISO codes, lower case — the first segment of a Land's road. */
export const ROAD_LAND_SLUGS = ["sh", "hh", "ni", "hb", "nw", "he", "rp", "bw", "by", "sl", "be", "bb", "mv", "sn", "st", "th"] as const;

const NUMBER = "[1-9][0-9]{0,3}[a-z]?";
const ROAD_ID = new RegExp(`^(?:b${NUMBER}|(?:${ROAD_LAND_SLUGS.join("|")})\\/[ls]${NUMBER})$`);

/** Whether an id is a road page's canonical id (`b51`, `b96n`, `nw/l249`, `sn/s84`). */
export const isRoadId = (id: string): boolean => ROAD_ID.test(id);

export function roadPath(lang: Lang, id: string): `/${string}` {
  return `/${lang}/${ROAD_SEGMENT}/${id}`;
}

/**
 * What a road address names: its canonical id as it is, another spelling of one to 301 to (`B51`, `B 51`, `b051`,
 * `NW/L249`), or nothing — a K road, an A road (its page is the motorway's), a Land's road without its Land, a
 * Bundesstraße under a Land.
 */
export function roadAddress(raw: string): { readonly kind: "id"; readonly id: string } | { readonly kind: "respell"; readonly id: string } | { readonly kind: "none" } {
  if (isRoadId(raw)) return { kind: "id", id: raw };
  let decoded: string;
  try {
    decoded = decodeURIComponent(raw);
  } catch {
    return { kind: "none" };
  }
  if (decoded.length > 24) return { kind: "none" };
  const folded = decoded
    .toLowerCase()
    .split("/")
    .map((p) => p.replace(/[\s._-]+/g, "").replace(/^([a-z]+)0+(?=[1-9])/, "$1"))
    .join("/");
  return isRoadId(folded) ? { kind: "respell", id: folded } : { kind: "none" };
}

/** A road id's label as a reader writes it (`B 51`, `L 249`, `B 96n`) — for the layout's fallback when the fragment names none. */
export function roadLabelOfId(id: string): string {
  const road = id.split("/").at(-1) ?? id;
  const m = /^([a-z])([0-9]+)([a-z]?)$/.exec(road);
  return m === null ? road.toUpperCase() : `${(m[1] ?? "").toUpperCase()} ${m[2] ?? ""}${m[3] ?? ""}`;
}
