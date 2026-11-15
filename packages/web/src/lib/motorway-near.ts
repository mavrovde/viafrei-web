/**
 * #1113: the motorway index applies the visitor's remembered choice like every other page. The index IS the whole
 * country, so a remembered "Ganz Deutschland" (or nothing remembered) leaves it as it is; a remembered place — a
 * pick or "use my location", what the location island wrote on the click (`location/island.ts`, `remember`) — adds,
 * above the list, the motorways in the radius around it, each a link to its page, which re-centres on the same place.
 *
 * The script (`lib/near-script.ts`, shared with the station index since #1182) READS the choice and writes nothing; a
 * shared address wins over it. The position travels in a POST body, never in a URL, and the answer is `no-store`.
 * Behind the same switch as the road pages' position bar (`motorwayAroundOn`, G5).
 */
import { isLang } from "../i18n/index.js";
import type { Lang } from "../site/pages.js";
import { bodyOf } from "./fragment-route.js";
import { nearScript } from "./near-script.js";
import { AROUND_DEFAULT_KM, motorwayAroundOn } from "./motorway-around.js";
import { getFragment, placeKeyOfSlug } from "./place.js";
import { mapQuery, type TileFetchOptions } from "./tiles.js";

/** The public route the script asks. */
export const MOTORWAY_NEAR_ROUTE = "/fragment/motorway-near";
/** The element the block lands in (hidden until it does). */
export const MOTORWAY_NEAR_SLOT = "motorway-near-slot";
/** What the digest's answer begins with. */
export const MOTORWAY_NEAR_OPEN = '<section class="motorway-near" id="motorway-near"';
const SHAPE = /^<section class="motorway-near" id="motorway-near"/;

/** The index page's call of the shared near script (`lib/near-script.ts`) with its configuration. */
export function motorwayNearScript(lang: Lang): string {
  return nearScript({ lang, slot: MOTORWAY_NEAR_SLOT, route: MOTORWAY_NEAR_ROUTE, shape: MOTORWAY_NEAR_OPEN });
}

const empty = (status: number): Response => new Response(null, { status, headers: { "cache-control": "no-store" } });

/** POST `/fragment/motorway-near`: `{ at, lang }` — the motorways in the default radius around a place key. */
export async function motorwayNearRoute(req: Request, o: TileFetchOptions, on: boolean = motorwayAroundOn()): Promise<Response> {
  if (req.method !== "POST") return empty(405);
  if (!on) return empty(404);
  const b = await bodyOf(req);
  if (b === null || typeof b["lang"] !== "string" || !isLang(b["lang"]) || typeof b["at"] !== "string") return empty(400);
  let at = b["at"];
  if (at.startsWith("slug:")) {
    const key = await placeKeyOfSlug(at.slice("slug:".length), o);
    if (key === undefined) return empty(503);
    if (key === null) return empty(404);
    at = key;
  }
  if (!/^(?:ags:\d{8}|pt:-?\d{1,2}(?:\.\d{1,6})?,-?\d{1,3}(?:\.\d{1,6})?)$/.test(at)) return empty(400);
  const f = await getFragment(`${o.baseUrl}/internal/motorway/near?at=${encodeURIComponent(at)}&r=${AROUND_DEFAULT_KM}&lang=${b["lang"]}${mapQuery(o)}`, o, SHAPE, "</section>");
  if (!f.ok) return empty(f.status === 404 ? 404 : 502);
  return new Response(f.html, { status: 200, headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store", "x-robots-tag": "noindex, nofollow" } });
}
