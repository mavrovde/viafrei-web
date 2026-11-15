/**
 * The motorway page's service layers for the shell's browser fixture (#716,
 * 2.1.15): the rows the digest's corridor statements answer, in the shapes
 * production returns (read off the A7 on 2026-10-14 — sources, kinds, feeds
 * and counts — and rebuilt here with invented names and positions; no
 * production row is copied). The A7 answers at production's size, so the
 * page budget measures the longest motorway at a heavy hour: ~450 parking
 * rows (lorry parks of the national table and of the Autobahn GmbH, Bosch and
 * Christophorus with live readings, a Hamburg car park), ~100 OSM car parks at
 * junctions, ~190 charging sites, cameras, road-weather stations, one DWD
 * warning on a stretch, and the fuel fragment's stations. Every other road
 * answers a small version.
 *
 * The fuel rows are invented prices of invented stations: no Tankerkönig
 * datum is committed (M14).
 */
import {
  CHARGING_LIVENESS_SQL,
  FEEDS_CHECKED_SQL,
  MOTORWAY_CAMERAS_SQL,
  MOTORWAY_CHARGING_SQL,
  MOTORWAY_FUEL_SQL,
  MOTORWAY_NEARBY_OSM_SQL,
  MOTORWAY_NRW_PR_SQL,
  MOTORWAY_OSM_PARKING_SQL,
  MOTORWAY_PARKING_SQL,
  MOTORWAY_ROAD_FORECAST_SQL,
  MOTORWAY_TRUCKLOUNGE_SQL,
  MOTORWAY_KIND_SOURCES,
  MOTORWAY_WARNINGS_SQL,
} from "@viafrei/digest";

/**
 * The police/Land messages' and the bridges' ledger keys, read from the registry (never typed): production checks them
 * every few minutes, and a fixture without their rows drew both panels "stale · not read yet" — hidden until 2.5.4's
 * cut because their corridor read threw in this fixture and the panels were errors instead (`corridor`).
 */
const feedsOf = (kind: "messages" | "bridges"): readonly string[] => {
  const s = MOTORWAY_KIND_SOURCES[kind];
  if (s.how !== "feeds" || s.feeds.length === 0) throw new Error(`the ${kind} panel is read from its feeds`);
  return s.feeds;
};
const MESSAGE_FEEDS = feedsOf("messages");
const BRIDGE_FEEDS = feedsOf("bridges");

/** #1051: the detours panel's ledger keys, in the registry's order (BW weekly, NRW, Hamburg) — read, never typed. */
const DETOUR_FEEDS = ((): readonly [string, string, string] => {
  const s = MOTORWAY_KIND_SOURCES.detours;
  if (s.how !== "feeds" || s.feeds.length !== 3) throw new Error("the detours panel is read from three feeds");
  return [s.feeds[0]!, s.feeds[1]!, s.feeds[2]!];
})();

type Pt = { readonly lon: number; readonly lat: number };

const at = (now: Date, minAgo: number): Date => new Date(now.getTime() - minAgo * 60_000);
const iso = (now: Date, minAgo: number): string => at(now, minAgo).toISOString();

/**
 * The corridor the statement was asked with ($1 lons, $2 lats) — or none, when the statement was asked with anything
 * else: the streets read's own `set_config('statement_timeout', $1)` (#1099) reaches this fixture with a STRING `$1`,
 * and reading it as a corridor threw, so every map was drawn without streets for the fixture's sake, logged as a
 * failure (2.5.4 cut).
 */
export function corridor(params: readonly unknown[] | undefined): Pt[] {
  const lons = params?.[0];
  const lats = params?.[1];
  if (!Array.isArray(lons)) return [];
  return (lons as readonly number[]).map((lon, i) => ({ lon, lat: Array.isArray(lats) ? ((lats as readonly number[])[i] ?? 0) : 0 }));
}

const big = (pts: readonly Pt[]): boolean => pts.length > 150;

/** #1064: production scale (the page budget's): the heavy roads' layers at production's per-card maxima. */
let PRODUCTION = false;
export function setMotorwayLayerScale(production: boolean): void {
  PRODUCTION = production;
}

/** #1064: invented place names for the production-scale lists — varied as real names are, so the page compresses as production's does. */
export const NAME_HEAD = ["Ober", "Nieder", "Alt", "Neu", "Groß", "Klein", "Hohen", "Wester", "Oster", "Bad ", "Sankt ", "Kirch", "Mühl", "Wald", "Berg", "Lind"] as const;
export const NAME_TAIL = ["hausen", "dorf", "heim", "feld", "bach", "burg", "stadt", "ingen", "rode", "kirchen", "au", "stedt", "brück", "weiler", "tal", "hagen", "lingen"] as const;
export const inventedName = (i: number): string => `${NAME_HEAD[i % NAME_HEAD.length]!}${NAME_TAIL[(i * 7 + Math.floor(i / NAME_HEAD.length)) % NAME_TAIL.length]!}`;
/** #1064: invented operators for the production-scale charging list (production lists dozens of operators). */
const OPERATORS = ["Muster Energie", "Beispiel Strom AG", "Probe Mobility GmbH", "Ladenetz Exempel", "Testwerk Energie", "Stadtwerke Musterhausen", "Fiktiv Charge", "Platzhalter Power"] as const;

function parking(now: Date, pts: readonly Pt[]): unknown[] {
  const n = big(pts) ? (PRODUCTION ? 260 : 450) : 12;
  return Array.from({ length: n }, (_, i) => {
    const p = pts[(i * 7) % pts.length]!;
    const kind = i % 15 === 0 ? (i % 2 === 0 ? "car_park" : "park_and_ride") : "truck";
    const src =
      i % 15 === 0 ? ["hh_parkhaeuser", "hamburg_parkhaeuser"] : i % 40 === 1 ? ["park_bosch_static", "mobilithek_park_bosch_static"] : i % 97 === 2 ? ["park_christophorus_static", "mobilithek_park_christophorus"] : i % 2 === 0 ? ["autobahn", "autobahn"] : ["truckpark_static", "mobilithek_truckpark_static_geonutzv"];
    const occ = src[0] === "park_bosch_static" ? "park_bosch_dyn" : src[0] === "park_christophorus_static" ? "park_christophorus_occ" : null;
    // #1064: at production scale each site its own invented name, as production's are
    const own = PRODUCTION ? inventedName(i + 29) : null;
    const name = i % 23 === 0 ? `Autohof ${own ?? `Musterfeld ${String(i)}`}` : kind === "truck" ? `Rastplatz ${own ?? `Beispielhain ${String(i)}`}` : `Parkhaus ${own ?? `Musterstraße ${String(i)}`}`;
    return {
      facility_id: String(9000 + i), source_feed: src[0], external_id: `DE-X-${String(i)}`, attribution_id: src[1], kind, name, road: src[0] === "autobahn" ? "A7" : null,
      capacity_total: PRODUCTION ? 4 + ((i * 37) % 140) : 20 + (i % 60), capacity_truck: kind === "truck" ? (PRODUCTION ? 2 + ((i * 53) % 90) : 10 + (i % 30)) : null, metres: PRODUCTION ? 120 + ((i * 211) % 4_800) : 300 + (i % 900), last_seen_at: at(now, 30),
      lat: p.lat + (PRODUCTION ? ((i * 31) % 90) / 10_000 : 0.004), lon: p.lon + (PRODUCTION ? ((i * 17) % 70) / 10_000 : 0.003),
      spaces_free: occ === null ? null : 4 + (i % 9), spaces_total: occ === null ? null : 40, occupancy_pct: null, status: null,
      observed_at: occ === null ? null : at(now, 4), feed_ts: occ === null ? null : at(now, 5), occupancy_feed: occ,
      // #901 D6: what the publisher states — every other lorry park a shower and "kein WC", every third a charger and a
      // WC, the rest nothing ("keine Angaben"), so each chip has rows to keep and rows to hide.
      // #1064: at production scale one lorry park in four states a shower (production's map carries about half the fixture's dots)
      ...(kind !== "truck" ? {} : i % (PRODUCTION ? 4 : 2) === 0 ? { facilities: ["shower"], facilities_absent: ["toilet"], facilities_source: src[0] } : i % 3 === 0 ? { facilities: ["charging", "toilet"], facilities_absent: [], facilities_source: src[0] } : {}),
      // #891: every sixth Autobahn GmbH row states a WC, a restaurant and its fuel station (K6); every tenth a "kein WC"
      ...(src[0] === "autobahn" && i % 6 === 0 ? { facilities: ["toilet", "restaurant", "fuel"], facilities_absent: [], facilities_source: "autobahn" } : {}),
      ...(src[0] === "autobahn" && i % 10 === 4 ? { facilities: [], facilities_absent: ["toilet"], facilities_source: "autobahn" } : {}),
    };
  });
}

/**
 * #891 (O9): `MOTORWAY_NEARBY_OSM_SQL`'s answer — every fourth parking row asked about has a named café 170 m
 * north of it in OpenStreetMap and a WC 90 m north (left out where the publisher states a WC, O8).
 */
function nearbyOsm(params: readonly unknown[] | undefined): unknown[] {
  const lons = (params?.[0] as readonly number[] | undefined) ?? [];
  const lats = (params?.[1] as readonly number[] | undefined) ?? [];
  return lons.flatMap((lon, i) => {
    const lat = lats[i] ?? 0;
    return i % 4 === 0
      ? [
          { site: i + 1, amenity: "toilet", name: "WC", metres: 90, lat: lat + 0.00081, lon, extract_date: "2026-10-01" },
          { site: i + 1, amenity: "cafe", name: `Café Rastblick ${String(i)}`, metres: 170, lat: lat + 0.00153, lon, extract_date: "2026-10-01" },
        ]
      : [];
  });
}

function osm(params: readonly unknown[] | undefined): unknown[] {
  const lons = (params?.[0] as readonly number[] | undefined) ?? [];
  const lats = (params?.[1] as readonly number[] | undefined) ?? [];
  const lcds = (params?.[2] as readonly number[] | undefined) ?? [];
  // #1064: production scale names an OSM car park at every second junction (production's A1 lists 84 parking rows)
  return lcds.flatMap((lcd, i) => (i % (PRODUCTION ? 2 : 3) === 0 ? [{ lcd, name: PRODUCTION ? `P+M ${inventedName(i + 41)}` : `P+M Pendlerparkplatz ${String(i)}`, street: "Am Beispielweg", house_number: String(i + 1), lat: (lats[i] ?? 0) + 0.006, lon: (lons[i] ?? 0) - 0.006, metres: 650 }] : []));
}

function shareAlike(now: Date, pts: readonly Pt[], db: "trucklounge" | "nrw_pr"): unknown[] {
  const p = pts[Math.floor(pts.length / 3)];
  if (p === undefined) return [];
  const base = { operator: null, road: null, address: null, capacity_disabled: null, lat: p.lat + 0.002, lon: p.lon - 0.002, distance_m: 420 };
  return db === "trucklounge"
    ? [{ ...base, id: "t1", kind: "truck", name: "Truckpark Beispielfeld", capacity_total: 120, capacity_truck: 110, attribution_id: "mobilithek_park_trucklounge", source_feed: "park_trucklounge", spaces_free: 14, spaces_total: 120, occupancy_pct: null, status: null, observed_at: at(now, 6), feed_ts: at(now, 7), occupancy_feed: "park_trucklounge_occ", occupancy_attribution: "mobilithek_park_trucklounge_occ", unchanged_since: at(now, 30), unchanged_since_at_least: false }]
    : // #1064: production's A1 crosses NRW with nine P+R sites of the CC BY-SA database at production scale
      Array.from({ length: PRODUCTION ? 9 : 1 }, (_, i) => {
        const q = pts[(Math.floor(pts.length / 3) + i * 11) % pts.length]!;
        return { ...base, id: `p${String(i + 1)}`, kind: "park_and_ride", name: PRODUCTION ? `P+R Bahnhof ${inventedName(i + 90)}` : "P+R Bahnhof Musterstadt", capacity_total: 80 + i * 15, capacity_truck: null, attribution_id: "mobilithek_park_nrw_pr", source_feed: "park_nrw_pr", lat: q.lat + 0.002, lon: q.lon - 0.002, distance_m: 420 + i * 90 };
      });
}

/** One charge point of the charging statement's JSON: its power and its newest status, `ageMin` minutes old (or none). */
const chargePoint = (now: Date, maxPowerKw: number, status: string | null, ageMin: number | null) => {
  const t = ageMin === null ? null : iso(now, ageMin);
  return { maxPowerKw, statusFeed: status === null ? null : "afir_chargecloud_dyn", status, operationStatus: null, openingStatus: null, observedAt: t, feedTs: t, lastUpdated: null, exchangeProtocol: status === null ? null : "snapshotPull" };
};

function charging(now: Date, pts: readonly Pt[]): unknown[] {
  const n = big(pts) ? 190 : 6;
  // #1064: production's A1 charging list carries a dozen operators' feeds, each credited
  const feeds = PRODUCTION
    ? ["afir_chargecloud_stat", "bnetza_lsr", "afir_enbw_stat", "afir_tesla_stat", "afir_vw_stat", "afir_eclearing_stat", "afir_pump_stat", "afir_ewe_stat", "afir_qwello_stat", "afir_wirelane_stat", "afir_monta_stat", "afir_lichtblick_stat"]
    : ["afir_chargecloud_stat", "bnetza_lsr", "afir_enbw_stat"];
  return Array.from({ length: n }, (_, i) => {
    const p = pts[(i * 3) % pts.length]!;
    const src = feeds[i % feeds.length]!;
    const points =
      src === "bnetza_lsr"
        ? [chargePoint(now, 22, null, null), chargePoint(now, 22, null, null)]
        : PRODUCTION
          ? // #1064: production's sites differ in size, power and the age of their statuses
            Array.from({ length: 2 + (i % 9) }, (_, k) => chargePoint(now, [22, 50, 150, 300, 400][(i + k) % 5]!, k % 4 === 3 ? null : (i + k) % 3 === 0 ? "charging" : "available", k % 4 === 3 ? null : 3 + ((i * 97 + k * 13) % 2_900)))
          : [chargePoint(now, 150, i % 4 === 0 ? "charging" : "available", 3), chargePoint(now, 150, "available", 3), chargePoint(now, 300, null, null)];
    // #1064: at production scale the sites carry varied invented names, operators and towns, as production's do
    const name = PRODUCTION ? `${["Ladepark", "Schnellladepark", "Ladestation", "HPC"][i % 4]!} ${inventedName(i + 7)}` : `Ladepark Beispiel ${String(i)}`;
    return { source_feed: src, site_id: `s${String(i)}`, name, operator: PRODUCTION ? OPERATORS[i % OPERATORS.length]! : "Muster Energie", street: PRODUCTION ? `${inventedName(i + 3)}er Straße` : "Raststätte", house_number: String(i), city: PRODUCTION ? inventedName(i + 61) : "Musterstadt", lat: p.lat + 0.002, lon: p.lon + 0.002, distance_m: 250 + i, points, also_feeds: [] };
  });
}

function forecast(now: Date, pts: readonly Pt[]): unknown[] {
  const stations = big(pts) ? 20 : 2;
  const run = at(now, 50);
  return Array.from({ length: stations }, (_, s) => {
    const p = pts[(s * 11) % pts.length]!;
    return Array.from({ length: 6 }, (_, h) => ({
      station_id: `W${String(s)}`, name: `GMA Beispielbrücke ${String(s)}`, segment_type: s % 2 === 0 ? 2 : 1, position_source: "dwd", lat: p.lat, lon: p.lon, metres: 120,
      valid_at: new Date(Math.floor(now.getTime() / 3_600_000) * 3_600_000 + h * 3_600_000), run_at: run, rc: s === 3 && h === 4 ? 4 : 1, ts: 6.5 - h * 0.4, tl: 7.1, rrl1c: 0, rrs1c: 0,
    }));
  }).flat();
}

/** #1064: production's twenty DWD warnings along a heavy road (A1, A3 and A7 on 2026-10-25), each its own area and wording. */
const DWD_EVENTS = ["STURMBÖEN", "WINDBÖEN", "DAUERREGEN", "NEBEL", "GLÄTTE", "FROST", "STARKREGEN", "GEWITTER"] as const;
function warningsAtScale(now: Date): unknown[] {
  return Array.from({ length: 20 }, (_, i) => {
    const event = DWD_EVENTS[i % DWD_EVENTS.length]!;
    return {
      identifier: `2.49.0.0.276.0.DWD.PVW.${String(1700000000000 + i * 7919)}.e2e`, event, level: 1 + (i % 3), level_source: "dwd", headline: `Amtliche WARNUNG vor ${event}`,
      description: `Es tritt ${event === "NEBEL" ? "Nebel mit Sichtweiten unter 150 Metern" : event === "GLÄTTE" || event === "FROST" ? "leichter Frost um -2 °C auf, in Bodennähe Glätte" : `${event.toLowerCase()} mit Spitzen um ${String(55 + i * 2)} km/h aus ${["westlicher", "südwestlicher", "nördlicher", "östlicher"][i % 4]!} Richtung`} auf. Gültig für die Kreise ${["Nord", "Süd", "Ost", "West", "Mitte"][i % 5]!}musterland und Beispielkreis ${String(i + 1)}.`,
      valid_from: at(now, 60 + i * 5), valid_to: new Date(now.getTime() + (6 + (i % 5)) * 3_600_000), source_id: "dwd_warnings",
      points: Array.from({ length: 10 }, (_, k) => 10 + i * 14 + k),
    };
  });
}
function warnings(now: Date, pts: readonly Pt[]): unknown[] {
  if (pts.length < 30) return [];
  if (PRODUCTION && big(pts)) return warningsAtScale(now);
  return [
    {
      identifier: "2.49.0.0.276.0.DWD.PVW.0001.e2e", event: "STURMBÖEN", level: 2, level_source: "dwd", headline: "Amtliche WARNUNG vor STURMBÖEN",
      description: "Es treten Sturmböen mit Geschwindigkeiten um 70 km/h aus westlicher Richtung auf.", valid_from: at(now, 60), valid_to: new Date(now.getTime() + 6 * 3_600_000), source_id: "dwd_warnings",
      points: Array.from({ length: 12 }, (_, i) => 20 + i),
    },
  ];
}

function cameras(now: Date, pts: readonly Pt[]): unknown[] {
  if (!big(pts)) return [];
  // #1064: production's eight cameras on the A7 at production scale
  return Array.from({ length: PRODUCTION ? 8 : 4 }, (_, i) => {
    const p = pts[40 + i * (PRODUCTION ? 17 : 1)]!;
    return { camera_id: `cam${String(i)}`, location_label: `A7 AS Beispielfeld-${["Nord", "Süd", "Ost", "West"][i % 4]!}${i < 4 ? "" : ` ${String(i)}`}`, lat: p.lat, lon: p.lon, last_seen_at: at(now, 20), distance_m: 200 };
  });
}

/** The fuel fragment's stations: invented names and prices (no Tankerkönig datum is committed). */
function fuel(now: Date, params: readonly unknown[] | undefined): unknown[] {
  const lcds = (params?.[7] as readonly number[] | undefined) ?? [];
  const service = (params?.[3] as readonly boolean[] | undefined) ?? [];
  const ord = (params?.[4] as readonly number[] | undefined) ?? [];
  return lcds.slice(0, 14).flatMap((lcd, i) =>
    ["e5", "e10", "diesel"].map((product, k) => ({
      station_id: `00000000-0000-0000-0000-${String(100000000000 + i)}`, brand: "MUSTER", name: `Muster Tankstelle ${String(i)}`, street: "Raststättenweg", house_no: String(i + 1), postcode: "12345", city: "Musterstadt",
      metres: 180 + i, ord: ord[i] ?? i, lcd, service: service[i] ?? false,
      product, label: product === "diesel" ? "Diesel" : product === "e10" ? "Super E10" : "Super E5", unit: "EUR/l", price: (1.659 + k * 0.04 + i * 0.001).toFixed(3), observed_at: at(now, 20 + i), is_open: true,
    })),
  );
}

/** The layer statements' rows, or undefined when the text is not one of them. */
export function motorwayLayerRows(now: Date, text: string, params: readonly unknown[] | undefined): readonly unknown[] | undefined {
  const pts = corridor(params);
  if (text === MOTORWAY_PARKING_SQL) return parking(now, pts);
  if (text === MOTORWAY_OSM_PARKING_SQL) return osm(params);
  if (text === MOTORWAY_NEARBY_OSM_SQL) return nearbyOsm(params);
  if (text === MOTORWAY_TRUCKLOUNGE_SQL) return shareAlike(now, pts, "trucklounge");
  if (text === MOTORWAY_NRW_PR_SQL) return shareAlike(now, pts, "nrw_pr");
  if (text === MOTORWAY_CAMERAS_SQL) return cameras(now, pts);
  if (text === MOTORWAY_ROAD_FORECAST_SQL) return forecast(now, pts);
  if (text === MOTORWAY_WARNINGS_SQL) return warnings(now, pts);
  if (text === FEEDS_CHECKED_SQL)
    return [
      { feed_key: "dwd_warnings", checked_at: at(now, 3), cadence_s: 600 },
      { feed_key: "hh_verkehrskameras", checked_at: at(now, 5), cadence_s: 3600 },
      // #1051 (the owner's A10, 2026-10-25): the detours' three ledgers — BW's weekly Bedarfsumleitungen checked six days
      // ago (live by its own week), NRW's and Hamburg's half-hourly ones checked minutes ago. The detours panel's sign is
      // the freshest one's (D1): never "live" beside the six-day-old read.
      { feed_key: DETOUR_FEEDS[0], checked_at: at(now, 6 * 24 * 60), cadence_s: 7 * 86_400 },
      { feed_key: DETOUR_FEEDS[1], checked_at: at(now, 5), cadence_s: 1800 },
      { feed_key: DETOUR_FEEDS[2], checked_at: at(now, 20), cadence_s: 1800 },
      ...MESSAGE_FEEDS.map((feed_key) => ({ feed_key, checked_at: at(now, 4), cadence_s: 300 })),
      ...BRIDGE_FEEDS.map((feed_key) => ({ feed_key, checked_at: at(now, 5), cadence_s: 3600 })),
    ];
  if (text === MOTORWAY_CHARGING_SQL) return charging(now, pts);
  if (text === CHARGING_LIVENESS_SQL) return [{ feed_key: "afir_chargecloud_dyn", last_conclusive_at: at(now, 2), validator: null, validator_since: null, moved_at: at(now, 3) }];
  if (text === MOTORWAY_FUEL_SQL) return fuel(now, params);
  return undefined;
}
