/**
 * #890: a synthetic straight motorway for the around rule's tests — 21 points due north along 9.5° E,
 * every fifth a rest area, point 10 an Autobahnkreuz. Shared by the rule's and the renderer's tests.
 */
import type { MotorwayItem, MotorwayJunction, MotorwayPage } from "../../../../.pinned/app/packages/digest/dist/src/analysis/motorway.js";
import type { LinePoint } from "../../../../.pinned/app/packages/digest/dist/src/analysis/motorway-view.js";
import type { MotorwayParkingItem } from "../../../../.pinned/app/packages/digest/dist/src/analysis/motorway-layers.js";

export const NOW = new Date("2026-10-21T08:00:00Z");
/** 21 points due north along 9.5° E, 0.05° apart (~5.56 km); every fifth a rest area; point 10 an Autobahnkreuz. */
export const LINE: LinePoint[] = [];
export const AROUND_JUNCTIONS: MotorwayJunction[] = [];
for (let i = 0; i <= 20; i += 1) {
  const lat = 51 + i * 0.05;
  const service = i % 5 === 4;
  LINE.push({ lcd: 40000 + i, lat, lon: 9.5, junction: service ? null : AROUND_JUNCTIONS.length, service, name: service ? `Rastanlage R${String(i)}` : `Ort ${String(i)}` });
  if (!service) AROUND_JUNCTIONS.push({ lcd: 40000 + i, type: i === 10 ? "AK" : "AS", no: String(i), name: `Ort ${String(i)}`, landAgs: "06", town: null, lat, lon: 9.5 });
}
export const at = (i: number, dLon = 0): { lat: number; lon: number } => ({ lat: 51 + i * 0.05, lon: 9.5 + dLon });
export const item = (kind: MotorwayItem["kind"], p: { lat: number; lon: number }, extra: Partial<MotorwayItem> = {}): MotorwayItem => ({ kind, blocked: false, section: null, what: null, direction: null, delaySeconds: null, at: p, segments: 1, ...extra });
export const jamItem = (tail: number, head: number): MotorwayItem =>
  item("jam", at(tail), { jam: { extent: { lengthM: 5000, tail: at(tail), head: at(head), segments: [] }, endText: null, endPlace: null, causes: [], routeRecommendations: [], trend: null, usual: null, howLong: null } });
export const parking = (i: number): MotorwayParkingItem => ({ group: "car", kind: "rest", name: `P${String(i)}`, capacity: 10, truck: null, attribution: { licenceId: "autobahn", text: "x", url: null, purposeLimited: false }, drawn: true, listed: true, j: null, ...at(i, 0.002) });

export function page(items: { readonly jams?: MotorwayItem[]; readonly roadworks?: MotorwayItem[]; readonly parking?: MotorwayParkingItem[] } = {}, line: LinePoint[][] = [LINE]): MotorwayPage {
  return {
    road: "A7",
    at: NOW,
    staticState: "ok",
    junctions: AROUND_JUNCTIONS,
    lands: [],
    towns: [],
    live: {
      state: "live",
      asOf: NOW,
      counts: { closures: 0, jams: items.jams?.length ?? 0, warnings: 0, roadworks: items.roadworks?.length ?? 0 }, toolCounts: { closures: 0, jams: items.jams?.length ?? 0, warnings: 0, roadworks: items.roadworks?.length ?? 0 },
      closures: [],
      jams: items.jams ?? [],
      warnings: [],
      roadworks: (items.roadworks ?? []).map((x) => ({ ...x, directions: [], copies: 1 })),
      moreClosures: 0,
      moreRoadworks: 0,
      moreJams: 0,
      header: null,
    },
    attributions: [],
    line,
    layers: { parking: { state: "ok", items: items.parking ?? [], caveatFeeds: [], shareAlike: [], osm: [], osmAttribution: null }, cameras: null, roadWeather: null, warnings: { state: "none" }, failedReads: 0 },
  };
}
