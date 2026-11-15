/**
 * #1182, the data steward's ruling of 2026-11-08 (point 2, `data-sources` "Stations near the visitor on the station
 * index"): the station catalogue `/<lang>/station` opens, after its search, with the stations nearest the visitor's
 * place — found by the existing location ladder ONLY, exactly as the home and the place bar find it:
 *
 *  - L2, the approximate place from the IP address (`location/server.ts` `motorwayIpCell`): the local DB-IP Lite
 *    file, in memory; never asked for a crawler, `DNT: 1` or `Sec-GPC: 1`; only the cell goes on, to the digest's
 *    `/internal/station/near`; DB-IP's CC BY 4.0 line stands under the block whenever the lookup ran.
 *  - L1 / L3, the browser's position and the remembered choice: what the location island wrote on a click in the
 *    place bar (the ~500 m cell rounded ON THE DEVICE, `location/island.ts`, or a pick), read by the shared near
 *    script (`lib/near-script.ts`), which writes nothing; "Ort vergessen" puts the server's block back.
 *  - No exact position: the page's island runs without the one-shot object lookup (`spot: false`), so nothing on
 *    this page asks `/fragment/spot`.
 *
 * Every answer that may carry a visitor-derived list is `private, no-store` with `Vary: X-Forwarded-For`; the key
 * travels in a POST body, never in a URL, so the access log's request line names no place (`/fragment/station-near`).
 * No consent is asked and none is consulted: nothing here is analytics.
 */
import { isLang } from "../i18n/index.js";
import { cellKey } from "../location/ladder.js";
import { motorwayIpCell } from "../location/server.js";
import type { GeoIp } from "../location/geoip.js";
import type { Lang } from "../site/pages.js";
import { bodyOf } from "./fragment-route.js";
import { geoipCreditHtml } from "./geoip-credit.js";
import { nearScript } from "./near-script.js";
import { getFragment, placeKeyOfSlug } from "./place.js";
import type { TileFetchOptions } from "./tiles.js";

/** The public route the script asks. */
export const STATION_NEAR_ROUTE = "/fragment/station-near";
/** The element the block lands in. */
export const STATION_NEAR_SLOT = "station-near-slot";
/** What the digest's answer begins with (`STATION_NEAR_OPEN`; the shell imports no digest module, the test holds them equal). */
export const STATION_NEAR_OPEN = '<section class="station-near" id="station-near" aria-labelledby="station-near-t">';
const SHAPE = /^<section class="station-near" id="station-near" aria-labelledby="station-near-t">/;

/** The headers of every answer that may carry a visitor-derived list (ruling point 2, L2). */
export const STATION_NEAR_HEADERS: Readonly<Record<string, string>> = { "cache-control": "private, no-store", vary: "X-Forwarded-For" };

/** The key the digest is asked with: an `ags:` as it is, a `pt:` snapped to its ~500 m cell (never finer), else null. */
export function nearKeyOf(at: string): string | null {
  if (/^ags:\d{8}$/.test(at)) return at;
  const m = /^pt:(-?\d{1,2}(?:\.\d{1,6})?),(-?\d{1,3}(?:\.\d{1,6})?)$/.exec(at);
  return m === null ? null : cellKey(Number(m[1]), Number(m[2]));
}

/** The digest's block for one key; a 404 is "no German place", anything else not ok is no answer in time. */
function fetchNear(at: string, lang: Lang, o: TileFetchOptions): Promise<{ readonly ok: true; readonly html: string } | { readonly ok: false; readonly status?: number | null }> {
  return getFragment(`${o.baseUrl}/internal/station/near?at=${encodeURIComponent(at)}&lang=${lang}`, o, SHAPE, "</section>").catch(() => ({ ok: false as const }));
}

export type StationNearIp = { readonly html: string | null; readonly usedGeoIp: boolean };

/** L2: the block for the visitor's approximate place from the IP address, and whether the lookup ran (its credit). */
export async function stationNearIp(
  headers: { get(n: string): string | null },
  lang: Lang,
  o: TileFetchOptions & { readonly geoipFile: string | undefined; readonly geo?: GeoIp | null },
): Promise<StationNearIp> {
  const cell = motorwayIpCell(headers, o);
  if (cell.at === null) return { html: null, usedGeoIp: cell.usedGeoIp };
  const f = await fetchNear(cell.at, lang, o);
  return { html: f.ok ? f.html : null, usedGeoIp: true };
}

/** The slot (the IP rung's block, or empty and hidden) and DB-IP's line whenever the lookup ran — outside the slot, so a remembered place swapped in keeps it. */
export function stationNearSlotHtml(lang: Lang, ip: StationNearIp): string {
  const slot = `<div class="station-near-slot" id="${STATION_NEAR_SLOT}"${ip.html === null ? " hidden" : ""}>${ip.html ?? ""}</div>`;
  return slot + (ip.usedGeoIp ? geoipCreditHtml(lang) : "");
}

/** The catalogue with the near slot right after its search (before the stations most delayed now); unchanged without a search. */
export function withStationNear(indexHtml: string, slotHtml: string): string {
  const at = /<form class="stpage-search"[\s\S]*?<\/form>/u.exec(indexHtml);
  if (at === null) return indexHtml;
  const end = at.index + at[0].length;
  return `${indexHtml.slice(0, end)}${slotHtml}${indexHtml.slice(end)}`;
}

/** The page's call of the shared near script. */
export function stationNearScript(lang: Lang): string {
  return nearScript({ lang, slot: STATION_NEAR_SLOT, route: STATION_NEAR_ROUTE, shape: STATION_NEAR_OPEN });
}

const empty = (status: number): Response => new Response(null, { status, headers: { ...STATION_NEAR_HEADERS } });

/** POST `/fragment/station-near`: `{ at, lang }` — the stations nearest a remembered place or a device-rounded cell. */
export async function stationNearRoute(req: Request, o: TileFetchOptions): Promise<Response> {
  if (req.method !== "POST") return empty(405);
  const b = await bodyOf(req);
  if (b === null || typeof b["lang"] !== "string" || !isLang(b["lang"]) || typeof b["at"] !== "string") return empty(400);
  let at: string | null = b["at"];
  if (at.startsWith("slug:")) {
    const key = await placeKeyOfSlug(at.slice("slug:".length), o);
    if (key === undefined) return empty(503);
    if (key === null) return empty(404);
    at = key;
  }
  at = nearKeyOf(at);
  if (at === null) return empty(400);
  const f = await fetchNear(at, b["lang"], o);
  if (!f.ok) return empty(f.status === 404 ? 404 : 502);
  return new Response(f.html, { status: 200, headers: { "content-type": "text/html; charset=utf-8", ...STATION_NEAR_HEADERS, "x-robots-tag": "noindex, nofollow" } });
}
