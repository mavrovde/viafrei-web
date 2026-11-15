/**
 * A REAL digest for the browser suites and the screenshots (#378 review,
 * items 4 and 11): `createApp` and `renderTile` from `@viafrei/digest`, over a
 * report built by the digest's own `buildDigest` from a fixture snapshot — so
 * the fragments the shell embeds are byte for byte what production renders,
 * at production's size (ten reports, three fuel grades, every charging and
 * lorry source), with no database and no network. Loopback only.
 *
 * The figures are a plausible fixture, not production data; they exist to
 * give the page its real shape and height.
 */
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import {
  FUEL_CACHE_FRESH_S,
  RANKING_BANDS,
  MOTORWAY_PLANS_ONLY_FEEDS,
  MOTORWAY_PLANS_SQL,
  MOTORWAY_PLAN_CHECKS_SQL,
  ROAD_NOW_ALONG_SQL,
  ROAD_NOW_SQL,
  ROAD_NOW_PLACE_SQL,
  SCHEDULED_AT_STOPS_SQL,
  SIRI_ET_AT_REFS_SQL,
  STATION_DHIDS,
  STATION_DHIDS_BY_EVA,
  STATION_TIMETABLE_STOPS,
  STATION_FASTA_UNITS_SQL,
  STATION_LIFT_FEEDS_SQL,
  TRIP_UPDATES_SQL,
  PLATFORM_ACCESS_AT_EVAS,
  type PlatformAccessRow,
  type RoadNowDbRow,
  type RoadNowEvent,
  type RoadNowKind,
  type ScheduledRow,
  type SiriCallRow,
  type TripUpdateRow,
  AUTOBAHN_EVENTS_AT_TICKS,
  ROAD_CONTEXT_ALONG,
  ROAD_STATUS_AUTOBAHN,
  ROAD_STATUS_AUTOBAHN_TICKS,
  SUMMARY_AUTOBAHN_COUNTS_AT_TICKS,
  berlinWallClock,
  type RoadContextRow,
  type AutobahnEventRow,
  type RoadStatusAutobahnRow,
  POI_NEEDS_NEAR_SQL,
  type PoiNeedRow,
  roadRefKey,
  CHARGING_TERMS,
  CONNECTORS,
  CONNECTOR_FEED_VALUES,
  NO_CHARGING_FILTER,
  NO_OPERATOR_KEY,
  POWER_BANDS,
  operatorKey,
  powerBandOf,
  siteUnderFilter,
  type ChargingFacetRow,
  type ChargingFilter,
  LORRY_SEVAS_RELATION,
  lorryPlaceSql,
  type LorryPlaceRow,
  LIVE_FEEDS_CHECKED_SQL,
} from "@viafrei/ingest";
import { LIVE_MAP_STATIONS_SQL, LIVE_MAP_WARNINGS_SQL } from "@viafrei/digest";
import { CHARGING_FACETS_SQL, CHARGING_NEAR_FILTERED_SQL } from "../../../.pinned/app/packages/digest/dist/src/cards/charging/sql.js";
import { createFilteredCharging } from "../../../.pinned/app/packages/digest/dist/src/server/charging-filter-service.js";
import {
  CHARGING_LIVENESS_SQL,
  CHARGING_NEAR_SQL,
  FUEL_NEAR_SQL,
  BORDER_CANDIDATES_SQL,
  NEAR_NATIONAL_BORDER_SQL,
  GEMEINDE_BY_AGS_SQL,
  GEMEINDE_INDEX_SQL,
  GEMEINDE_NEAREST_SQL,
  POINT_IN_GERMANY_SQL,
  GEMEINDE_PREFIX_SQL,
  LIFTS_NEAR_SQL,
  NRW_PR_CARD_SQL,
  TRUCKLOUNGE_CARD_SQL,
  FASTA_AT_STATIONS_SQL,
  HYDROGEN_NEAR_SQL,
  PARKING_AT_STOPS_SQL,
  STEP_FREE_AT_STOPS_SQL,
  PARKING_NEAR_SQL,
  PARKING_NEARBY_CHARGING_SQL,
  PARKING_NEARBY_OSM_SQL,
  WARNINGS_AT_SQL,
  WARNINGS_CHECKED_SQL,
  ALERTS_NEAR_SQL,
  FEEDS_CHECKED_SQL,
  HH_CAMERAS_SQL,
  OSM_FUEL_CARD_SQL,
  PLACES_NEAR_SQL,
  ROAD_FORECAST_NEAR_SQL,
  SHARING_STATIONS_SQL,
  SHARING_VEHICLES_SQL,
  STOPS_NEAR_SQL,
  BFRK_AT_STOPS_SQL,
  type BfrkSurveyRow,
  TOWN_EXONYMS_SQL,
  createPlaceService,
  createMotorwayCharging,
  createMotorwayService,
  MOTORWAY_POINTS_SQL,
  MOTORWAY_REGISTER_SQL,
  MOTORWAY_SUMMARY_PAGE_SQL, MOTORWAY_SUMMARY_SQL,
  MOTORWAY_SUMMARY_VERSION_SQL,
  MOTORWAYS_NEAR_SQL,
  MOTORWAY_INTERCHANGES_SQL,
  MOTORWAY_OVERVIEW_SQL,
  MAP_TOWNS_SQL,
  DETOURS_ON_ROADS_SQL,
  type MotorwayInterchangeRow,
  type MotorwayNearRow,
  type MotorwayPointRow,
  type MotorwaySummaryRow,
  type AlertNearRow,
  type RoadForecastNearRow,
  type ShareAlikeParkingRow,
  type StopNearRow,
} from "@viafrei/digest";
import { POPULAR_PLACES } from "../src/site/places.js";
import { slugify } from "../src/site/slug.js";
import { NAME_HEAD, NAME_TAIL, inventedName, motorwayLayerRows, setMotorwayLayerScale } from "./real-motorway.js";
import { MAP_TOWNS } from "./real-towns.js";
import { MOTORWAY_CITIES_SQL, PLACES_MOTORWAYS_SQL, PLACE_NEIGHBOURS_SQL, crossingLamp, type MotorwayCityRow, type PlaceMotorwayRow, type PlaceNeighbourRow } from "@viafrei/digest";
import { STATION_INDEX_SQL, STATION_RECORD_SQL, STATION_SLUG_OWNER_SQL, STATION_TOP_ALERTS_SQL, STATION_TOP_DHIDS_SQL, STATION_TOP_DISRUPTION_SQL, STATION_TOP_SQL, STATION_VERSION_SQL, createStationService, type StationIndexRow, type StationRecordRow, type StationTopRow } from "@viafrei/digest";
// the board's plan statement and its group: not part of the digest's public surface, so read from its source (as motorway-routes.test.ts does)
import { BOARD_GROUP, STATION_ARRIVALS_PLAN_SQL, STATION_BOARD_PLAN_SQL, STATION_BOARD_URBAN_PLAN_SQL, STATION_LINES_SQL, URBAN_GROUP } from "../../../.pinned/app/packages/digest/dist/src/queries/station-board.sql.js";
import { STATION_KVB_UNITS_SQL } from "../../../.pinned/app/packages/digest/dist/src/queries/station-lifts.sql.js";
import { STATION_NEIGHBOURS_SQL } from "../../../.pinned/app/packages/digest/dist/src/queries/station-page.sql.js";
import { STATION_NEARBY_M, STATION_ROADS_OUT_M } from "../../../.pinned/app/packages/digest/dist/src/queries/station-nearby-read.js";
import { STREET_NEAR_EACH_SQL } from "../../../.pinned/app/packages/digest/dist/src/queries/place-label.sql.js";
import { ROAD_PAGE_LIST_SQL, ROAD_PAGE_SQL, createRoadService, type RoadPageListRow, type RoadPageRow } from "@viafrei/digest";
import { buildDigest, createApp, createExitWalker, setPlaceSlugs, type CityAutobahnJamRow, type CityPoliceJamRow, type CityJamsRows, type DigestService, type DigestSnapshot, type StationRow } from "@viafrei/digest";

export const NOW = new Date("2026-10-03T08:00:00.000Z");
const ago = (m: number): Date => new Date(NOW.getTime() - m * 60_000);
/**
 * #1064: the fixture's SCALE. `e2e` (the default) is the shape every browser
 * test is written against. `production` is the page budget's: the A1 and the
 * A7 answer at the size production's heaviest motorway pages carried on
 * 2026-10-25 (A1, A3 and A7 read off viafrei.de, card by card — the per-card
 * maxima are `test/fixtures/motorway-profile.json`), with invented names and
 * positions; no production row is copied. Set by `startRealDigest`.
 */
let PRODUCTION_SCALE = false;
/** The fixture's heavy motorways: the A7 always, the A1 too at production scale (production's heaviest page, #1064). */
const heavy = (road: string): boolean => road === "A7" || (PRODUCTION_SCALE && road === "A1");
/**
 * #1064: at production scale a heavy road's points lie up to ~300 m off the fixture's regular grid, deterministically —
 * production's coordinates are not a lattice, and every map link and map point repeats them, so a lattice gzips
 * about a fifth smaller than the page it stands for. Zero at e2e scale (the browser tests' geometry is unchanged).
 */
/** #1064: a point's name — the e2e shape's numbered stand-in, or at production scale an invented name of its own. */
const pointName = (road: string, i: number, stem: string, sep = ""): string => (PRODUCTION_SCALE && heavy(road) ? `${inventedName(i + 17)}${sep}` : sep === "" ? `${stem} ${String(i + 1)}` : `${stem}${sep}`);
/**
 * A fixture road's i-th of n points. The e2e shape: one north–south course for every road. At production scale the
 * A1 follows its real line instead — Hamburg, Köln, Saarbrücken — so a visitor the IP rung places in Köln is ON it, as
 * the production measurement's visitor was, and "around you" carries what production's did (#1064).
 */
function courseAt(road: string, i: number, n: number): { readonly lat: number; readonly lon: number } {
  if (PRODUCTION_SCALE && road === "A1") {
    const t = i / Math.max(1, n - 1);
    const [a, b, u] = t < 0.6 ? [[53.55, 10.0], [50.94, 6.96], t / 0.6] as const : [[50.94, 6.96], [49.24, 6.99], (t - 0.6) / 0.4] as const;
    return { lat: a[0] + (b[0] - a[0]) * u + (i % 9) * 0.004 + wobble(road, i, 1), lon: a[1] + (b[1] - a[1]) * u + (i % 9) * 0.006 + wobble(road, i, 2) };
  }
  return { lat: 54.8 - (i * 7.2) / n + wobble(road, i, 1), lon: 9.4 + (i % 9) * 0.05 + wobble(road, i, 2) };
}
const wobble = (road: string, i: number, axis: 1 | 2): number => {
  if (!PRODUCTION_SCALE || !heavy(road)) return 0;
  const x = Math.sin(i * 12.9898 + axis * 78.233) * 43_758.5453;
  return Math.round((x - Math.floor(x) - 0.5) * 6_000) / 1_000_000;
};
/** One charge point of `CHARGING_NEAR_SQL`'s `points` JSON (#711): its power and its newest status `ageMin` minutes old, or none. */
const chargePoint = (maxPowerKw: number | null, status: string | null, ageMin: number | null, connectorTypes?: readonly string[]) => {
  const at = ageMin === null ? null : ago(ageMin).toISOString();
  return {
    maxPowerKw,
    statusFeed: status === null ? null : "afir_chargecloud_dyn",
    status,
    operationStatus: null,
    openingStatus: null,
    observedAt: at,
    feedTs: at,
    lastUpdated: null,
    exchangeProtocol: status === null ? null : "snapshotPull",
    ...(connectorTypes === undefined ? {} : { connectorTypes }),
  };
};
/** #1081: the published connector values of a CCS2 and of a Type 2 point. */
const CCS = ["iec62196T2COMBO"] as const;
const TYPE2 = ["iec62196T2"] as const;

let n = 0;
function ev(kind: RoadNowKind, road: string, what: string, subtitle: string | null, sinceMin: number, delayS: number | null = null, source = "autobahn", untilMin: number | null = null): RoadNowEvent {
  n += 1;
  return {
    key: `fx${n}`,
    origin: source === "autobahn" ? "autobahn" : "road_event",
    source,
    licenceId: source === "nms_events" ? "mobilithek_nms_events" : source,
    kind,
    eventType: null,
    what,
    where: { road, referentFrom: null, referentTo: null, distanceFromM: null, distanceToM: null, lon: 9 + n * 0.3, lat: 49 + (n % 5) * 0.4, extent: null, subtitle },
    since: ago(sinceMin),
    // A stated end, for the News page's long closures (#588); null is "the publisher said none".
    until: untilMin === null ? null : new Date(NOW.getTime() + untilMin * 60_000),
    delaySeconds: delayS,
    lastSeenAt: ago(3),
    band: RANKING_BANDS[kind] ?? 7,
    rank: 0,
  };
}

/**
 * Ten reports in PRODUCTION's shape (owner 2026-10-06: the page-weight gate
 * measures what production renders): the publishers' long titles and their
 * "AS … (aus Richtung …)" subtitles, as viafrei.de carried them on 2026-10-06,
 * and a second source (the police reports via Mobilithek) so the roads fact
 * carries both credit lines, as it does live.
 */
const EVENTS: readonly RoadNowEvent[] = [
  ev("closure", "A661", "AS OF-Taunusring (Rampenprogramm 2026)", "AS Offenbach-Taunusring (aus Richtung Buchrain)", 30),
  ev("closure", "A14", "Km 80,50 AS Leipzig-Messe - RV Asphaltfahrbahnsanierung", "AS Leipzig-Messegelände (aus Richtung Leipzig-Nordost)", 120),
  ev("closure", "A49", "Brückenneubau", null, 600, null, "autobahn", 20 * 24 * 60),
  ev("closure", "A57", "Krefeld-Gartenstadt - Krefeld-Oppum", null, 840),
  ev("closure", "A38", "FBE A38 Km 193,58 - 208,32 Richtungsfahrbahn Dresden", null, 900),
  ev("closure", "A20", "Fahrbahnerhaltung zwischen AS Neubrandenburg-Nord und AS Neubrandenburg-Ost (km 251,370-265,000), beide FR", null, 1320, null, "autobahn", 3 * 24 * 60),
  ev("closure", "A6", "A5-A6 FDI AK Walldorf Rampenprogramm", "AK Walldorf (aus Richtung Am Hockenheimring)", 1500),
  ev("closure", "A4", "A4o Km 51,60 RF GR - AS Salzenforst bis AS Bautzen-West - Fahrbahnsanierung", null, 1500),
  ev("closure", "A72", "Km 74,10 RF Hof - AS Zwickau-Ost - Asphaltsanierung", null, 1500),
  ev("closure", "A71", "Erfurt-Bindersleben Fahrbahnerneuereung", null, 1560),
  ev("jam", "A1", "Stau zwischen Köln-Lövenich und Kreuz Köln-Nord", null, 25, 900, "nms_events"),
];

const fuel = (product: string, label: string, cheapest: string, median: string, stations: number) => ({
  product,
  label,
  unit: "EUR/l",
  cheapest_price: cheapest,
  cheapest_station: "Musterhof",
  cheapest_brand: "ARAL",
  cheapest_street: "Fürther Str.",
  cheapest_house_no: "12",
  cheapest_postcode: "90429",
  cheapest_city: "Nürnberg",
  cheapest_observed_at: ago(6),
  median_price: median,
  station_count: stations,
  window_from: ago(58),
  window_to: ago(6),
  last_seen_any: ago(6),
});

/** [AGS, held, [brand, name, street, house no, postcode, city] × 3] — every Land, three stations each. */
const BOARD: readonly (readonly [string, number, readonly (readonly [string, string, string, string, string, string])[]])[] = [
  ["01", 41, [["Hoyer", "Hoyer Tankstelle Kiel-Wellsee", "Wellseedamm", "18", "24145", "Kiel"], ["Shell", "Shell Flensburg Husumer Straße", "Husumer Str.", "50", "24941", "Flensburg"], ["ARAL", "Aral Tankstelle Lübeck Moislinger Allee", "Moislinger Allee", "121", "23558", "Lübeck"]]],
  ["02", 37, [["JET", "JET Hamburg Billstedter Hauptstraße", "Billstedter Hauptstr.", "71", "22111", "Hamburg"], ["Shell", "Shell Hamburg Kieler Straße", "Kieler Str.", "653", "22527", "Hamburg"], ["ESSO", "Esso Station Hamburg-Harburg", "Winsener Str.", "103", "21077", "Hamburg"]]],
  ["03", 52, [["Raiffeisen", "Raiffeisen Tankstelle Oldenburg Nadorst", "Nadorster Str.", "250", "26123", "Oldenburg (Oldb)"], ["ARAL", "Aral Tankstelle Hannover Vahrenwalder Straße", "Vahrenwalder Str.", "171", "30165", "Hannover"], ["Star", "star Tankstelle Braunschweig Hamburger Straße", "Hamburger Str.", "226", "38114", "Braunschweig"]]],
  ["04", 12, [["Q1", "Q1 Tankstelle Bremen Habenhausen", "Habenhauser Landstr.", "54", "28279", "Bremen"], ["Shell", "Shell Bremerhaven Langener Landstraße", "Langener Landstr.", "245", "27578", "Bremerhaven"], ["ARAL", "Aral Tankstelle Bremen Stresemannstraße", "Stresemannstr.", "37", "28207", "Bremen"]]],
  ["05", 88, [["ITS", "ITS am Marktkauf Tankstelle am Marktkauf", "Kölner Landstr.", "289", "40589", "Düsseldorf"], ["Westfalen", "Westfalen Tankstelle Münster Weseler Straße", "Weseler Str.", "591", "48163", "Münster"], ["bft", "bft Tankstelle Köln-Ehrenfeld Vogelsanger Straße", "Vogelsanger Str.", "352", "50827", "Köln"]]],
  ["06", 46, [["ARAL", "Aral Tankstelle Frankfurt Hanauer Landstraße", "Hanauer Landstr.", "315", "60314", "Frankfurt am Main"], ["TotalEnergies", "TotalEnergies Kassel Leipziger Straße", "Leipziger Str.", "147", "34123", "Kassel"], ["Agip", "ENI Station Wiesbaden Biebricher Allee", "Biebricher Allee", "66", "65187", "Wiesbaden"]]],
  ["07", 33, [["Globus", "Globus Tankstelle Koblenz-Bubenheim", "Otto-Hahn-Str.", "2", "56070", "Koblenz"], ["Shell", "Shell Mainz Rheinallee", "Rheinallee", "113", "55120", "Mainz"], ["HEM", "HEM Tankstelle Ludwigshafen Industriestraße", "Industriestr.", "22", "67063", "Ludwigshafen am Rhein"]]],
  ["08", 79, [["ARAL", "Aral Tankstelle Stuttgart Heilbronner Straße", "Heilbronner Str.", "380", "70469", "Stuttgart"], ["AVIA", "AVIA Xpress Freiburg Basler Landstraße", "Basler Landstr.", "8", "79111", "Freiburg im Breisgau"], ["OMV", "OMV Tankstelle Karlsruhe Durlacher Allee", "Durlacher Allee", "47", "76131", "Karlsruhe"]]],
  ["09", 94, [["ARAL", "Aral Tankstelle Nürnberg Fürther Straße", "Fürther Str.", "12", "90429", "Nürnberg"], ["Shell", "Shell München Leopoldstraße", "Leopoldstr.", "40", "80802", "München"], ["Allguth", "Allguth Tankstelle München Ingolstädter Straße", "Ingolstädter Str.", "123", "80939", "München"]]],
  ["10", 9, [["Globus", "Globus Tankstelle Saarbrücken-Güdingen", "Saargemünder Str.", "142", "66130", "Saarbrücken"], ["TotalEnergies", "TotalEnergies Neunkirchen Zweibrücker Straße", "Zweibrücker Str.", "61", "66538", "Neunkirchen"], ["ARAL", "Aral Tankstelle Homburg Berliner Straße", "Berliner Str.", "107", "66424", "Homburg"]]],
  ["11", 29, [["TotalEnergies", "TotalEnergies Berlin Holzmarktstraße", "Holzmarktstr.", "36", "10243", "Berlin"], ["Sprint", "Sprint Tankstelle Berlin-Neukölln Sonnenallee", "Sonnenallee", "224", "12059", "Berlin"], ["ARAL", "Aral Tankstelle Berlin Kurfürstendamm", "Kurfürstendamm", "128", "10711", "Berlin"]]],
  ["12", 24, [["Star", "star Tankstelle Potsdam Zeppelinstraße", "Zeppelinstr.", "136", "14471", "Potsdam"], ["Shell", "Shell Cottbus Dresdener Straße", "Dresdener Str.", "51", "03050", "Cottbus"], ["bft", "bft Tankstelle Frankfurt (Oder) Leipziger Straße", "Leipziger Str.", "180", "15232", "Frankfurt (Oder)"]]],
  ["13", 18, [["ARAL", "Aral Tankstelle Rostock Hamburger Straße", "Hamburger Str.", "115", "18069", "Rostock"], ["Sprint", "Sprint Tankstelle Schwerin Ludwigsluster Chaussee", "Ludwigsluster Chaussee", "8", "19061", "Schwerin"], ["ORLEN", "ORLEN Station Greifswald Anklamer Straße", "Anklamer Str.", "50", "17489", "Greifswald"]]],
  ["14", 35, [["ITS", "ITS am Marktkauf Tankstelle am Marktkauf", "Nieskyer Str.", "100", "02828", "Görlitz"], ["ARAL", "Aral Tankstelle Leipzig Maximilianallee", "Maximilianallee", "2", "04129", "Leipzig"], ["Agip", "ENI Station Dresden Königsbrücker Straße", "Königsbrücker Str.", "104", "01099", "Dresden"]]],
  ["15", 15, [["ARAL", "Aral Tankstelle Magdeburg Halberstädter Straße", "Halberstädter Str.", "125", "39112", "Magdeburg"], ["Shell", "Shell Halle (Saale) Merseburger Straße", "Merseburger Str.", "376", "06132", "Halle (Saale)"], ["Freie", "Freie Tankstelle Dessau-Roßlau Kühnauer Straße", "Kühnauer Str.", "24", "06846", "Dessau-Roßlau"]]],
  ["16", 21, [["Shell", "Shell Erfurt Stotternheimer Straße", "Stotternheimer Str.", "4", "99086", "Erfurt"], ["ORLEN", "ORLEN Station Jena Rudolstädter Straße", "Rudolstädter Str.", "41", "07745", "Jena"], ["ARAL", "Aral Tankstelle Gera Wiesestraße", "Wiesestr.", "212", "07548", "Gera"]]],
];

const cents = (base: number, i: number): string => (base + i * 0.01).toFixed(3);
/** Seconds in a minute: the window is configured in seconds, the fixture ages in minutes. */
const MINUTE_S = 60;
/** The cache window in minutes: the fixture's board rows are current exactly when FUEL_BOARD_SQL would call them so. */
const FUEL_CACHE_FRESH_MIN = FUEL_CACHE_FRESH_S / MINUTE_S;
const FUEL_BOARD_ROWS = BOARD.flatMap(([land, held, stations], li) =>
  stations.map(([brand, name, street, house_no, postcode, city], i) => {
    // one row in three older than the freshness threshold, so the older mark renders as in production
    const ageMin = i === 2 ? 95 + li * 7 : 6 + li * 3 + i * 11;
    return {
      land,
      brand,
      name,
      street,
      house_no,
      postcode,
      city,
      e5: cents(1.689 + (li % 5) * 0.02, i),
      e10: cents(1.629 + (li % 5) * 0.02, i),
      diesel: cents(1.589 + (li % 4) * 0.02, i),
      observed_at: ago(ageMin),
      // #774 review: as the SQL computes it — `observed_at > at - fuel.cache_fresh_s`, i.e. younger than the window
      current: ageMin < FUEL_CACHE_FRESH_MIN,
      land_count: held,
    };
  }),
);

/** [AGS, trips observed, % late, trips with a skipped stop, median worst delay s, untimed trips] — all sixteen, as production on 2026-10-06. */
const PUNCTUALITY_LANDS: readonly (readonly [string, number, number, number, number, number])[] = [
  ["01", 1360, 8, 96, 30, 0], ["02", 2247, 5, 134, 28, 0], ["03", 1799, 10, 234, 62, 0], ["04", 153, 6, 4, 30, 579],
  ["05", 7864, 9, 232, 64, 0], ["06", 3998, 5, 51, 26, 0], ["07", 2038, 10, 74, 61, 0], ["08", 5882, 10, 248, 66, 0],
  ["09", 5989, 7, 88, 27, 0], ["10", 73, 11, 1, 29, 0], ["11", 466, 3, 16, 22, 0], ["12", 492, 4, 8, 24, 0],
  ["13", 664, 5, 5, 25, 0], ["14", 2744, 5, 59, 26, 0], ["15", 868, 6, 12, 60, 0], ["16", 1192, 4, 1, 21, 0],
];

const place = (block: "charging" | "parking" | "carparks", attribution_id: string, sites: number, units: number | null, ageMin = 300) => ({
  block,
  source_feed: attribution_id,
  attribution_id,
  sites,
  units,
  last_seen_at: ago(ageMin),
  // No feed_checks row in the fixture: every source is judged by its rows, as before #564.
  checked_at: null,
  cadence_s: null,
});

/**
 * The city jam tile (#520) at a BUSY hour, in production's shape: police jam
 * messages per city (the counts of a weekday rush hour measured on prod over
 * 15 km — Berlin 103, Köln 77, Essen 61 … a day — scaled to one moment), the
 * publishers' multi-line texts as long as the live ones, one Landesmeldestelle
 * BW message in Stuttgart (so its line and its RVWD note are counted), and one
 * Autobahn GmbH warning in Hamburg. Figures are a plausible fixture.
 */
const JAM_COUNTS = [9, 4, 3, 7, 2, 5, 2, 1, 4, 6] as const; // JAM_CITIES order: Berlin … Essen
const JAM_TEXTS = [
  "A100 Stadtring Berlin, Wilmersdorf Richtung Wedding\nzwischen Kurfürstendamm und Dreieck Funkturm\n4 km Stau, Verzögerungen von bis zu 20 Minuten",
  "A1 Köln Richtung Dortmund\nzwischen Kreuz Köln-Nord und Leverkusen-West\n6 km Stau, Fahrbahnverengung",
  "A40 Ruhrschnellweg Essen Richtung Dortmund\nzwischen Essen-Frillendorf und Essen-Kray\n3 km stockender Verkehr",
  "Stuttgart, B14 Richtung Waiblingen\nzwischen Neckartor und Pragsattel\n2 km Stau, Rückstau bis in den Heslacher Tunnel",
];
/**
 * The eight main stations (#519) at the size production read over the busy
 * window to 2026-10-06 16:30Z (read-only): every station with a share, so
 * the page-weight gate measures the tile at its largest.
 */
const STATION_ROWS: StationRow[] = (
  [
    ["de:11000:900003201", "Berlin Hbf", 25, 0, 2, -12],
    ["de:02000:10950", "Hamburg Hbf", 13, 4, 0, 60],
    ["de:09162:100", "München Hbf", 25, 6, 0, 60],
    ["de:05315:11201", "Köln Hbf", 41, 11, 0, 120],
    ["de:06412:10", "Frankfurt (Main) Hbf", 52, 3, 0, 38],
    ["de:08111:6115", "Stuttgart Hbf", 20, 6, 0, 150],
    ["de:05111:18235", "Düsseldorf Hbf", 124, 18, 0, 90],
    ["de:14713:8010205", "Leipzig Hbf", 22, 2, 0, 0],
  ] as const
).map(([dhid, name, observed, late, skipped, median], i) => ({
  ord: i + 1, dhid, name, stops_known: 10, trips_observed: observed, trips_late: late, trips_skipped_stop: skipped,
  trips_untimed: 0, median_worst_delay_s: median, newest: ago(2),
}));

function jamRows(): CityJamsRows {
  const police: CityPoliceJamRow[] = [];
  const autobahn: CityAutobahnJamRow[] = [];
  JAM_COUNTS.forEach((count, i) => {
    const city = i + 1;
    for (let k = 0; k < count; k++) {
      const bw = city === 7 && k === 0;
      police.push({
        city,
        current_feeds: ["nms_events", "traffic_bw", "traffic_sh"],
        checked_at: ago(3),
        feed_key: bw ? "traffic_bw" : "nms_events",
        publication_id: `FX/${String(city)}/${String(k)}`,
        overall_start: ago(20 + k * 7),
        version_at: ago(5),
        last_seen_at: ago(3),
        lat: 51,
        lon: 7,
        distance_m: 1500 + k * 2100,
        total_rows: count,
        feed_keys: ["nms_events"],
        jam_type: "stationaryTraffic",
        length_affected: String(1000 + ((city * 7 + k * 3) % 9) * 500),
        detail_text: bw ? JAM_TEXTS[3]! : (JAM_TEXTS[(city + k) % 3] ?? JAM_TEXTS[0]!),
      });
    }
    autobahn.push(
      city === 2
        ? { city, feed_key: "autobahn", road: "A1", ext_id: "FX-A1", title: "A1 | Hamburg-Stillhorn - Norderelbbrücke", subtitle: "Bremen -> Lübeck", abnormal_traffic_type: "QUEUING_TRAFFIC", delay_s: 1080, lat: 53.5, lon: 10.0, distance_m: 5949, start_ts: ago(46).toISOString(), total_rows: 1 }
        : ({ city, feed_key: null }),
    );
  });
  return { police, autobahn, autobahnAsked: true };
}

export function fixtureSnapshot(): DigestSnapshot {
  return {
    takenAt: NOW,
    roads: { ok: true, value: { at: NOW, events: EVENTS, gates: [], truncated: false, inForce: 6964 } },
    fuel: { ok: true, value: [fuel("e5", "Super E5", "1.689", "1.779", 318), fuel("e10", "Super E10", "1.629", "1.719", 318), fuel("diesel", "Diesel", "1.589", "1.679", 318)] },
    places: {
      ok: true,
      value: [
        // every source production counts, at production's figures (2026-10-06): eight charging, nine parking (ten with #548's Dortmund table)
        place("charging", "mobilithek_afir_ecomovement", 18420, 63504, 820),
        place("charging", "ocpdb_chargecloud", 7400, 26853, 30),
        place("charging", "mobilithek_afir_enbw_stat", 3240, 11502, 1180),
        place("charging", "mobilithek_afir_eclearing_stat", 2900, 9857, 520),
        place("charging", "mobilithek_afir_vw_stat", 2100, 8493, 760),
        place("charging", "mobilithek_afir_tesla_stat", 162, 4004, 580),
        place("charging", "autobahn", 508, null, 30),
        place("charging", "ocpdb_taubert", 90, 295, 29),
        // 2.1 (#646–#670): the operators' master files, sites and points as pulled on 2026-10-13.
        place("charging", "mobilithek_afir_pump_stat", 120, 357, 1440),
        place("charging", "mobilithek_afir_edri_stat", 534, 1727, 1440),
        place("charging", "mobilithek_afir_audi_stat", 9, 38, 1440),
        place("charging", "mobilithek_afir_enio_stat", 4, 5, 1440),
        place("charging", "mobilithek_afir_evprice_stat", 13, 42, 1440),
        place("charging", "mobilithek_afir_ewe_stat", 883, 2305, 1440),
        place("charging", "mobilithek_afir_gls_stat", 8, 65, 1440),
        place("charging", "mobilithek_afir_gpjoule_stat", 200, 850, 1440),
        place("charging", "mobilithek_afir_gridco_stat", 1122, 1923, 1440),
        place("charging", "mobilithek_afir_eround_stat", 6142, 18729, 1440),
        place("charging", "mobilithek_afir_inergia_stat", 3, 5, 1440),
        place("charging", "mobilithek_afir_rudnick_stat", 1, 1, 1440),  // published nothing yet (204 on 2026-10-13): one site stands in so the line is counted
        place("charging", "mobilithek_afir_lichtblick_stat", 1287, 6507, 1440),
        place("charging", "mobilithek_afir_monta_stat", 727, 2994, 1440),
        place("charging", "mobilithek_afir_qwello_stat", 765, 2004, 1440),
        place("charging", "mobilithek_afir_road_stat", 547, 1447, 1440),
        place("charging", "mobilithek_afir_smatrics_stat", 99, 324, 1440),
        place("charging", "mobilithek_afir_wirelane_stat", 2131, 4100, 1440),
        place("charging", "mobilithek_afir_chargecloud_stat", 8801, 26935, 1440),
        place("charging", "mobilithek_afir_vaylens_stat", 10122, 15832, 1440),
        place("charging", "mobilithek_afir_ladenetz_stat", 2619, 8915, 1440),
        place("charging", "mobilithek_afir_ladebusiness_stat", 969, 2889, 1440),
        // 2.3.23 (#665, #846, #1021, #845): TC-Backend, ELU Mobility, Chargepool, eliso — sites and points as parsed from the
        // recorded pulls of 2026-10-25 (fixtures/mobilithek/recorded/afir-*, the parsers of recorded-2.3.23.test.ts).
        place("charging", "mobilithek_afir_tcbackend_stat", 2, 5, 1440),
        place("charging", "mobilithek_afir_elu_stat", 1, 26, 1440),
        place("charging", "mobilithek_afir_chargepool", 3, 19, 1440),
        place("charging", "mobilithek_afir_eliso_stat", 2, 6, 1440),
        place("parking", "mobilithek_truckpark_static_geonutzv", 1290, 70410, 940),
        place("parking", "autobahn", 1680, 45225, 30),
        place("carparks", "hamburg_parkhaeuser", 126, 54437, 3),
        place("carparks", "mobilithek_park_nrw_parken", 109, 34056, 2),
        place("parking", "mobilithek_park_christophorus", 4, 68, 2),
        place("carparks", "mobilithek_park_koeln_static", 41, 20368, 1310),
        place("carparks", "hamburg_park_ride", 38, 8454, 3),
        place("carparks", "muenster_pls", 20, 7749, 2),
        place("parking", "mobilithek_park_bosch_static", 12, null, 1),
        // #904: Autohof Thiersheim's own table — one lorry park on the 2026-10-26 recording.
        place("parking", "mobilithek_park_thiersheim_static", 1, null, 1),
        // #548: Stadt Dortmund's table — 25 car parks on the 2026-10-10 recording.
        place("carparks", "mobilithek_park_dortmund_static", 25, 8269, 1440),
        // #500: Stadt Leipzig's P+R WFS — 15 sites on the 2026-10-12 recording.
        place("carparks", "leipzig_pr_belegung", 15, 3482, 10),
        // #600 (2.1.3): Stadt Kassel's car parks — 10 on the 2026-10-13 recording.
        place("carparks", "mobilithek_park_kassel_static", 10, 3453, 1),
        // #769, #770 (2.2.2): Wuppertal's table (61 on the 2026-10-18 recording) and Leipzig's MDM P+R sites (6).
        place("carparks", "mobilithek_park_wuppertal_static", 61, 6067, 1440),
        place("carparks", "mobilithek_park_leipzig_pr_static", 6, 3100, 1440),
        // #616, #617 (2.4.2): Wiesbaden's table (14 car parks, 4 863 spaces over the 13 that state one) and Konstanz's
        // (10 placed of 11, 3 038 spaces over 8), as `collectParkingSites` parses the recordings of 2026-10-26.
        place("carparks", "mobilithek_park_wiesbaden_static", 14, 4863, 1440),
        place("carparks", "mobilithek_park_konstanz_static", 10, 3038, 1440),
        // #603 (2.5.3): SWT Trier's table — 28 placed of 29, 4 307 spaces over the 27 that state one (2026-11-01 recording).
        place("carparks", "mobilithek_park_trier_static", 28, 4307, 1440),
      ],
    },
    facilities: {
      ok: true,
      value: [
        { kind: "elevator", state: "inactive", n: 167, stations: 120, oldest_since: ago(4000), last_seen_at: ago(2), source_feed: "db_fasta" },
        { kind: "escalator", state: "inactive", n: 96, stations: 70, oldest_since: ago(3000), last_seen_at: ago(2), source_feed: "db_fasta" },
        { kind: "elevator", state: "active", n: 3375, stations: 1300, oldest_since: null, last_seen_at: ago(2), source_feed: "db_fasta" },
      ],
    },
    punctuality: {
      ok: true,
      // PRODUCTION's shape (2026-10-06): the nationwide row, all sixteen Länder
      // (Bremen withheld for untimed trips, as live), three cities
      value: [
        { level: "all", area: "de", name: null, trips_observed: 36581, trips_late: 2780, trips_skipped_stop: 1260, trips_untimed: 0, median_worst_delay_s: 40, stops_seen: 101621, newest: ago(2) },
        ...PUNCTUALITY_LANDS.map(([area, observed, pct, skipped, delay, untimed]) => ({
          level: "land" as const,
          area,
          name: null,
          trips_observed: observed,
          trips_late: Math.round((observed * pct) / 100),
          trips_skipped_stop: skipped,
          trips_untimed: untimed,
          median_worst_delay_s: delay,
          stops_seen: observed * 3,
          newest: ago(2),
        })),
        { level: "city", area: "02000", name: "Hamburg", trips_observed: 2247, trips_late: 112, trips_skipped_stop: 134, trips_untimed: 0, median_worst_delay_s: 28, stops_seen: 6100, newest: ago(2) },
        { level: "city", area: "09162", name: "München", trips_observed: 2169, trips_late: 152, trips_skipped_stop: 7, trips_untimed: 0, median_worst_delay_s: 26, stops_seen: 5800, newest: ago(2) },
        { level: "city", area: "06412", name: "Frankfurt am Main", trips_observed: 1610, trips_late: 64, trips_skipped_stop: 1, trips_untimed: 0, median_worst_delay_s: 22, stops_seen: 4100, newest: ago(2) },
      ],
    },
    // The fuel board at PRODUCTION's size (owner 2026-10-06): all sixteen
    // Länder with the three stations FUEL_BOARD_PER_LAND allows, because the
    // page-weight gate measured a two-Land board for weeks while every home in
    // production carried ~43 KB of it. Names and addresses are as long as the
    // live ones; the figures are a plausible fixture, not production data.
    fuelBoard: { ok: true, value: FUEL_BOARD_ROWS },
    cityJams: { ok: true, value: jamRows() },
    stations: { ok: true, value: STATION_ROWS },
    placesNear: { ok: true, value: { gazetteerLoaded: true, found: new Map(), asked: new Set() } },
  };
}

/**
 * The place cards' rows (#564), at production's shape for a large city: Köln,
 * a warning in force, three chargers and two car parks, three fuel grades and
 * two stations' lifts — so the page-weight gate and the screenshots carry a
 * place block as heavy as a busy city's. Since #693 also the nearest-stations
 * card at its WORST case (#693 review): eight stop families (two railway
 * stations, an S-Bahn, a U-Bahn, and bus stops), so four are listed and four
 * named under "more stops"; three live departures at each railway station, one
 * cancelled; THREE alerts with headlines longer than the full-list cap, one
 * carried by both alert feeds; and the two stations' lifts folded into it, so
 * the lifts card is not shown.
 */
const KOELN = { name: "Köln", admin_code: "05315000", population: 1_084_831, lat: 50.9375, lon: 6.9603, metres: 1200 };
const inMin = (m: number): Date => new Date(NOW.getTime() + m * 60_000);
const stopRow = (o: { mode: string; id: string; name: string; modes: string[]; lines: string[]; metres: number; evas?: string[]; nos?: string[] }): StopNearRow => ({
  loaded: true,
  mode: o.mode as StopNearRow["mode"],
  root_id: o.id,
  name: o.name,
  modes: o.modes,
  lines: o.lines,
  stop_ids: [`${o.id}:1:1`],
  metres: o.metres,
  evas: o.evas ?? null,
  station_nos: o.nos ?? null,
  // Each family's own point (2.0.10: every listed stop carries its map link, so
  // the page is measured with them), placed by its distance north-east of the
  // fixture's centre — distinct names, so no merge is asked.
  lat: Number((50.943 + o.metres / 160_000).toFixed(6)),
  lon: Number((6.9583 + o.metres / 160_000).toFixed(6)),
});
const HBF = { id: "de:05315:11201", name: "Köln Hbf", modes: ["rail", "sbahn", "tram"], lines: ["RE1", "RE5", "RE7", "S11", "S12", "16", "18"], metres: 650, evas: ["8000207"], nos: ["3320"] };
const DEUTZ = { id: "de:05315:11210", name: "Köln Messe/Deutz", modes: ["rail", "sbahn"], lines: ["RE7", "RE9", "S12", "S19"], metres: 1400, evas: ["8003368"], nos: ["3343"] };
const STOP_ROWS: readonly StopNearRow[] = [
  stopRow({ mode: "rail", ...HBF }),
  stopRow({ mode: "rail", ...DEUTZ }),
  stopRow({ mode: "sbahn", ...HBF }),
  stopRow({ mode: "sbahn", ...DEUTZ }),
  stopRow({ mode: "sbahn", id: "de:05315:11220", name: "Köln Hansaring", modes: ["sbahn"], lines: ["S6", "S11", "S12"], metres: 1100, evas: ["8003392"] }),
  stopRow({ mode: "subway", id: "de:05315:11111", name: "Dom/Hbf", modes: ["subway", "tram"], lines: ["5", "16", "18"], metres: 520 }),
  stopRow({ mode: "tram", id: "de:05315:11111", name: "Dom/Hbf", modes: ["subway", "tram"], lines: ["5", "16", "18"], metres: 520 }),
  stopRow({ mode: "tram", ...HBF }),
  stopRow({ mode: "bus", id: "de:05315:12001", name: "Breslauer Platz/Hbf", modes: ["bus"], lines: ["132", "133", "250", "260"], metres: 700 }),
  stopRow({ mode: "bus", id: "de:05315:12002", name: "Heumarkt", modes: ["bus", "tram"], lines: ["132", "133", "1", "7", "9"], metres: 900 }),
  stopRow({ mode: "bus", id: "de:05315:12003", name: "Köln Rathaus", modes: ["bus", "subway"], lines: ["5", "132", "133"], metres: 1300 }),
  stopRow({ mode: "subway", id: "de:05315:12004", name: "Appellhofplatz", modes: ["subway"], lines: ["3", "4", "5", "16", "18"], metres: 1700 }),
];
const call = (ref: string, line: string, destination: string, aimed: number, delay: number | null, over: Partial<SiriCallRow> = {}): SiriCallRow => ({
  ref,
  via: null,
  line,
  category: line.replace(/\d+$/u, ""),
  destination,
  platform: "4",
  aimed_dep: inMin(aimed),
  expected_dep: delay === null ? null : inMin(aimed + delay),
  delay_s: delay === null ? null : delay * 60,
  cancelled: false,
  journey_cancelled: false,
  observed_at: ago(3),
  ...over,
});
const CALL_ROWS: readonly SiriCallRow[] = [
  // 2.1.10 (#711): filed under a zHV DHID of its own root, not the station's number —
  // Köln Hbf's call only through the StaDa↔zHV pairing, so the page credits the zHV.
  call("de:05315:99001", "RE5", "Koblenz Hbf", 4, 2),
  call("8000207", "S11", "Bergisch Gladbach", 7, 0),
  call("8000207", "RE7", "Rheine", 12, null, { cancelled: true }),
  call("8003368", "RE9", "Siegen Hbf", 6, 11),
  call("8003368", "S12", "Au (Sieg)", 9, 1),
  call("8003368", "S19", "Hennef (Sieg)", 15, 0),
  call("8003392", "S6", "Essen Hbf", 3, 4),
];
/**
 * #702: the plan the card composes the live figures onto — one row per
 * departure of each family the card shows, filed under the family's id — and
 * the Trip Updates of two bus trips (one late, one cancelled). The rail rows
 * match the SIRI ET calls above by line and minute.
 *
 * `trip_short_name` as DELFI publishes it (#787): a zero-padded train number on
 * rail, the operator's internal trip number on a bus. None of these is a
 * long-distance trip, so the card prints the line for every one of them.
 */
const plan = (grp: string, trip: string, line: string, destination: string, aimed: number, routeType: number, platform: string | null = null, tripShortName: string | null = null): ScheduledRow => ({
  grp,
  trip_id: trip,
  stop_id: `${grp}:1:1`,
  stop_sequence: 3,
  at: inMin(aimed),
  service_date: "2026-10-03",
  route_type: routeType,
  line,
  trip_short_name: tripShortName,
  destination,
  platform,
});
const PLAN_ROWS: readonly ScheduledRow[] = [
  plan(HBF.id, "fx-re5", "RE5", "Koblenz Hbf", 4, 106, "4", "010517"),
  plan(HBF.id, "fx-s11", "S11", "Bergisch Gladbach", 7, 109, "4", "031123"),
  plan(HBF.id, "fx-re7", "RE7", "Rheine", 12, 106, "4"),
  plan(DEUTZ.id, "fx-re9", "RE9", "Siegen Hbf", 6, 106, "4"),
  plan(DEUTZ.id, "fx-s12", "S12", "Au (Sieg)", 9, 109, "4"),
  plan(DEUTZ.id, "fx-s19", "S19", "Hennef (Sieg)", 15, 109, "4"),
  plan("de:05315:11220", "fx-s6", "S6", "Essen Hbf", 3, 109, "1"),
  plan("de:05315:11111", "fx-u5", "5", "Sparkasse Am Butzweilerhof", 2, 900),
  plan("de:05315:11111", "fx-u16", "16", "Niehl Sebastianstr.", 6, 900),
  plan("de:05315:12001", "fx-b132", "132", "Meschenich Kirche", 3, 3, "B", "132017"),
  plan("de:05315:12001", "fx-b133", "133", "Zollstock Südfriedhof", 8, 3, "C"),
  // #938 E1: Köln Hbf's further departures for the stop's "more" steps — after the card's three, every three minutes
  // for an hour, each to a place of its own (two rows of one line to one place a minute apart would be one train)
  ...Array.from({ length: 22 }, (_, i) => plan(HBF.id, `fx-m${String(i + 1).padStart(2, "0")}`, i % 2 === 0 ? "RB25" : "S12", `Ziel ${String(i + 1)}`, 16 + i * 3, i % 2 === 0 ? 106 : 109, String(1 + (i % 9)))),
];

/**
 * `SCHEDULED_AT_STOPS_SQL` as the statement reads (#938 E1): the asked groups, the window `[$4, $5)`, `$6` rows on
 * each side of `$7` (after it by instant, line, trip; before it the latest) — so a "more" step reads its own window.
 */
function planAnswer(params: readonly unknown[] | undefined): ScheduledRow[] {
  const groups = new Set((params?.[2] as readonly string[] | undefined) ?? []);
  const from = new Date(params?.[3] as string | Date).getTime();
  const to = new Date(params?.[4] as string | Date).getTime();
  const cap = Number(params?.[5]);
  const pivot = new Date(params?.[6] as string | Date).getTime();
  const order = (a: ScheduledRow, b: ScheduledRow): number => a.at.getTime() - b.at.getTime() || (a.line ?? "\uffff").localeCompare(b.line ?? "\uffff") || (a.trip_id < b.trip_id ? -1 : a.trip_id > b.trip_id ? 1 : 0);
  const out: ScheduledRow[] = [];
  for (const g of groups) {
    const mine = PLAN_ROWS.filter((r) => r.grp === g && r.at.getTime() >= from && r.at.getTime() < to);
    out.push(...mine.filter((r) => r.at.getTime() >= pivot).sort(order).slice(0, cap), ...mine.filter((r) => r.at.getTime() < pivot).sort((a, b) => -order(a, b)).slice(0, cap));
  }
  return out.sort((a, b) => a.grp.localeCompare(b.grp) || order(a, b));
}
const TU_ROWS: readonly TripUpdateRow[] = [
  { trip_id: "fx-b132", stop_id: "de:05315:12001:1:1", stop_sequence: 3, delay_s: 180, schedule_relationship: "SCHEDULED", event_at: null, start_date: null, observed_at: ago(2) },
  { trip_id: "fx-b133", stop_id: null, stop_sequence: null, delay_s: null, schedule_relationship: "CANCELED", event_at: null, start_date: "20261003", observed_at: ago(2) },
];
// Three headlines past ALERT_FULL (280): what a publisher's long notice costs on the page, cut.
const LONG = " Fahrgäste nutzen bitte die Ersatzhaltestellen, die vor Ort ausgeschildert sind; Fahrräder können in den Ersatzbussen nicht mitgenommen werden, Fahrgäste mit Rollstuhl wenden sich bitte an das Servicepersonal, das an den Bahnsteigen und an den Ersatzhaltestellen bereitsteht.";
const ALERT_ROWS: readonly AlertNearRow[] = [
  {
    source_id: "delfi_rt_sa",
    alert_id: "fx-a1",
    header: `S11: Bauarbeiten zwischen Köln Hbf und Köln-Dellbrück, Ersatzverkehr mit Bussen.${LONG}`,
    active_from: ago(2 * 24 * 60),
    active_to: inMin(5 * 24 * 60),
    line_names: ["S11"],
    stop_ids: [],
    kreise: ["05315"],
    message_key: "delfi_rt_sa:fx-a1",
    carried_by: ["delfi_rt_sa", "delfi_siri_sx"],
  },
  {
    source_id: "delfi_rt_sa",
    alert_id: "fx-a2",
    header: `Köln Hbf: Aufzug zu Gleis 4/5 außer Betrieb, bitte nutzen Sie den Aufzug zu Gleis 6/7 und den Übergang im Untergeschoss.${LONG}`,
    active_from: ago(6 * 60),
    active_to: inMin(2 * 24 * 60),
    line_names: [],
    stop_ids: ["de:05315:11201:1:1"],
    kreise: ["05315"],
    message_key: "delfi_rt_sa:fx-a2",
    carried_by: ["delfi_rt_sa"],
  },
  {
    source_id: "delfi_rt_sa",
    alert_id: "fx-a3",
    header: `RE9: Zugausfälle zwischen Köln Messe/Deutz und Siegen Hbf wegen einer Signalstörung, Ersatzverkehr wird eingerichtet.${LONG}`,
    active_from: ago(90),
    active_to: null,
    line_names: ["RE9"],
    stop_ids: [],
    kreise: ["05315"],
    message_key: "delfi_rt_sa:fx-a3",
    carried_by: ["delfi_rt_sa"],
  },
];
/** #693, #1117: the everyday-need cards around Köln Hbf — food, lodging and car service with nothing near. */
const OSM_DAY = new Date("2026-10-01T00:00:00Z");
const poi = (need: PoiNeedRow["need"], kind: string | null, name: string | null, metres: number | null, street: string | null = null, no: string | null = null): PoiNeedRow => ({
  need,
  loaded: true,
  name,
  kind,
  street,
  house_number: no,
  metres,
  extract_date: name === null ? null : OSM_DAY,
  // The place's own point (2.0.10, the map links), none for an empty need.
  lat: name === null || metres === null ? null : Number((50.943 - metres / 160_000).toFixed(6)),
  lon: name === null || metres === null ? null : Number((6.9583 + metres / 120_000).toFixed(6)),
});
const POI_ROWS: readonly PoiNeedRow[] = [
  poi("groceries", "shop=supermarket", "Rewe City", 310, "Marzellenstraße", "5"),
  poi("health", "amenity=pharmacy", "Dom-Apotheke", 240, "Domkloster", "2"),
  poi("health", "amenity=hospital", "St. Marien-Hospital", 820, "Kunibertskloster", "11"),
  poi("money", "amenity=atm", "Sparkasse KölnBonn", 90),
  poi("food", null, null, null),
  poi("lodging", null, null, null),
  poi("garage", null, null, null),
  poi("toilets", "amenity=toilets", "Öffentliche Toilette Domplatte", 180),
  poi("police", "amenity=police", "Polizeiwache Innenstadt", 1500, "Waidmarkt", "1"),
];

/** `ROAD_NOW_SQL`'s raw rows for the place read (2.1.11, #711 C): see `PLACE_ROWS`. */
const roadRow = (o: { origin?: string; source: string; key: string; type?: string | null; title: string | null; subtitle?: string | null; road: string | null; lat: number; lon: number; from?: string; to?: string; placeText?: string }): RoadNowDbRow => ({
  origin: o.origin ?? "road_event", source: o.source, source_key: o.key, source_id: "DE-MIA", event_type: o.type ?? null, abnormal_traffic_type: null,
  title: o.title, subtitle: o.subtitle ?? null, road: o.road, referent_from: o.from ?? null, referent_to: o.to ?? null, distance_from_m: null, distance_to_m: null, extent: null,
  lon: o.lon, lat: o.lat, since: ago(300), until: inMin(4 * 1440), delay_s: null, last_seen_at: ago(4), detail: null, place_text: o.placeText ?? null, detail_text: null, jam_record: null, works_text: null, in_force: 5,
});
const ROAD_NOW_ROWS = [
  roadRow({ origin: "autobahn", source: "autobahn", key: "fx-r1", type: "closure", title: "A3 | Köln-Dellbrück - Köln-Mülheim", subtitle: " Frankfurt -> Oberhausen", road: "A3", lat: 50.955, lon: 7.0 }),
  roadRow({ origin: "autobahn", source: "autobahn", key: "fx-r2", type: "roadworks", title: "A3", subtitle: " Oberhausen -> Frankfurt", road: "A3", lat: 50.945, lon: 6.975 }),
  roadRow({ source: "bab_messages", key: "fx-r3", type: "constructionWorks", title: null, road: "A4", lat: 50.9221, lon: 7.0024, from: "Köln-Poll", to: "Köln-Gremberg" }),
  roadRow({ source: "nms_events", key: "LMS-NW/r_TIC-WZEX/42/DE-MIA/79229#RW_D  NW LMS-NW", type: "constructionWorks", title: null, road: null, lat: 50.962, lon: 6.985, placeText: "A1 Köln-Niehl" }),
  roadRow({ source: "traffic_koeln_events", key: "fx-r5", type: "roadOrCarriagewayOrLaneManagement", title: "Sperrung Dürener Straße", road: null, lat: 50.9289, lon: 6.9101, placeText: "Dürener Straße" }),
];

/**
 * 2.1.12 (#711): `find_parking`'s share-alike rows for the parking card, typed
 * by the shared statement's row. Two P+R NRW sites in Köln (CC BY-SA — every
 * fixture page answers with Köln's rows, so the budget carries the block at
 * three-row strength minus one), and one Trucklounge lorry park with its own
 * reading, which the card keeps off because the city's car parks are in reach.
 */
const shareAlike = (o: Pick<ShareAlikeParkingRow, "id" | "kind" | "name" | "attribution_id" | "source_feed" | "lat" | "lon" | "distance_m"> & Partial<ShareAlikeParkingRow>): ShareAlikeParkingRow => ({
  operator: null, road: null, address: null, capacity_total: null, capacity_truck: null, capacity_disabled: null, ...o,
});
const NRW_PR_ROWS: readonly ShareAlikeParkingRow[] = [
  shareAlike({ id: 9001, kind: "park_and_ride", name: "P+R Köln-Weiden Zentrum", attribution_id: "mobilithek_park_nrw_pr", source_feed: "park_nrw_pr", lat: 50.9396, lon: 6.8297, distance_m: "3900", capacity_total: 210 }),
  shareAlike({ id: 9002, kind: "park_and_ride", name: "P+R Köln-Bocklemünd", attribution_id: "mobilithek_park_nrw_pr", source_feed: "park_nrw_pr", lat: 50.9693, lon: 6.8686, distance_m: "4800", capacity_total: 400 }),
];
// The source's one site, as the recorded publications carry it
// (fixtures/mobilithek/recorded/park-trucklounge-static.xml, its point repaired
// from the swapped pair; -dyn-status.xml, 48 vacant): Trucklounge Ecopark at
// Emstek on the A1, no capacity published. The distance is the fixture's — it
// answers every place, as the other rows here do.
const TRUCKLOUNGE_ROWS: readonly ShareAlikeParkingRow[] = [
  shareAlike({
    id: 9101, kind: "truck", name: "Trucklounge Ecopark", operator: "ENMO GmbH & Co.KG", road: "A1", attribution_id: "mobilithek_park_trucklounge", source_feed: "park_trucklounge_static", lat: 52.8153, lon: 8.1878, distance_m: "5600",
    spaces_free: 48, spaces_total: null, occupancy_pct: null, status: "spacesAvailable", observed_at: ago(4), feed_ts: ago(5), occupancy_feed: "park_trucklounge_dyn", occupancy_attribution: "mobilithek_park_trucklounge_occ", unchanged_since: ago(5), unchanged_since_at_least: false,
  }),
];

/**
 * #715 (2.1.13): the motorways around the fixture's place (`MOTORWAYS_NEAR_SQL`:
 * the nearest junction per motorway) and their per-motorway summary rows — the
 * Autobahn card reads only these two. The A3 and A4 rows of `ROAD_NOW_ROWS` are
 * its near items.
 */
/**
 * #1000: the motorways nearest the fixture's place, at junctions the fixture's motorway pages really list — so a
 * place card's link to a motorway page centred on its exit lands on that exit (the crawl of journey-1000.e2e.ts),
 * as production's do (both read the same register). Built on first use: the A4's points are declared below.
 */
const MOTORWAY_NEAR_AT: readonly { readonly road: string; readonly i: number; readonly metres: number }[] = [
  { road: "A3", i: 6, metres: 2100 },
  { road: "A4", i: 5, metres: 3400 },
  { road: "A1", i: 6, metres: 5200 },
  { road: "A57", i: 4, metres: 6100 },
];
function motorwayNearRows(): MotorwayNearRow[] {
  return MOTORWAY_NEAR_AT.map((x) => {
    const p = motorwayPoints(x.road)[x.i]!;
    return { road: x.road, lcd: p.lcd, stcd: p.stcd, junction_no: p.junction_no, name: p.name, metres: x.metres, lat: p.lat, lon: p.lon };
  });
}
/** The register the fixture holds: every road a page or a link names, natural order. */
// 2.1.17 (#716 search): A34, a motorway the LCL records no course of, and A61, whose chain breaks once — both quiet, so the home's
// catalogue of the most affected is unchanged.
// #1051 (D3): the A10 of the owner's 2026-10-25 reading — two jams and one roadworks site, every other topic empty, so
// its page has a quiet line after the cards and the detours' weekly source beside the half-hourly ones.
const MOTORWAY_REGISTER = ["A1", "A2", "A3", "A4", "A5", "A6", "A7", "A8", "A9", "A10", "A34", "A57", "A61"];
/** #1051: the A10 world — 2 jams, 1 roadworks, no closure, no warning, nothing planned. */
const A10 = "A10";
/** The fixture's roads with nothing reported (an empty listing, no event, zero counts). */
const QUIET_ROADS: readonly string[] = ["A34", "A61"];
/**
 * #901 D13: the A4 between Aachen and Köln as planted data — its own short course (invented points on the real
 * junctions' rough places) with AS Düren (5) and AS Kerpen (6), so "Sie sind hier – zwischen AS Düren (5) und AS Kerpen
 * (6)" can be driven in a browser towards Köln. In the LCL's order, west to east; the last junction is Köln-Lövenich.
 */
const A4_POINTS: readonly { readonly name: string; readonly no: string | null; readonly kind: "junction" | "service" | "other"; readonly ak?: boolean; readonly lat: number; readonly lon: number }[] = [
  { name: "Aachen-Laurensberg", no: "1", kind: "junction", lat: 50.8, lon: 6.06 },
  { name: "Aachen", no: "2", kind: "junction", ak: true, lat: 50.8, lon: 6.13 },
  { name: "Eschweiler-West", no: "3", kind: "junction", lat: 50.82, lon: 6.22 },
  { name: "Aachener Land", no: null, kind: "service", lat: 50.83, lon: 6.28 },
  { name: "Weisweiler", no: "4", kind: "junction", lat: 50.83, lon: 6.32 },
  { name: "Düren", no: "5", kind: "junction", lat: 50.84, lon: 6.47 },
  { name: "Kerpen", no: "6", kind: "junction", lat: 50.88, lon: 6.69 },
  { name: "Frechen-Nord", no: null, kind: "other", lat: 50.9, lon: 6.75 },
  { name: "Frechen", no: "7", kind: "junction", lat: 50.92, lon: 6.8 },
  { name: "Köln-Lövenich", no: "8", kind: "junction", lat: 50.94, lon: 6.86 },
];
/** How many LCL points a fixture road has: the A7 at production's size, the A34 none (no course), the A4 its planted course, every other a short version. */
const pointCount = (road: string): number => (heavy(road) ? 320 : road === "A34" ? 0 : road === "A4" ? A4_POINTS.length : 36);
const SUMMARY_AT = ago(3);
const summaryRow = (road: string, closures: number, jams: number, warnings: number, roadworks: number): MotorwaySummaryRow => ({
  road, refreshed_at: SUMMARY_AT, read_at: ago(4), tick: ago(4), closures, jams, warnings, roadworks,
  by_direction: closures + jams + roadworks === 0 ? [] : [
    { direction: "Hamburg → Würzburg", closures, jams: Math.ceil(jams / 2), roadworks: Math.ceil(roadworks / 2) },
    { direction: "Würzburg → Hamburg", closures: 0, jams: Math.floor(jams / 2), roadworks: Math.floor(roadworks / 2) },
  ],
  worst: closures === 0 ? null : { kind: "closure", title: `${road} | AS Fulda-Nord - AS Fulda-Mitte`, subtitle: " Hamburg -> Würzburg", abnormal_traffic_type: null, delay_s: null, lat: 50.6, lon: 9.7, segments: 1 },
  next_closure: closures === 0 ? null : { title: `${road} | AS Kassel-Nord - AS Kassel-Mitte`, subtitle: " Hamburg -> Würzburg", start_ts: new Date(NOW.getTime() + 2 * 86_400_000).toISOString(), lat: 51.3, lon: 9.5 },
  sources: ["autobahn"],
});
const MOTORWAY_SUMMARY: readonly MotorwaySummaryRow[] = MOTORWAY_REGISTER.map((r, i) => (r === "A7" ? summaryRow(r, 6, 8, 2, 40) : r === "A4" ? summaryRow(r, 1, 0, 0, 2) : r === A10 ? summaryRow(r, 0, 2, 0, 1) : QUIET_ROADS.includes(r) ? summaryRow(r, 0, 0, 0, 0) : summaryRow(r, i % 3, i % 4, 0, 5 + i)));

/**
 * The A7 at production's size: its LCL junctions from Flensburg to Füssen
 * (about two hundred), and the listing `check_road_status {road: "A7"}` reads —
 * six closures, forty roadworks — so the page budget measures the longest
 * motorway at a heavy hour. Every other road answers a short version.
 */
function motorwayPoints(road: string): MotorwayPointRow[] {
  if (road === "A4")
    return A4_POINTS.map((x, i) => ({
      lcd: 30000 + i, tcd: x.kind === "junction" ? 1 : 3, stcd: x.kind === "service" ? 3 : x.kind === "other" ? 8 : x.ak === true ? 2 : 3, junction_no: x.no,
      name: x.kind === "service" ? `Rastanlage ${x.name}` : x.name,
      neg_off_lcd: i === 0 ? null : 30000 + i - 1, pos_off_lcd: i === A4_POINTS.length - 1 ? null : 30000 + i + 1, lat: x.lat, lon: x.lon,
      gemeinde_ags: null, town_ags: null, town_name: null,
    }));
  // #716: the A7 in production's proportions (read 2026-10-14: 320 LCL points, 141 of them junctions, 25 Tank- und
  // Rastanlagen, the rest other points of the chain such as rest areas) — four of every nine points a junction, every
  // thirteenth of the others a service area (LCL P3.3) — and its chain broken once in the middle (M3: the line breaks too).
  const n = pointCount(road);
  const gap = road === "A7" ? 160 : road === "A61" ? 18 : -1;
  const kindOf = (i: number): "junction" | "service" | "other" => ([0, 2, 4, 6].includes(i % 9) ? "junction" : i % 13 === 1 || i % 13 === 5 ? "service" : "other");
  const rows = Array.from({ length: n }, (_, i) => ({
    lcd: 20000 + i, tcd: kindOf(i) === "junction" ? 1 : 3, stcd: kindOf(i) === "service" ? 3 : kindOf(i) === "other" ? 8 : i % (PRODUCTION_SCALE && heavy(road) ? 5 : 7) === 0 ? 2 : 3, junction_no: kindOf(i) === "junction" ? String(i + 1) : null,
    name: kindOf(i) === "service" ? `Rastanlage ${pointName(road, i, "Beispielwald")}` : kindOf(i) === "other" ? pointName(road, i, "Beispielfeld") : `${pointName(road, i, road === "A7" ? "Musterstadt" : "Beispielort", "-")}${["Nord", "Süd", "Ost", "West", "Mitte"][i % 5]!}${PRODUCTION_SCALE && heavy(road) ? "" : ` ${String(i + 1)}`}`,
    neg_off_lcd: i === 0 || i === gap + 1 ? null : 20000 + i - 1, pos_off_lcd: i === n - 1 || i === gap ? null : 20000 + i + 1, ...courseAt(road, i, n),
    gemeinde_ags: i % 6 === 0 ? `0${String(1001000 + i)}` : null, town_ags: i % 12 === 0 ? townOf(i).ags : null, town_name: i % 12 === 0 ? townOf(i).name : null,
  }));
  // 2.4.1 (#1066 review S2): at production scale a heavy road has one number and name its LCL gives an AD, an AK and an
  // AS alike (the A52's "25 Breitscheid" three times), so the stretch picker's typed labels — the longest words of the
  // page's language, in both selects — are measured. Points 45 (an AD), 47 and 49 (both junctions) share 45's.
  if (PRODUCTION_SCALE && heavy(road) && n > 50) {
    const lead = rows[45]!;
    rows[47] = { ...rows[47]!, junction_no: lead.junction_no, name: lead.name, stcd: 3 };
    rows[49] = { ...rows[49]!, junction_no: lead.junction_no, name: lead.name, stcd: 1 };
  }
  return rows;
}
/**
 * The town an LCL point names (every twelfth point): a place this fixture answers for (`POPULAR_PLACES`), as every
 * town of production's LCL is a Gemeinde with a place page — an invented "Stadt N" made each entry's "bei <town>"
 * link (#1061) a 404 the journey's dead-end walk found.
 */
const townOf = (i: number): { readonly ags: string; readonly name: string } => POPULAR_PLACES[Math.floor(i / 12) % POPULAR_PLACES.length]!;

function motorwayListing(road: string): RoadStatusAutobahnRow[] {
  if (QUIET_ROADS.includes(road)) return [];
  // #901 D13: on the planted A4, one roadworks BEHIND a driver between Düren and Kerpen heading for Köln (at Weisweiler)
  // and one roadworks and one closure AHEAD (at Frechen-Nord and Frechen), each ON the line.
  if (road === "A4") {
    const row = (kind: "closure" | "roadworks", k: number, title: string, i: number): RoadStatusAutobahnRow => ({
      feed_key: "autobahn", road, kind, ext_id: `A4-d13-${String(i)}`, title, subtitle: " Aachen -> Köln", lat: A4_POINTS[k]!.lat + 0.001, lon: A4_POINTS[k]!.lon + 0.001,
      is_blocked: kind === "closure" ? "true" : "false", start_ts: ago(900 + i * 60).toISOString(), segments: 1, total_rows: 3, total_closed: 1,
    });
    return [row("closure", 8, "A4 | AS Frechen - AS Köln-Lövenich", 0), row("roadworks", 4, "A4 | AS Weisweiler - AS Düren", 1), row("roadworks", 7, "A4 | AS Kerpen - AS Frechen", 2)];
  }
  // #1051: the A10's one roadworks site, ON its line, and no closure
  if (road === A10) {
    const p = onLine(A10, 12);
    return [{ feed_key: "autobahn", road, kind: "roadworks", ext_id: "A10-w0", title: "A10 | AS Beispielort-West 12 - AS Beispielort-Ost 13", subtitle: " Berliner Ring", ...p, is_blocked: "false", start_ts: ago(20_000).toISOString(), segments: 1, total_rows: 1, total_closed: 0 }];
  }
  const big = heavy(road);
  const rows: RoadStatusAutobahnRow[] = [];
  // #1000: the A1's one closure lies at its first junction (the AD the A7 meets it at), so the journey starts at a red lamp
  const at0 = road === "A1" ? motorwayPoints("A1")[0]! : null;
  // #1064: production's per-card maxima at production scale (8 closures on the A1/A7, 46 roadworks on the A7)
  const closures = big ? (PRODUCTION_SCALE ? 8 : 6) : 1;
  const works = big ? (PRODUCTION_SCALE ? 46 : 40) : 4;
  const total = closures + works;
  for (let i = 0; i < closures; i++) rows.push({ ...otherYears(big, i), feed_key: "autobahn", road, kind: "closure", ext_id: `${road}-c${String(i)}`, title: `${road} | AS Musterstadt-Nord ${String(i * 3)} - AS Musterstadt-Süd ${String(i * 3 + 1)}`, subtitle: i % 2 === 0 ? " Flensburg -> Füssen" : " Füssen -> Flensburg", lat: at0 !== null && i === 0 ? at0.lat : 53 - i * 0.3, lon: at0 !== null && i === 0 ? at0.lon : 9.8, is_blocked: "true", start_ts: ago(600 + i * 30).toISOString(), segments: 1, total_rows: total, total_closed: closures });
  // #1064: at production scale each works site its own section and kind of work, in the publisher's style
  const worksTitle = (i: number): string =>
    PRODUCTION_SCALE ? `${road} | ${i % 4 === 0 ? "AK" : "AS"} ${inventedName(i + 23)} - AS ${inventedName(i + 37)}${i % 3 === 0 ? `, BW${String(10 + i * 7)}` : ""}, ${["Fahrbahnerneuerung", "Brückenersatzneubau", "Lärmschutzwand", "Fahrbahnverbreiterung", "Entwässerung", "Mittelstreifenüberfahrt"][i % 6]!}` : `${road} | AS Beispielort-West ${String(i)} - AS Beispielort-Ost ${String(i + 1)}`;
  for (let i = 0; i < works; i++) rows.push({ ...otherYears(big, i), feed_key: "autobahn", road, kind: "roadworks", ext_id: `${road}-w${String(i)}`, title: worksTitle(i), subtitle: i % 2 === 0 ? " Flensburg -> Füssen" : " Füssen -> Flensburg", lat: 54 - i * 0.15, lon: 9.6, is_blocked: "false", start_ts: ago(20_000 + i * 60).toISOString(), segments: 1, total_rows: total, total_closed: closures });
  return rows;
}
/** "05.11.24" — a date as the Autobahn GmbH writes it in a description line (UTC parts; the fixture's times are midday). */
const pubDate = (d: Date): string => `${String(d.getUTCDate()).padStart(2, "0")}.${String(d.getUTCMonth() + 1).padStart(2, "0")}.${String(d.getUTCFullYear() % 100).padStart(2, "0")}`;
/**
 * 2.4.1 (#1066 review S2): at production scale every fourth live closure and roadworks site of a heavy road states its
 * window in the publisher's words, begun more than a year ago and ending more than a year ahead, so both ends are
 * another year's and every card that prints them says the year (+5–8 B a date in each language). The share is the
 * recorded A9 listing's (`fixtures/autobahn/A9_roadworks.json`: 3 of 12 roadworks rows carry a date of another year,
 * 2 of 9 closures in `A9_closure.json`); both ends of the window another year's is the heavier reading of it.
 */
function otherYears(big: boolean, i: number): { readonly description?: readonly string[] } {
  if (!PRODUCTION_SCALE || !big || i % 4 !== 1) return {};
  const from = new Date(NOW.getTime() - (420 + i) * 86_400_000);
  const to = new Date(NOW.getTime() + (420 + i * 3) * 86_400_000);
  return { description: [`Beginn: ${pubDate(from)} um 06:00 Uhr`, `Ende: ${pubDate(to)} um 18:00 Uhr`] };
}
/** #716: an event placed ON the fixture's LCL point `k` (motorwayPoints' own formula), so the map draws it on the line. */
function onLine(road: string, k: number): { lat: number; lon: number } {
  const n = pointCount(road);
  const c = courseAt(road, k % n, n);
  return { lat: c.lat + 0.001, lon: c.lon + 0.001 };
}
function motorwayEvents(road: string): AutobahnEventRow[] {
  if (QUIET_ROADS.includes(road) || road === "A4") return [];
  // #1051: the A10's two jams, and nothing else of the Autobahn GmbH's events
  if (road === A10)
    return [0, 1].map((i) => ({ road, kind: "warning", ext_id: `A10-e${String(i)}`, title: `A10 | AS Beispielort-Nord ${String(5 + i * 10)} - AS Beispielort-Süd ${String(6 + i * 10)}`, subtitle: " Berliner Ring", abnormal_traffic_type: i === 0 ? "STATIONARY_TRAFFIC" : "QUEUING_TRAFFIC", delay_s: 600 + i * 300, ...onLine(road, 5 + i * 10), avg_speed: "20", segments: 1 }));
  // #1064: at production scale the heavy roads carry production's eight jams and eight closures
  const big = PRODUCTION_SCALE && heavy(road);
  const n = big ? 16 : road === "A7" ? 10 : 2;
  const jams = big ? 8 : 2;
  return Array.from({ length: n }, (_, i) => ({ road, kind: i < jams ? "warning" : "closure", ext_id: `${road}-e${String(i)}`, title: big ? `${road} | AS ${inventedName(i + 51)} - AS ${inventedName(i + 52)}` : `${road} | AS Musterstadt-Mitte ${String(i)} - AS Musterstadt-Süd ${String(i + 1)}`, subtitle: big && i % 2 === 1 ? " Füssen -> Flensburg" : " Flensburg -> Füssen", abnormal_traffic_type: i < jams ? (i % 2 === 0 ? "STATIONARY_TRAFFIC" : "QUEUING_TRAFFIC") : null, delay_s: i < jams ? (big ? 240 + ((i * 431) % 2_400) : 900 + i * 300) : null, ...onLine(road, 30 + i * (big ? 17 : 9)), avg_speed: i < jams ? "15" : null, segments: 1 }));
}
/**
 * 2.1.16 (#716 D): `check_road_status {road, horizon_days: 7}`'s listing (the
 * same statement, kinds `["closure"]` only) — the A7 at a heavy week: six
 * full closures announced over the next days, one of them with a signed BW
 * detour; every other road none, so its page says so.
 */
function motorwayPlanned(road: string): RoadStatusAutobahnRow[] {
  if (!heavy(road)) return [];
  // #1064: production's 49 announced closures on the A7 at production scale
  const n = PRODUCTION_SCALE ? 49 : 6;
  return Array.from({ length: n }, (_, i) => ({
    feed_key: "autobahn", road, kind: "closure", ext_id: `${road}-p${String(i)}`,
    title: `${road} | AS Musterstadt-Nord ${String(40 + i * 7)} - AS Musterstadt-Süd ${String(41 + i * 7)}`,
    subtitle: i % 2 === 0 ? " Flensburg -> Füssen" : " Füssen -> Flensburg", lat: 52 - (i % 6) * 0.4 - Math.floor(i / 6) * 0.05, lon: 9.7, is_blocked: "false",
    start_ts: new Date(NOW.getTime() + (i + 1) * (n > 6 ? 3 : 20) * 3_600_000).toISOString(), segments: 1, total_rows: n, total_closed: n,
  }));
}
/** The signed detour the first planned closure names (the BW register's shape, #492). */
const MOTORWAY_DETOURS = [{ autobahn: "A7", u_number: "U 12", direction: "Füssen", extra: null, from_junction_no: "41", from_junction: "Musterstadt-Nord 40", to_junction_no: "42", to_junction: "Musterstadt-Süd 41", route: "über die B 27 und die L 1080", version_date: "2026-09-30" }];
/** #1064: production's eight signed detours on the A7, at production scale on both heavy roads (the BW register's shape). */
function motorwayDetours(road: string): typeof MOTORWAY_DETOURS {
  if (!PRODUCTION_SCALE || !heavy(road)) return MOTORWAY_DETOURS.filter((d) => d.autobahn === road);
  return Array.from({ length: 8 }, (_, i) => ({
    autobahn: road, u_number: `U ${String(12 + i * 3)}`, direction: i % 2 === 0 ? "Füssen" : "Flensburg", extra: null,
    from_junction_no: String(41 + i * 9), from_junction: `Musterstadt-Nord ${String(40 + i * 9)}`, to_junction_no: String(42 + i * 9), to_junction: `Musterstadt-Süd ${String(41 + i * 9)}`,
    route: `über die B ${String(27 + i * 4)} und die L ${String(1080 + i * 13)}`, version_date: "2026-09-30",
  }));
}
/**
 * The interchanges of every fixture motorway: each AD point (the fixture's P1.2) meets the motorway's NEIGHBOURS in
 * the register (i−1 and i+1) — one or two motorways per crossing, production's shape (prod /de/autobahn/a1 on
 * 2026-10-25: 29 crossings, 31 motorway links; `test/fixtures/motorway-profile.json` `crossings`). The relation is
 * SYMMETRIC, as the LCL's is (#1048): when the A7 meets the A6 there, the A6 meets the A7 there too. The first draft
 * of that symmetry closed over "the first two of the register", which made the A1 and the A2 meet every motorway —
 * about 15 links a crossing, 4.3 KB a row, a crossings card three times production's (#1061 measured it).
 */
const meetsOf = (road: string): readonly string[] => {
  const i = MOTORWAY_REGISTER.indexOf(road);
  const neighbours = i < 0 ? [] : [MOTORWAY_REGISTER[i - 1], MOTORWAY_REGISTER[i + 1]].filter((x): x is string => x !== undefined);
  // the journey's world (#1000, `journey-1000.e2e.ts`): the A7 meets the A1 too — both ways, so at most three a crossing
  const named = WORLD_MEETS.flatMap(([a, b]) => (a === road ? [b] : b === road ? [a] : []));
  return [...neighbours, ...named.filter((x) => !neighbours.includes(x))];
};
/** Meetings beyond the register neighbours that a journey test walks: each pair meets both ways. */
const WORLD_MEETS: readonly (readonly [string, string])[] = [["A1", "A7"]];
function motorwayInterchanges(): MotorwayInterchangeRow[] {
  const out: MotorwayInterchangeRow[] = [];
  for (const road of MOTORWAY_REGISTER)
    for (const p of motorwayPoints(road))
      if (p.tcd === 1 && p.stcd === 2)
        for (const meets of meetsOf(road)) {
          // #1000: the other motorway's own junction there (the same point of its chain), so the crossing links to it
          const other = road === "A4" || meets === "A4" ? undefined : motorwayPoints(meets).find((q) => q.lcd === p.lcd && q.tcd === 1);
          out.push({ road, lcd: p.lcd, meets, ...(other === undefined ? {} : { meets_lcd: other.lcd, meets_no: other.junction_no, meets_name: other.name }) });
        }
  return out;
}
const motorwayQuery = (text: string, params?: readonly unknown[]): Promise<{ rows: unknown[] }> => {
    const first = params?.[0];
    const road = typeof first === "string" ? first : Array.isArray(first) && typeof first[0] === "string" ? first[0] : "";
    const rows = ((): readonly unknown[] => {
      if (text === MOTORWAY_REGISTER_SQL) return MOTORWAY_REGISTER.map((r) => ({ road: r }));
      // #1183: the live map's slider — a sweep a minute before every asked hour; the A1 closed at 08:00 Berlin alone
      if (text === ROAD_STATUS_AUTOBAHN_TICKS) return ((params?.[0] as readonly string[] | undefined) ?? []).map((r) => ({ road: r, t: new Date((params?.[1] as Date).getTime() - 60_000) }));
      if (text === SUMMARY_AUTOBAHN_COUNTS_AT_TICKS) return berlinWallClock(params?.[2] as Date).hour === 8 ? [{ road: "A1", kind: "closure", n: 1, jams: 0, announced: 0, announced_from: null }] : [];
      if (text === MOTORWAY_SUMMARY_VERSION_SQL) return [{ refreshed_at: SUMMARY_AT, n: MOTORWAY_SUMMARY.length }];
      if (text === MOTORWAY_SUMMARY_SQL || text === MOTORWAY_SUMMARY_PAGE_SQL) {
        const want = params?.[0] as readonly string[] | null | undefined;
        return MOTORWAY_SUMMARY.filter((s) => want === null || want === undefined || want.includes(s.road));
      }
      if (text === MOTORWAY_POINTS_SQL) return motorwayPoints(road);
      // The planned listing is the same statement with the closures alone as its kinds ($3).
      // The planned-closures call and the live listing run the SAME statement; this mirrors `plannedParams`
      // (packages/digest/src/queries/motorway-read.ts), whose kinds parameter ($3) is the one-element ["closure"]
      // while the live listing passes every summary kind — change one and change the other.
      if (text === ROAD_STATUS_AUTOBAHN) return Array.isArray(params?.[2]) && (params[2] as unknown[]).length === 1 ? motorwayPlanned(road) : motorwayListing(road);
      if (text === DETOURS_ON_ROADS_SQL) return motorwayDetours(road);
      // #1064: the police and Land messages along a heavy road's line, at production scale only.
      // (at e2e scale these three statements fall through below, exactly as before #1064)
      if (PRODUCTION_SCALE && text === ROAD_NOW_ALONG_SQL) return motorwayMessages();
      // #1064: the Autobahn GmbH's short-duration works (AkD) on a heavy road, at production scale only — the feeds checked just now.
      if (PRODUCTION_SCALE && text === MOTORWAY_PLAN_CHECKS_SQL) return ((params?.[0] as readonly string[] | undefined) ?? []).map((feed_key) => ({ feed_key, cadence_s: 600, checked_at: ago(2) }));
      if (PRODUCTION_SCALE && text === MOTORWAY_PLANS_SQL) return motorwayAkd((params?.[1] as readonly string[] | undefined) ?? []);
      if (text === MOTORWAY_INTERCHANGES_SQL) return motorwayInterchanges();
      if (text === MOTORWAY_CITIES_SQL) return citiesAlong(road);
      if (text === PLACES_MOTORWAYS_SQL) return placesMotorways((params?.[0] as readonly string[] | undefined) ?? []);
      if (text === MOTORWAY_OVERVIEW_SQL) return MOTORWAY_REGISTER.flatMap((r) => motorwayPoints(r).map((p) => ({ road: r, ...p })));
      // #984: the motorway maps' towns (GN250 Gemeinden), the Großstädte and a scatter along the fixture A7.
      if (text === MAP_TOWNS_SQL) return MAP_TOWNS;
      if (text === AUTOBAHN_EVENTS_AT_TICKS) return motorwayEvents(road);
      // review S2 (#987): one border crossing along the A9 (its tenth point), so a fixture road with items has the
      // bridges-and-borders block — tier D, compact, after every card of the grid.
      if (text === ROAD_CONTEXT_ALONG) return params?.[11] === "A9" ? [a9Border()] : PRODUCTION_SCALE && typeof params?.[11] === "string" && heavy(params[11]) ? signedDetoursAlong(params[11]) : [];
      // #1099: the maps' streets — this fixture holds none, so every map is drawn exactly as before (and the layer
      // rows below never see an envelope where they expect a corridor)
      if (/\bfrom osm_streets s\b/.test(text)) return [];
      // #1183: the live map's rail dots, the warned Kreis (Köln, Stufe 2) and the CC BY-SA delay layer (Köln: cancellations)
      if (text === LIVE_MAP_STATIONS_SQL) return [
        { slug: "koeln-hbf", name: "Köln Hbf", ifopt: "de:05315:11201", lat: 50.9430, lon: 6.9589 },
        { slug: "kassel-hbf", name: "Kassel Hbf", ifopt: "de:06611:1", lat: 51.318, lon: 9.489 },
      ];
      if (text === LIVE_MAP_WARNINGS_SQL) return [{ kreis: "05315", level: 2, events: ["STURMBÖEN"] }];
      if (text === LIVE_FEEDS_CHECKED_SQL) return ((params?.[0] as readonly string[] | undefined) ?? []).map((feed_key) => ({ feed_key, checked_at: ago(1), cadence_s: 60, paused: false }));
      if (text === STATION_TOP_DISRUPTION_SQL) return ((params?.[1] as readonly string[] | undefined) ?? []).includes("de:05315:11201") ? [{ station_dhid: "de:05315:11201", cancelled: 1, late: 2 }] : [];
      // #716: the service layers and the fuel fragment.
      return motorwayLayerRows(NOW, text, params) ?? [];
    })();
    return Promise.resolve({ rows: [...rows] });
};
/**
 * #1000: the place ↔ motorway relation of the fixture, both directions from ONE table (the statements are each
 * other's inverse in the database, by test): Köln along the A1 and the A3 at their seventh junction, Düsseldorf along
 * the A3 at its fourteenth, Essen along none. The neighbours are those three, the asking place left out.
 */
const ALONG: readonly { readonly ags: string; readonly name: string; readonly road: string; readonly i: number }[] = [
  { ags: "05315000", name: "Köln", road: "A1", i: 6 },
  { ags: "05315000", name: "Köln", road: "A3", i: 6 },
  { ags: "05111000", name: "Düsseldorf", road: "A3", i: 13 },
];
const NEIGHBOUR_TOWNS = [
  { ags: "05315000", name: "Köln", population: 1_080_000, lat: 50.94, lon: 6.96 },
  { ags: "05111000", name: "Düsseldorf", population: 620_000, lat: 51.23, lon: 6.78 },
  { ags: "05113000", name: "Essen", population: 580_000, lat: 51.46, lon: 7.01 },
];
function placesMotorways(ags: readonly string[]): PlaceMotorwayRow[] {
  return ags.flatMap((a) => {
    const rows = ALONG.filter((x) => x.ags === a).map((x): PlaceMotorwayRow => {
      const p = motorwayPoints(x.road)[x.i]!;
      return { ags: a, reach: 15_000, road: x.road, lcd: p.lcd, junction_no: p.junction_no, name: p.name, metres: 4_000, lat: p.lat, lon: p.lon };
    });
    return rows.length > 0 ? rows : [{ ags: a, reach: 15_000, road: null, lcd: null, junction_no: null, name: null, metres: null, lat: null, lon: null }];
  });
}
/** The A9's planted border crossing (`ROAD_CONTEXT_ALONG`'s row shape), at the road's tenth point. */
function a9Border(): RoadContextRow {
  const p = motorwayPoints("A9")[9]!;
  return {
    kind: "border_crossing", source_feed: "bb_grenzuebergaenge", feature_id: "gu:fx-a9", variant: "motorway", name: "Musterübergang", ref: "A9",
    detail_text: "A9, Grenzübergang Musterübergang (D) – Musterort (PL)", props: { far_side: "Musterort", country: "PL" },
    lat: Number(p.lat), lon: Number(p.lon), distance_m: 300, last_seen_at: NOW, total: 1, variants: { motorway: 1 },
  };
}
/**
 * #1064: the cities along a heavy road at production scale — production's 160 on the A3 (2026-10-25): about one in
 * twelve a Großstadt, a third Mittelstädte, the rest smaller Gemeinden behind the card's fold; a few with a website.
 */
function citiesAtScale(road: string): MotorwayCityRow[] {
  // at the road's junctions (the card lists a city by its exit) and inside its class's reach (`CITY_REACH`)
  const pts = motorwayPoints(road).filter((x) => x.tcd === 1);
  return Array.from({ length: 160 }, (_, i) => {
    const p = pts[(i * 7) % pts.length]!;
    const population = i % 12 === 0 ? 120_000 + i * 900 : i % 3 === 1 ? 21_000 + i * 150 : 4_000 + i * 20;
    const name = `${inventedName(i)}${i >= 64 ? ` an der ${NAME_HEAD[(i * 3) % NAME_HEAD.length]!.trim()}${NAME_TAIL[i % NAME_TAIL.length]!}` : ""}`;
    return {
      ags: String(3_100_000 + i * 37).padStart(8, "0"), name, population, lat: p.lat + 0.03 + (i % 5) * 0.004, lon: p.lon - 0.02 - (i % 7) * 0.003,
      lcd: p.lcd, junction_no: p.junction_no, junction_name: p.name, metres: 600 + (i * 137) % 2_300,
      website: i % 24 === 0 ? `https://www.${slugify(name)}.example/` : null, loaded_at: new Date("2026-10-01T03:00:00Z"),
    };
  });
}
/**
 * #1064: production's police and Land messages along a heavy road (31 on the A1, 2026-10-25) — Land feeds' works and
 * traffic messages that name the road, each at its own place on the line (never one site, so none is folded away).
 */
function motorwayMessages(): RoadNowDbRow[] {
  const feeds = ["traffic_bw", "traffic_sh", "traffic_berlin", "traffic_lms_berlin"];
  const types = ["constructionWorks", "roadOrCarriagewayOrLaneManagement", "maintenanceWorks", "laneClosures"];
  return ["A1", "A7"].flatMap((road) => {
    const pts = motorwayPoints(road);
    return Array.from({ length: 31 }, (_, i) => {
      const p = pts[(i * 10 + 3) % pts.length]!;
      return {
        ...roadRow({ source: feeds[i % feeds.length]!, key: `fx-m-${road}-${String(i)}`, type: types[i % types.length]!, title: `${road} ${inventedName(i + 3)} - ${inventedName(i + 11)}, ${i % 3 === 0 ? "Fahrstreifen gesperrt" : i % 3 === 1 ? "Baustelle, Fahrbahnverengung" : "Tagesbaustelle"}`, road, lat: p.lat + 0.0005, lon: p.lon + 0.0005, from: inventedName(i + 3), to: inventedName(i + 11) }),
        subtitle: `Richtung ${inventedName(i + 20)}`,
        detail_text: `Zwischen ${inventedName(i + 3)} und ${inventedName(i + 11)} ist ${["der rechte Fahrstreifen", "der linke Fahrstreifen", "der Standstreifen", "die Auffahrt"][i % 4]!} ${i % 3 === 0 ? `täglich von ${String(6 + (i % 5))}:00 bis ${String(15 + (i % 6))}:00 Uhr` : `bis voraussichtlich ${String(1 + (i % 28))}.11.`} gesperrt${i % 5 === 0 ? `, Umleitung über die U ${String(10 + i)}` : ""}.`,
      };
    });
  });
}
/** #1064: production's AkD plans on the A7 (2026-10-25): with the ten planned closures, the card's 49 entries; each its own works section. */
function motorwayAkd(roads: readonly string[]): unknown[] {
  const feed = MOTORWAY_PLANS_ONLY_FEEDS[0];
  if (feed === undefined) return [];
  const works = ["Fahrbahninstandsetzung", "Brückenprüfung", "Markierungsarbeiten", "Gehölzpflege", "Schutzplankenreparatur", "Reinigungsarbeiten", "Beschilderung"];
  return roads.filter((r) => heavy(r)).flatMap((road) =>
    Array.from({ length: 39 }, (_, i) => {
      const nowIn = i % 3 !== 0;
      const from = nowIn ? ago(60 * 24 * (1 + (i % 9))) : inMin(60 * (6 + i * 3));
      return {
        feed_key: feed, source_id: "DE-AKD", publication_id: `fx-akd-${road}-${String(i)}`, road_number: road, event_type: "maintenanceWorks",
        referent_from: null, referent_to: null, name: null, via: null, words: null,
        section: `${road} von ${inventedName(i + 5)} (${i % 2 === 0 ? "AS" : "Rastplatz"}) nach ${inventedName(i + 13)} (AS) ${works[i % works.length]!}`,
        window_from: from, window_to: inMin(60 * 24 * (3 + (i % 20))), now_in_force: nowIn, on_road: 39,
      };
    }),
  );
}
/** #1064: Hamburg's signed motorway detours along a heavy road (production's A1 lists a dozen, 2026-10-25), invented streets. */
function signedDetoursAlong(road: string): unknown[] {
  const pts = motorwayPoints(road);
  return Array.from({ length: 14 }, (_, i) => {
    const p = pts[(5 + i * 3) % pts.length]!;
    const u = `U ${String(70 + i * 3)}`;
    const street = `${inventedName(i + 71)}er ${["Weg", "Straße", "Damm", "Brücke"][i % 4]!}`;
    return {
      kind: "motorway_detour", source_feed: "hh_bedarfsumleitungen", feature_id: `bu:fx${String(1000 + i)}`, variant: "signed", name: i % 2 === 0 ? `${u} ${inventedName(i + 80)}` : u, ref: u, detail_text: street,
      props: { umleitung: u, strassenname: street, klasse: "G", wegeart: "Stadtstraße", richtung: "in Stationierungsrichtung" },
      lat: Number(p.lat) + 0.0004, lon: Number(p.lon) + 0.0004, distance_m: 50 + i * 20, last_seen_at: NOW, total: 14, variants: { signed: 14 },
    };
  });
}
function citiesAlong(road: string): MotorwayCityRow[] {
  if (PRODUCTION_SCALE && heavy(road)) return [...citiesListed(road), ...citiesAtScale(road)];
  return citiesListed(road);
}
function citiesListed(road: string): MotorwayCityRow[] {
  return ALONG.filter((x) => x.road === road).map((x) => {
    const p = motorwayPoints(road)[x.i]!;
    const t = NEIGHBOUR_TOWNS.find((n) => n.ags === x.ags)!;
    return { ags: x.ags, name: x.name, population: t.population, lat: t.lat, lon: t.lon, lcd: p.lcd, junction_no: p.junction_no, junction_name: p.name, metres: 4_000, website: null, loaded_at: new Date("2026-10-01T03:00:00Z") };
  });
}
function neighboursOf(params: readonly unknown[] | undefined): PlaceNeighbourRow[] {
  const own = typeof params?.[3] === "string" ? params[3] : "";
  return NEIGHBOUR_TOWNS.filter((t) => t.ags !== own).map((t, k) => ({ ...t, metres: 30_000 + k * 5_000 }));
}
/**
 * #1041: the station pages' fixture — two stations of the catalogue, Köln Hbf with its record (the old slug
 * `koeln-alt` its first address) and Bonn Hbf; every card read answers no rows but the departure board's (2.4.3:
 * the pairing and the plan's rail rows at the Hbf, timetable only), so the page carries its record's cards, the
 * sources card and a live board with its filter. The figures are plausible, not production data.
 */
const STATION_PAGE_ROWS: StationIndexRow[] = [
  { station_no: "3320", slug: "koeln-hbf", name: "Köln Hbf", city: "Köln", federal_state: "Nordrhein-Westfalen", municipality_code: "05315000", category: 1, updated_at: new Date("2026-10-01T03:00:00Z"), ifopt: "de:05315:11201" }, // its StaDa IFOPT, as production (#1084: the area marks its stop)
  { station_no: "767", slug: "bonn-hbf", name: "Bonn Hbf", city: "Bonn", federal_state: "Nordrhein-Westfalen", municipality_code: "05314000", category: 2, updated_at: new Date("2026-10-01T03:00:00Z"), ifopt: null },
  // #1087 part 3: the home's search case — "Aachen" → Aachen Hbf in two steps
  { station_no: "1", slug: "aachen-hbf", name: "Aachen Hbf", city: "Aachen", federal_state: "Nordrhein-Westfalen", municipality_code: "05334002", category: 2, updated_at: new Date("2026-10-01T03:00:00Z"), ifopt: null },
  // #1043: a U-Bahn station and a Stadtbahn station StaDa does not list — timetable records keyed by their zHV DHID
  { station_no: "de:11000:900078101", slug: "berlin-u-hermannplatz", name: "U Hermannplatz", city: "Berlin", federal_state: "Berlin", municipality_code: "11000000", category: null, updated_at: new Date("2026-10-01T03:00:00Z"), ifopt: "de:11000:900078101" },
  { station_no: "de:05315:11001", slug: "koeln-neumarkt", name: "Neumarkt", city: "Köln", federal_state: "Nordrhein-Westfalen", municipality_code: "05315000", category: null, updated_at: new Date("2026-10-01T03:00:00Z"), ifopt: "de:05315:11001" },
];
/** #1182: the stations nearest a cell in Köln, as the neighbour statement answers them (nearest first). */
const STATION_NEAR_ROWS = [
  { slug: "koeln-hbf", name: "Köln Hbf", metres: 650 },
  { slug: "koeln-neumarkt", name: "Neumarkt", metres: 1200 },
];
/** #1087 part 2: the home's station block — two stations disrupted now, Köln Hbf first; #1199: one alert at Aachen Hbf. */
const STATION_TOP_ROWS: readonly StationTopRow[] = [
  { slug: "koeln-hbf", name: "Köln Hbf", cancelled: 2, late: 1, alerts: 0, lifts_out: 1 },
  { slug: "aachen-hbf", name: "Aachen Hbf", cancelled: 0, late: 3, alerts: 1, lifts_out: 0 },
];
const KOELN_RECORD: StationRecordRow = {
  station_no: "3320", slug: "koeln-hbf", name: "Köln Hbf", eva_no: "8000207", eva_nos: ["8000207"], ds100: "KK", ifopt: "de:05315:11201", category: 1,
  federal_state: "Nordrhein-Westfalen", municipality_code: "05315000", street: "Trankgasse 11", zipcode: "50667", city: "Köln", lat: 50.94303, lon: 6.958729, stepless_access: "yes",
  has_parking: true, has_bicycle_parking: true, has_local_public_transport: true, has_public_facilities: true, has_locker_system: true, has_taxi_rank: true,
  has_travel_necessities: true, has_wifi: true, has_travel_center: true, has_railway_mission: true, has_db_lounge: true, has_lost_and_found: true, has_car_rental: true,
  mobility_service: "Nur nach Voranmeldung unter 030 65 21 28 88 (Ortstarif)", mobility_staff: null, db_information: null, local_service_staff: null, service_phone: "0221/1411055",
  last_seen_at: new Date("2026-10-03T03:00:00Z"), updated_at: new Date("2026-10-01T03:00:00Z"), place_slug: null, place_name: null,
};
/** #1095: Bonn Hbf's record — a station whose Gemeinde has a town page, so its trail runs Land → town → station. */
const BONN_RECORD: StationRecordRow = {
  ...KOELN_RECORD, station_no: "767", slug: "bonn-hbf", name: "Bonn Hbf", eva_no: "8000044", eva_nos: ["8000044"], ds100: "KB", ifopt: null, category: 2,
  municipality_code: "05314000", street: "Am Hauptbahnhof 1", zipcode: "53111", city: "Bonn", lat: 50.7322, lon: 7.0971, mobility_service: null, service_phone: null,
  place_slug: "bonn", place_name: "Bonn",
};
/**
 * #1043: the U-Bahn station (Berlin U Hermannplatz: the U7 and the buses above it) and the Köln Stadtbahn station
 * (Neumarkt: trams 1, 7, 9, 16, 18 under ground, KVB's lifts and escalators filed under its DHID) — timetable records,
 * named and placed by the zHV (`source_id` delfi_static), no EVA, no category. The figures are plausible, not production data.
 */
const HERMANN = "de:11000:900078101";
const NEUMARKT = "de:05315:11001";
const timetableRecord = (o: Partial<StationRecordRow>): StationRecordRow => ({
  ...KOELN_RECORD, eva_no: null, eva_nos: [], ds100: null, category: null, stepless_access: null, has_parking: null, has_bicycle_parking: null, has_local_public_transport: null,
  has_public_facilities: null, has_locker_system: null, has_taxi_rank: null, has_travel_necessities: null, has_wifi: null, has_travel_center: null, has_railway_mission: null,
  has_db_lounge: null, has_lost_and_found: null, has_car_rental: null, mobility_service: null, service_phone: null, street: null, zipcode: null, source_id: "delfi_static", ...o,
});
const HERMANN_RECORD = timetableRecord({ station_no: HERMANN, slug: "berlin-u-hermannplatz", name: "U Hermannplatz", ifopt: HERMANN, federal_state: "Berlin", municipality_code: "11000000", city: "Berlin", lat: 52.48685, lon: 13.42478 });
const NEUMARKT_RECORD = timetableRecord({ station_no: NEUMARKT, slug: "koeln-neumarkt", name: "Neumarkt", ifopt: NEUMARKT, city: "Köln", lat: 50.93594, lon: 6.94738 });
/** The U7's two directions, in BVG's line colour (`route_color`, held at 4.5:1 behind white): no Trip Update carries either row, so both are the plan. */
const HERMANN_URBAN: readonly ScheduledRow[] = [
  { ...plan(HERMANN, "fx-u7a", "U7", "Rudow", 3, 400, "1"), route_color: "0065AE" },
  { ...plan(HERMANN, "fx-u7b", "U7", "Rathaus Spandau", 5, 400, "2"), route_color: "0065AE" },
];
const NEUMARKT_URBAN: readonly ScheduledRow[] = [plan(NEUMARKT, "fx-n16", "16", "Niehl, Sebastianstr.", 4, 900, "1"), plan(NEUMARKT, "fx-n9", "9", "Königsforst", 6, 900, "3")];
/** KVB's units at Neumarkt (`STATION_KVB_UNITS_SQL`): a lift in service and an escalator its fault file names, both restated two minutes ago. */
const NEUMARKT_KVB = [
  { equipment_id: "kvb:011-01", kind: "elevator", description: "Aufzug Neumarkt Zwischenebene", state: "active", state_feed: "kvb_aufzugsstoerung", status_seen_at: ago(2), status_since: ago(900) },
  { equipment_id: "kvb:011-51", kind: "escalator", description: "Fahrtreppe Neumarkt Ausgang Schildergasse", state: "inactive", state_feed: "kvb_fahrtreppenstoerung", status_seen_at: ago(2), status_since: ago(40) },
];
const at = (params: unknown[] | undefined, i: number, id: string): boolean => Array.isArray(params?.[i]) && (params[i] as unknown[]).some((x) => typeof x === "string" && x.startsWith(id));
/**
 * #1087's Aachen Hbf has its record too: the home's station block and search link its page, and in production the
 * index and the record are read from the one view (`station_index_live`), so a linked station always answers — the
 * crawl (seo-241) found the fixture's page answering 404, a state production cannot have.
 */
const AACHEN_RECORD: StationRecordRow = {
  ...KOELN_RECORD, station_no: "1", slug: "aachen-hbf", name: "Aachen Hbf", eva_no: "8000001", eva_nos: ["8000001"], ds100: "KA", ifopt: null, category: 2,
  municipality_code: "05334002", street: "Bahnhofplatz 2a", zipcode: "52064", city: "Aachen", lat: 50.7678, lon: 6.0911, mobility_service: null, service_phone: null,
};
/**
 * #1092: Köln Hbf's board places — an RE from bus stand 85 (the Breslauer Platz replacement bus), an ICE at track
 * 8 D-G, a KVB tram at its platform 11 (a Steig, though 11 is also a track) — and its OpenStation register, tracks
 * 1–11 (6 step-free); the arrivals, more than the board shows (#1091's fold of the arrivals).
 */
const KOELN_BOARD_EXTRA: readonly ScheduledRow[] = [plan(HBF.id, "fx-re8", "RE8", "Mönchengladbach Hbf", 5, 106, "85"), plan(HBF.id, "fx-ice594", "ICE 594", "Berlin Hbf", 9, 101, "8 D-G")];
const KOELN_URBAN: readonly ScheduledRow[] = [plan(HBF.id, "fx-t16", "16", "Bonn-Bad Godesberg", 6, 900, "11")];
const KOELN_ARRIVALS: readonly ScheduledRow[] = Array.from({ length: 22 }, (_, i) => plan(HBF.id, `fx-a${String(i + 1).padStart(2, "0")}`, i % 2 === 0 ? "RE5" : "S11", `Herkunft ${String(i + 1)}`, 2 + i * 3, i % 2 === 0 ? 106 : 109, String(1 + (i % 9))));
const quay = (t: number): PlatformAccessRow => ({
  element_id: `fx-q${String(t)}`, element_kind: "quay", stop_place_id: "fx-koeln", eva_no: "8000207", eva_nos: ["8000207"], station_name: "Köln Hbf", quay_type: null, quay_name: null,
  plate_code: String(t), parent_quay_id: null, platform_height_cm: 76, has_assessment: true, step_free_access: t === 6 ? "true" : "false", wheelchair_access: null, tactile_guidance: null,
  level_access_into_vehicle: null, provider_updated_at: new Date("2026-10-01T00:00:00Z"),
});
const KOELN_REGISTER: readonly PlatformAccessRow[] = Array.from({ length: 11 }, (_, i) => quay(i + 1));
/**
 * #1094: Köln Hbf's lifts and escalators at production's count (20 units, read-only 2026-10-27), two of them out of
 * service — more than the eight the card listed before the rest was folded, so the browser sees every one listed.
 */
const KOELN_LIFTS = Array.from({ length: 20 }, (_, i) => ({
  equipment_no: String(10442300 + i), kind: i % 4 === 3 ? "escalator" : "elevator", state: i === 2 || i === 11 ? "inactive" : "active",
  state_explanation: null, description: `zu Gleis ${String(1 + (i % 11))}`, resume_at: null, state_since: ago(600), last_seen_at: ago(2),
}));
/** owner 2026-10-27: the ledger the station page's freshness signs read — every feed asked, read a minute ago. */
const stationLedger = (feeds: unknown): readonly { feed_key: string; checked_at: Date; cadence_s: number }[] =>
  (Array.isArray(feeds) ? (feeds as string[]) : []).map((feed_key) => ({ feed_key, checked_at: ago(1), cadence_s: 300 }));

/**
 * #1043 (c): what is around Köln Hbf on foot — the station's own tram level (never "around" it), Dom/Hbf (U-Bahn and
 * tram, 180 m) and Breslauer Platz/Hbf (buses, 280 m), each placed by its bearing from the station; their departures
 * are the place card's plan rows (`planAnswer`) with the bus Trip Updates on them. One alert names the bus stop by its
 * id (it is on that stop and on no other card); the station's own alert read never asks for that id. Around every other
 * station the walk holds no stop (the statement's one row of an empty radius).
 */
const KOELN_AT = { lat: KOELN_RECORD.lat ?? 0, lon: KOELN_RECORD.lon ?? 0 };
const nearRow = (o: Parameters<typeof stopRow>[0], north: number, east: number): StopNearRow => ({
  ...stopRow(o),
  lat: Number((KOELN_AT.lat + north / 110_540).toFixed(6)),
  lon: Number((KOELN_AT.lon + east / 70_200).toFixed(6)),
});
const KOELN_NEARBY: readonly StopNearRow[] = [
  nearRow({ mode: "tram", ...HBF, metres: 30 }, 0, 30),
  nearRow({ mode: "subway", id: "de:05315:11111", name: "Dom/Hbf", modes: ["subway", "tram"], lines: ["5", "16", "18"], metres: 180 }, -120, -134),
  nearRow({ mode: "tram", id: "de:05315:11111", name: "Dom/Hbf", modes: ["subway", "tram"], lines: ["5", "16", "18"], metres: 180 }, -120, -134),
  nearRow({ mode: "bus", id: "de:05315:12001", name: "Breslauer Platz/Hbf", modes: ["bus"], lines: ["132", "133"], metres: 280 }, 150, 236),
];
const EMPTY_RADIUS: readonly StopNearRow[] = [{ loaded: true, mode: null, root_id: null, name: null, modes: null, lines: null, stop_ids: null, metres: null, evas: null, station_nos: null, lat: null, lon: null }];
export const BRESLAUER_ALERT = "Breslauer Platz: Haltestelle der Linie 132 verlegt";
const KOELN_STOP_ALERT: AlertNearRow = {
  source_id: "delfi_rt_sa", alert_id: "fx-b1", header: BRESLAUER_ALERT, active_from: ago(120), active_to: inMin(3 * 24 * 60),
  line_names: ["132"], stop_ids: ["de:05315:12001:1:1"], kreise: ["05315"], message_key: "delfi_rt_sa:fx-b1", carried_by: ["delfi_rt_sa"],
};
/**
 * #988: the station's own service alert at Köln Hbf (its timetable stop, the S11 on its board). Since the rail Ampel the
 * lifts no longer turn a station's lamp, so this message is what the fixture's Köln Hbf reports (#1095/#1175 AC6: a
 * station with something reported is titled by it).
 */
const KOELN_HBF_ALERT: AlertNearRow = {
  source_id: "delfi_rt_sa", alert_id: "fx-hbf1", header: "S11: Bauarbeiten zwischen Köln Hbf und Köln-Dellbrück, Ersatzverkehr mit Bussen.", active_from: ago(120), active_to: inMin(3 * 24 * 60),
  line_names: ["S11"], stop_ids: [HBF.id], kreise: ["05315"], message_key: "delfi_rt_sa:fx-hbf1", carried_by: ["delfi_rt_sa"],
};
/**
 * #988: Bonn Hbf's own timetable stop and three trains on its board — the rail Ampel judges at least three trips, so a
 * station with nothing reported is green ("nothing reported"), never grey for want of a board (#1095: Bonn's title keeps
 * the search phrase). Plausible rows, not production data.
 */
const BONN_HBF = "de:05314:61101";
const BONN_BOARD: readonly ScheduledRow[] = [
  plan(BONN_HBF, "fx-bn-re5", "RE5", "Wesel", 3, 106, "1"),
  plan(BONN_HBF, "fx-bn-rb26", "RB26", "Mainz Hbf", 8, 106, "2"),
  plan(BONN_HBF, "fx-bn-re5b", "RE5", "Koblenz Hbf", 13, 106, "3"),
];
/** The road messages around Köln Hbf (`ROAD_NOW_SQL` near the station, 600 m): one on the Trankgasse 150 m north, one naming no place 450 m south. */
const KOELN_ROADS: readonly RoadNowDbRow[] = [
  roadRow({ source: "traffic_koeln_events", key: "fx-st1", type: "roadOrCarriagewayOrLaneManagement", title: "Sperrung Trankgasse", road: null, lat: KOELN_AT.lat + 150 / 110_540, lon: KOELN_AT.lon, placeText: "Trankgasse" }),
  roadRow({ source: "traffic_koeln_events", key: "fx-st2", type: "roadOrCarriagewayOrLaneManagement", title: "Fahrbahnverengung", road: null, lat: KOELN_AT.lat - 450 / 110_540, lon: KOELN_AT.lon }),
];
const KOELN_ROAD_STREETS = [{ key: "fx-st2", street: "Komödienstraße", metres: 20 }];
const isKoeln = (params: unknown[] | undefined): boolean => Math.abs(Number(params?.[0]) - KOELN_AT.lon) < 1e-6 && Math.abs(Number(params?.[1]) - KOELN_AT.lat) < 1e-6;

const STATION_DB = {
  query: (text: string, params?: unknown[]) => {
    const rows =
      // #1043 (c): the stops around a station, their plan, their live figures, their alerts, and the roads near it
      text === STOPS_NEAR_SQL && params?.[2] === STATION_NEARBY_M ? (isKoeln(params) ? KOELN_NEARBY : EMPTY_RADIUS)
      : text === SCHEDULED_AT_STOPS_SQL ? planAnswer(params)
      : text === TRIP_UPDATES_SQL ? TU_ROWS
      : text === ALERTS_NEAR_SQL ? [...(at(params, 2, "de:05315:12001:1:1") ? [KOELN_STOP_ALERT] : []), ...(at(params, 2, HBF.id) ? [KOELN_HBF_ALERT] : [])]
      : text === ROAD_NOW_SQL && params?.[8] === STATION_ROADS_OUT_M ? (Math.abs(Number(params?.[6]) - KOELN_AT.lon) < 1e-6 ? KOELN_ROADS : [])
      : text === STREET_NEAR_EACH_SQL ? ((params?.[0] ?? []) as string[]).flatMap((k) => KOELN_ROAD_STREETS.filter((r) => k.endsWith(r.key)).map((r) => ({ ...r, key: k })))
      :
      text === STATION_VERSION_SQL ? [{ version: "fixture" }]
      : text === STATION_INDEX_SQL ? STATION_PAGE_ROWS
      // #1182: the stations nearest a visitor's cell on the station index (no station excluded) — Köln's two near Köln
      : text === STATION_NEIGHBOURS_SQL && params?.[2] === "" ? (Math.abs(Number(params?.[1]) - 50.94) < 0.1 && Math.abs(Number(params?.[0]) - 6.96) < 0.15 ? STATION_NEAR_ROWS : [])
      // the statements of the licence boundaries (no statement joins the SIRI ET counts or the alerts to the stations)
      : text === STATION_TOP_DHIDS_SQL ? STATION_TOP_ROWS.map((r) => ({ ifopt: `fx:${r.slug}` }))
      : text === STATION_TOP_DISRUPTION_SQL ? STATION_TOP_ROWS.map((r) => ({ station_dhid: `fx:${r.slug}`, cancelled: r.cancelled, late: r.late }))
      : text === STATION_TOP_ALERTS_SQL ? STATION_TOP_ROWS.flatMap((r) => Array.from({ length: r.alerts }, (_, i) => ({ message_key: `delfi_rt_sa:fx-${r.slug}-${String(i)}`, station_dhid: `fx:${r.slug}`, carried_by: ["delfi_rt_sa"] })))
      : text === STATION_TOP_SQL ? STATION_TOP_ROWS.map((r) => ({ slug: r.slug, name: r.name, ifopt: `fx:${r.slug}`, lifts_out: r.lifts_out }))
      : text === STATION_SLUG_OWNER_SQL ? (params?.[0] === "koeln-alt" ? [{ station_no: "3320" }] : [])
      : text === STATION_RECORD_SQL ? (params?.[0] === "3320" ? [KOELN_RECORD] : params?.[0] === "767" ? [BONN_RECORD] : params?.[0] === "1" ? [AACHEN_RECORD] : params?.[0] === HERMANN ? [HERMANN_RECORD] : params?.[0] === NEUMARKT ? [NEUMARKT_RECORD] : [])
      // 2.4.3 review finding 5: Köln Hbf's live board has rows, so the page carries its filter form and its cards'
      // refresh hooks — the pairing (EVA → DHID → timetable stop) and the plan's rail rows at the Hbf, timetable only
      : text === STATION_DHIDS ? (Array.isArray(params?.[0]) && (params[0] as unknown[]).includes("8000207") ? [{ dhids: [HBF.id] }] : Array.isArray(params?.[0]) && (params[0] as unknown[]).includes("8000044") ? [{ dhids: [BONN_HBF] }] : [])
      // #1043: a timetable record's board is read from its own DHID's stops
      : text === STATION_TIMETABLE_STOPS ? [{ ids: at(params, 1, HERMANN) ? [`${HERMANN}:1:1`] : at(params, 1, NEUMARKT) ? [`${NEUMARKT}:1:1`] : at(params, 1, BONN_HBF) ? [`${BONN_HBF}:1:1`] : [HBF.id] }]
      : text === STATION_BOARD_PLAN_SQL ? (at(params, 1, HERMANN) || at(params, 1, NEUMARKT) ? [] : at(params, 1, BONN_HBF) ? BONN_BOARD.map((r) => ({ ...r, grp: BOARD_GROUP })) : [...PLAN_ROWS.filter((r) => r.grp === HBF.id), ...KOELN_BOARD_EXTRA].map((r) => ({ ...r, grp: BOARD_GROUP })))
      : text === STATION_BOARD_URBAN_PLAN_SQL ? (at(params, 1, HERMANN) ? HERMANN_URBAN : at(params, 1, NEUMARKT) ? NEUMARKT_URBAN : at(params, 1, BONN_HBF) ? [] : KOELN_URBAN).map((r) => ({ ...r, grp: URBAN_GROUP }))
      : text === STATION_ARRIVALS_PLAN_SQL ? (at(params, 1, HERMANN) || at(params, 1, NEUMARKT) || at(params, 1, BONN_HBF) ? [] : KOELN_ARRIVALS.map((r) => ({ ...r, grp: BOARD_GROUP })))
      : text === STATION_KVB_UNITS_SQL ? (at(params, 1, NEUMARKT) ? NEUMARKT_KVB : [])
      : text === PLATFORM_ACCESS_AT_EVAS ? (Array.isArray(params?.[0]) && (params[0] as unknown[]).includes("8000207") ? KOELN_REGISTER : [])
      : text === STATION_FASTA_UNITS_SQL ? (params?.[0] === "3320" ? KOELN_LIFTS : [])
      // 2.4.6: "Linien hier" — the trams and buses that call at the Hbf's stops (each a link to the board filtered to it)
      : text === STATION_LINES_SQL
        ? at(params, 1, HERMANN) ? [{ root_id: HERMANN, modes: ["subway"], lines: ["U7"] }, { root_id: "de:11000:900078270", modes: ["bus"], lines: ["171", "M41"] }]
        : at(params, 1, NEUMARKT) ? [{ root_id: NEUMARKT, modes: ["tram"], lines: ["1", "7", "9", "16", "18"] }]
        : at(params, 1, BONN_HBF) ? []
        : [{ root_id: HBF.id, modes: ["tram"], lines: ["16", "18"] }, { root_id: "de:05315:12001", modes: ["bus"], lines: ["132", "133"] }]
      : text === STATION_LIFT_FEEDS_SQL || text === FEEDS_CHECKED_SQL ? stationLedger(params?.[0])
      : [];
    return Promise.resolve({ rows, rowCount: rows.length });
  },
} as unknown as Parameters<typeof createStationService>[0]["db"];

const MOTORWAY_DB = { query: motorwayQuery } as unknown as Parameters<typeof createMotorwayService>[0]["db"];
/** The motorway statements' fixture answers (the heap measurement of the 2.1.15 review reads them too). */
export const motorwayFixtureQuery = motorwayQuery;


/**
 * The charging sites of the place reads (`CHARGING_NEAR_SQL`'s row shape since 2.1.9, #711: the points as JSON with
 * each one's newest status, the distance, and the feeds a fold hid). The first three, inside the first ring (5 km), are
 * the card every place page shows unfiltered; #1081 (2.5.8) adds the sites only a wider ring or a FILTER reaches —
 * beyond 5 km, so the unfiltered card keeps its three rows — with the mixed cases the filter criteria name: an 11 kW
 * Type 2 and a 150 kW CCS2 point on one site, a site whose points state no power, a site naming no operator, EnBW in a
 * second spelling, and enough HPC sites for a filtered list to page.
 */
const CHARGING_SITES = [
  { source_feed: "afir_chargecloud_stat", site_id: "c1", name: "Ladepark Köln-Deutz", operator: "RheinEnergie", street: "Deutz-Mülheimer Str.", house_number: "30", city: "Köln", lat: 50.9401, lon: 6.9752, distance_m: 900,
    points: [...Array.from({ length: 4 }, () => chargePoint(150, "available", 3)), chargePoint(150, "charging", 3), chargePoint(50, null, null)], also_feeds: ["ocpdb_chargecloud_stat"] },
  { source_feed: "bnetza_lsr", site_id: "c2", name: "Parkhaus Cäcilienstraße", operator: "TankE", street: "Cäcilienstr.", house_number: "32", city: "Cologne", lat: 50.9335, lon: 6.9443, distance_m: 1700,
    points: Array.from({ length: 4 }, () => chargePoint(22, null, null)), also_feeds: [] },
  { source_feed: "afir_enbw_stat", site_id: "c3", name: "Ladesäule Ehrenfeld", operator: "EnBW", street: "Venloer Str.", house_number: "421", city: "Köln", lat: 50.9494, lon: 6.9157, distance_m: 3600,
    points: [{ ...chargePoint(50, "outoforder", 3), statusFeed: "afir_enbw_dyn" }, { ...chargePoint(50, "available", 3), statusFeed: "afir_enbw_dyn" }], also_feeds: [] },
  // #1081: beyond the first ring
  { source_feed: "afir_enbw_stat", site_id: "c4", name: "Schnellladepark Köln-Marsdorf", operator: "EnBW mobility+ AG & Co. KG", street: "Max-Planck-Str.", house_number: "2", city: "Köln", lat: 50.9203, lon: 6.8592, distance_m: 6200,
    points: Array.from({ length: 4 }, () => ({ ...chargePoint(300, "available", 3, CCS), statusFeed: "afir_enbw_dyn" })), also_feeds: [] },
  { source_feed: "bnetza_lsr", site_id: "c5", name: "Ladepark Köln-Niehl", operator: "IONITY GmbH", street: "Emdener Str.", house_number: "1", city: "Köln", lat: 51.0003, lon: 6.9541, distance_m: 7400,
    points: Array.from({ length: 6 }, () => chargePoint(350, null, null, CCS)), also_feeds: [] },
  { source_feed: "bnetza_lsr", site_id: "c6", name: "Autohof Frechen", operator: "Aral pulse", street: "Europaallee", house_number: "30", city: "Frechen", lat: 50.9132, lon: 6.8247, distance_m: 9100,
    points: [chargePoint(11, null, null, TYPE2), chargePoint(150, null, null, CCS)], also_feeds: [] },
  { source_feed: "bnetza_lsr", site_id: "c7", name: "Parkplatz am Rathaus Pulheim", operator: null, street: "Alte Kölner Str.", house_number: "26", city: "Pulheim", lat: 51.0003, lon: 6.8072, distance_m: 10300,
    points: Array.from({ length: 2 }, () => chargePoint(22, null, null, TYPE2)), also_feeds: [] },
  { source_feed: "bnetza_lsr", site_id: "c8", name: "Hotel Lindenhof", operator: "RheinEnergie", street: "Lindenallee", house_number: "4", city: "Bergisch Gladbach", lat: 50.9921, lon: 7.1325, distance_m: 11800,
    points: Array.from({ length: 2 }, () => chargePoint(null, null, null)), also_feeds: [] },
  { source_feed: "bnetza_lsr", site_id: "c9", name: "Supercharger Hürth", operator: "Tesla Germany GmbH", street: "Theresienhöhe", house_number: "1", city: "Hürth", lat: 50.8806, lon: 6.8764, distance_m: 12500,
    points: Array.from({ length: 8 }, () => chargePoint(250, null, null, CCS)), also_feeds: [] },
];

/** A charging read's filter from the statement's parameters (plug feed values, bands, operator keys, terms; null for none). */
function chargingFilterAt(plugValues: unknown, bands: unknown, operators: unknown, terms: unknown): ChargingFilter {
  const plugs = new Set((plugValues as readonly string[] | null) ?? []);
  const asked = (v: unknown): readonly string[] => (v as readonly string[] | null) ?? [];
  return {
    operators: asked(operators),
    bands: POWER_BANDS.filter((b) => asked(bands).includes(b)),
    plugs: CONNECTORS.filter((c) => CONNECTOR_FEED_VALUES[c].some((v) => plugs.has(v))),
    freeNow: false,
    terms: CHARGING_TERMS.filter((t) => asked(terms).includes(t)),
  };
}

/**
 * #1081: `CHARGING_NEAR_SQL` and `CHARGING_NEAR_FILTERED_SQL` as functions of their parameters — the nearest `$4` sites
 * within `$3` metres, under the filter the filtered statement carries (`$7` plugs, `$18` bands, `$20` operators, `$21`
 * terms), kept and cut to their matching points by ingest's OWN rule (`siteUnderFilter`), so the fixture cannot give a
 * filter a second meaning.
 */
function chargingNearRows(params: readonly unknown[] | undefined, filtered: boolean): unknown[] {
  const p = params ?? [];
  const f = filtered ? chargingFilterAt(p[6], p[17], p[19], p[20]) : NO_CHARGING_FILTER;
  return CHARGING_SITES.filter((x) => x.distance_m <= Number(p[2]))
    .flatMap((x) => {
      const kept = siteUnderFilter(x, f);
      return kept === null ? [] : [kept];
    })
    .slice(0, Number(p[3]));
}

/**
 * #1081: `CHARGING_FACETS_SQL` over the sites within `$3` metres — every place, the places the filter keeps (`$10`
 * plugs, `$11` bands, `$13` operators, `$14` terms), the places of no stated power, and per operator key (labelled with
 * its most frequent spelling), band and plug how many places it would keep, unfiltered per option, as the statement does.
 */
function chargingFacetRows(params: readonly unknown[] | undefined): ChargingFacetRow[] {
  const p = params ?? [];
  const f = chargingFilterAt(p[9], p[10], p[12], p[13]);
  const sites = CHARGING_SITES.filter((x) => x.distance_m <= Number(p[2]));
  const rows: ChargingFacetRow[] = [
    { kind: "total", key: null, label: null, n: sites.length },
    { kind: "match", key: null, label: null, n: sites.filter((x) => siteUnderFilter(x, f) !== null).length },
    { kind: "nopower", key: null, label: null, n: sites.filter((x) => x.points.every((pt) => powerBandOf(pt.maxPowerKw) === null)).length },
  ];
  const spellings = new Map<string, string[]>();
  for (const x of sites) {
    const key = operatorKey(x.operator) ?? NO_OPERATOR_KEY;
    spellings.set(key, [...(spellings.get(key) ?? []), ...(x.operator === null ? [] : [x.operator.trim()])]);
  }
  for (const [key, names] of spellings) {
    const often = (name: string): number => names.filter((y) => y === name).length;
    const label = [...names].sort((a, b) => often(b) - often(a) || a.localeCompare(b))[0] ?? null;
    rows.push({ kind: "op", key, label, n: sites.filter((x) => (operatorKey(x.operator) ?? NO_OPERATOR_KEY) === key).length });
  }
  for (const band of POWER_BANDS) {
    const n = sites.filter((x) => x.points.some((pt) => powerBandOf(pt.maxPowerKw) === band)).length;
    if (n > 0) rows.push({ kind: "band", key: band, label: null, n });
  }
  for (const plug of CONNECTORS) {
    const n = sites.filter((x) => x.points.some((pt) => (pt.connectorTypes ?? []).some((v) => CONNECTOR_FEED_VALUES[plug].includes(v)))).length;
    if (n > 0) rows.push({ kind: "plug", key: plug, label: null, n });
  }
  // no fixture point states a term of use: each term is unstated at every place
  for (const term of CHARGING_TERMS) rows.push({ kind: "termnone", key: term, label: null, n: sites.length });
  return rows;
}

const PLACE_ROWS: ReadonlyMap<string, readonly unknown[]> = new Map<string, readonly unknown[]>([
  [NRW_PR_CARD_SQL, NRW_PR_ROWS],
  [TRUCKLOUNGE_CARD_SQL, TRUCKLOUNGE_ROWS],
  [POI_NEEDS_NEAR_SQL, POI_ROWS],
  [STOPS_NEAR_SQL, STOP_ROWS],
  [
    FEEDS_CHECKED_SQL,
    [
      { feed_key: "delfi_siri_et", checked_at: ago(4), cadence_s: 600 },
      { feed_key: "tripupdates", checked_at: ago(1), cadence_s: 120 },
      { feed_key: "service_alerts_gtfsrt", checked_at: ago(4), cadence_s: 600 },
      { feed_key: "service_alerts_siri_sx", checked_at: ago(20), cadence_s: 3600 },
      // 2.1.11 (#711 C5): the camera ledger, checked inside the tool's window.
      { feed_key: "hh_verkehrskameras", checked_at: ago(600), cadence_s: 86_400 },
    ],
  ],
  // 2.1.11 (#711 C): the place's own road read (`readRoadNow` with `near`,
  // the `RoadNowDbRow` shape) at the card's largest: an Autobahn closure with
  // its stretch, an Autobahn works item that names none and is the nearest
  // row, so it is listed and named by the junction read below, a TMC-located BAB message (the BASt LCL credit), an NMS
  // works message from NRW's Landesmeldestelle, and the city's own street
  // message farther out than the motorways (the street slot).
  [ROAD_NOW_SQL, ROAD_NOW_ROWS],
  // 2.4.8: the place read's first phase answers the same rows; the second (ROAD_NOW_DETAIL_SQL, unanswered here) leaves them as they are.
  [ROAD_NOW_PLACE_SQL, ROAD_NOW_ROWS],
  [MOTORWAYS_NEAR_SQL, motorwayNearRows()],
  [PLACES_NEAR_SQL, [{ ord: 1, junction_name: "AS Köln-Mülheim", junction_source: "autobahn", junction_m: 600, gazetteer_loaded: true }]],
  // #711 C5: two Hamburg cameras — on every fixture page, which answers every
  // place with Köln's rows, so the budget measures the road card at its
  // heaviest (a Hamburg page carries this block; no Köln page does).
  [
    HH_CAMERAS_SQL,
    [
      { camera_id: "fx-c1", location_label: "A7 AS Hamburg-Stellingen", lat: 53.5895, lon: 9.9282, last_seen_at: ago(600), distance_m: 1800 },
      { camera_id: "fx-c2", location_label: "Elbbrücken", lat: 53.5352, lon: 10.0261, last_seen_at: ago(600), distance_m: 3100 },
    ],
  ],
  [SCHEDULED_AT_STOPS_SQL, PLAN_ROWS],
  [SIRI_ET_AT_REFS_SQL, CALL_ROWS],
  [TRIP_UPDATES_SQL, TU_ROWS],
  [ALERTS_NEAR_SQL, ALERT_ROWS],
  [GEMEINDE_BY_AGS_SQL, [KOELN]],
  [GEMEINDE_NEAREST_SQL, [KOELN]],
  [GEMEINDE_PREFIX_SQL, [KOELN]],
  [GEMEINDE_INDEX_SQL, [KOELN, { ...KOELN, name: "Nürnberg", admin_code: "09564000" }]],
  [WARNINGS_AT_SQL, [{ identifier: "fx-w1", event: "STURMBÖEN", level: 2, level_source: "published", headline: "Amtliche WARNUNG vor STURMBÖEN", valid_from: ago(40), valid_to: new Date(NOW.getTime() + 4 * 3_600_000), source_id: "dwd" }]],
  [WARNINGS_CHECKED_SQL, [{ checked_at: ago(4), cadence_s: 600 }]],
  [CHARGING_LIVENESS_SQL, [{ feed_key: "afir_chargecloud_dyn", last_conclusive_at: ago(2), validator: null, validator_since: null, moved_at: ago(3) }, { feed_key: "afir_enbw_dyn", last_conclusive_at: ago(2), validator: null, validator_since: null, moved_at: ago(3) }]],
  [
    PARKING_NEAR_SQL,
    [
      { source_feed: "park_koeln_static", attribution_id: "mobilithek_park_koeln_static", kind: "garage", name: "Parkhaus Dom", road: null, capacity_total: 520, capacity_truck: null, metres: 600, last_seen_at: ago(30), lat: 50.9418, lon: 6.9571 },
      // #891: one row whose publisher states amenities (and a "no"), one beside it that states nothing — so a chip has a row to hide
      { source_feed: "park_koeln_static", attribution_id: "mobilithek_park_koeln_static", kind: "park_and_ride", name: "P+R Weiden West", road: null, capacity_total: 380, capacity_truck: null, metres: 4300, last_seen_at: ago(30), lat: 50.9563, lon: 6.8562, facilities: ["toilet", "accessible_toilet"], facilities_absent: ["shower"], facilities_source: "park_koeln_static" },
      { source_feed: "park_koeln_static", attribution_id: "mobilithek_park_koeln_static", kind: "park_and_ride", name: "P+R Köln-Messe", road: null, capacity_total: 240, capacity_truck: null, metres: 2500, last_seen_at: ago(30), lat: 50.9466, lon: 6.9822 },
    ],
  ],
  [
    FUEL_NEAR_SQL,
    [
      { product: "diesel", label: "Diesel", unit: "EUR/l", price: "1.619", observed_at: ago(7), brand: "bft", name: "bft Tankstelle Köln-Ehrenfeld", street: "Vogelsanger Str.", house_no: "352", postcode: "50827", city: "Köln", lat: 50.9636, lon: 6.9603, metres: 2900 },
      { product: "e10", label: "Super E10", unit: "EUR/l", price: "1.679", observed_at: ago(7), brand: "bft", name: "bft Tankstelle Köln-Ehrenfeld", street: "Vogelsanger Str.", house_no: "352", postcode: "50827", city: "Köln", lat: 50.9636, lon: 6.9603, metres: 2900 },
      { product: "e5", label: "Super E5", unit: "EUR/l", price: "1.739", observed_at: ago(9), brand: "ARAL", name: "Aral Köln Innere Kanalstraße", street: "Innere Kanalstr.", house_no: "14", postcode: "50823", city: "Köln", lat: 50.9375, lon: 6.9346, metres: 1800 },
    ],
  ],
  // #703: OpenStreetMap's fuel stations around the fixture's centre — the
  // Aral's twin 80 m off (left out by the card) and five unmatched, the most
  // the card lists, so the page is measured at its production size.
  [
    OSM_FUEL_CARD_SQL,
    [
      { name: "Aral", street: "Innere Kanalstraße", house_number: "14", lat: 50.9378, lon: 6.9356, metres: 1730 },
      { name: "Shell Köln Rheinuferstraße", street: "Rheinuferstraße", house_number: "7", lat: 50.9301, lon: 6.9655, metres: 900 },
      { name: "Esso Station Köln-Deutz", street: "Deutz-Kalker Straße", house_number: "48", lat: 50.9372, lon: 6.9802, metres: 1400 },
      { name: "TotalEnergies Tankstelle", street: "Aachener Straße", house_number: "190", lat: 50.9365, lon: 6.9305, metres: 2100 },
      { name: "JET Tankstelle Köln-Riehl", street: "Riehler Straße", house_number: "201", lat: 50.9594, lon: 6.9759, metres: 2600 },
      { name: "Westfalen Tankstelle Köln-Zollstock", street: "Höninger Weg", house_number: "115", lat: 50.9081, lon: 6.9500, metres: 3300 },
    ],
  ],
  [
    // #703: the DWD road forecast at production's shape for Köln (the 19:00Z run of
    // 2026-10-12: Koeln-Ost AK 4.2 km, Gremberg A559, Rodenkirchen), with ONE
    // slippery hour at the nearest — the heavier of the two renderings, so the page
    // budget measures the worst real case and not the all-clear.
    ROAD_FORECAST_NEAR_SQL,
    roadForecastRows(),
  ],
  [
    LIFTS_NEAR_SQL,
    [
      { station_no: "3320", station_name: "Köln Hbf", metres: 700, kind: "elevator", state: "inactive", description: "zu Gleis 4/5", state_since: ago(95), last_seen_at: ago(3), source_feed: "db_fasta" },
      { station_no: "3320", station_name: "Köln Hbf", metres: 700, kind: "escalator", state: "active", description: "zu Gleis 1", state_since: ago(95), last_seen_at: ago(3), source_feed: "db_fasta" },
      { station_no: "3343", station_name: "Köln Messe/Deutz", metres: 1500, kind: "elevator", state: "active", description: "zu Gleis 11", state_since: ago(95), last_seen_at: ago(3), source_feed: "db_fasta" },
    ],
  ],
  // 2.1.3: the listed stops' own units by station number — Köln Hbf at production's
  // size (a dozen described units, the disclosure's cap), so the page budget measures it.
  [
    FASTA_AT_STATIONS_SQL,
    [
      { station_no: "3320", station_name: null, metres: 0, kind: "elevator", state: "inactive", description: "zu Gleis 4/5", state_since: ago(95), last_seen_at: ago(3), source_feed: "db_fasta" },
      { station_no: "3320", station_name: null, metres: 0, kind: "escalator", state: "active", description: "zu Gleis 1", state_since: ago(95), last_seen_at: ago(3), source_feed: "db_fasta" },
      ...[2, 3, 6, 7, 8, 9, 10, 11, 12, 13].map((g) => ({ station_no: "3320", station_name: null, metres: 0, kind: g % 2 === 0 ? "elevator" : "escalator", state: "active", description: `zu Gleis ${String(g)}`, state_since: ago(95), last_seen_at: ago(3), source_feed: "db_fasta" })),
    ],
  ],
  [
    PARKING_AT_STOPS_SQL,
    [
      { stop: "de:05315:11201", source_feed: "park_koeln_static", attribution_id: "mobilithek_park_koeln_static", kind: "car_park", name: "Parkhaus Dom", capacity_total: 520, metres: 180 },
      { stop: "de:05315:11201", source_feed: "park_koeln_static", attribution_id: "mobilithek_park_koeln_static", kind: "car_park", name: "Parkhaus Bahnhof", capacity_total: 410, metres: 240 },
    ],
  ],
  [STEP_FREE_AT_STOPS_SQL, []],
  // 2.1.10 (#711): the register row above publishes "Cologne"; GeoNames names it Köln (row 2, 1-based).
  [TOWN_EXONYMS_SQL, [{ i: 2, name: "Köln" }]],
  // 2.1.10 (#711): Köln Hbf's StaDa point and the zHV stop its RE5 call is filed under.
  [STATION_DHIDS_BY_EVA, [{ eva: "8000207", dhids: ["de:05315:99001"] }]],
  // #711 (2.1.10): `find_sharing`'s station and free-floating reads — four KVB-Rad
  // stations (three with a bike, the most the card lists, one empty) and two
  // Donkey bikes of the current snapshot, so the page is measured at its largest.
  [
    SHARING_STATIONS_SQL,
    [
      { name: "Neumarkt", distance_m: 180, vehicles_available: 4, electric_available: 1 },
      { name: "Dom/Hbf", distance_m: 260, vehicles_available: 7, electric_available: 0 },
      { name: "Rudolfplatz", distance_m: 520, vehicles_available: 0, electric_available: 0 },
      { name: "Appellhofplatz", distance_m: 610, vehicles_available: 2, electric_available: 2 },
    ].map((x, i) => ({
      system_id: "nextbike_kg", station_id: `kvb-${String(i)}`, capacity: 12, is_virtual: false, source_feed: "gbfs_nextbike", status_seen_at: ago(2), system_name: "KVB-Rad",
      lat: 50.936 + i * 0.002, lon: 6.948, docks_available: 12 - x.vehicles_available, is_renting: true, is_returning: true, counted_at: ago(20), reported_at: ago(21), ...x,
    })),
  ],
  [
    SHARING_VEHICLES_SQL,
    [
      { form_factor: "bicycle", propulsion: "human", range_m: null, source_feed: "gbfs_donkey", vehicles_seen_at: ago(2), observed_at: ago(2), system_name: "Donkey Republic Köln", distance_m: 340 },
      { form_factor: "bicycle", propulsion: "electric_assist", range_m: 31000, source_feed: "gbfs_donkey", vehicles_seen_at: ago(2), observed_at: ago(2), system_name: "Donkey Republic Köln", distance_m: 780 },
    ],
  ],
  // #645: two hydrogen stations, the most the fuel card names.
  [
    HYDROGEN_NEAR_SQL,
    [
      { name: "Shell Köln-Godorf", operator: "H2 MOBILITY Deutschland GmbH & Co. KG", refill: [{ solution: "gaseousHydrogen700barCar" }, { solution: "gaseousHydrogen350barTruck" }], metres: 9800, lat: 50.8566, lon: 6.9812 },
      { name: "TotalEnergies Köln-Mülheim", operator: "H2 MOBILITY Deutschland GmbH & Co. KG", refill: [{ solution: "gaseousHydrogen700barCar" }], metres: 12400, lat: 50.9671, lon: 7.0118 },
    ],
  ],
]);


/** #703: 24 forecast hours for each of production's three Köln road stations; one slippery hour at the nearest. */
function roadForecastRows(): RoadForecastNearRow[] {
  const stations = [
    { station_id: "K0042", name: "Koeln-Ost AK", segment_type: 1, position_source: "dwd", lat: 50.9493, lon: 7.0212, metres: 4200 },
    { station_id: "K0043", name: "Gremberg A559", segment_type: 1, position_source: "dwd", lat: 50.9221, lon: 7.0024, metres: 4700 },
    { station_id: "K0044", name: "Rodenkirchen", segment_type: 2, position_source: "dwd", lat: 50.8901, lon: 6.9915, metres: 6100 },
  ];
  const run = new Date(NOW.getTime() - 40 * 60_000);
  const out: RoadForecastNearRow[] = [];
  for (const s of stations) {
    for (let h = 0; h < 24; h++) {
      out.push({ ...s, valid_at: new Date(NOW.getTime() + h * 3_600_000), run_at: run, rc: s.station_id === "K0042" && h === 6 ? 3 : 1, ts: 4 + (h % 5), tl: 6.5 + (h % 4), rrl1c: h % 3 === 0 ? 0.4 : 0, rrs1c: 0 });
    }
  }
  return out;
}

/**
 * The home links the popular places (`POPULAR_PLACES`) and every link must
 * resolve (`site.e2e.ts`), so the by-AGS lookup answers each of them with its
 * own name and AGS — over Köln's figures, which is all this fixture holds.
 */
const POPULAR = new Map(POPULAR_PLACES.map((p) => [p.ags, p.name]));

/**
 * #891 (O1, C1): what OpenStreetMap and the charging tables hold near the fixture's car parks. Answered like the
 * statements answer — per asked site, within its radius, the nearest of each kind — so a site's position in the ask
 * list does not matter: P+R Weiden West (which states a WC) has a WC 90 m off (left out, O8) and a restaurant
 * 180 m off; P+R Köln-Messe (which states nothing) a WC 80 m off and a charger 110 m off.
 */
const NEARBY_POIS = [
  { amenity: "toilet", name: "WC", lat: 50.9563 + 0.00081, lon: 6.8562 },
  { amenity: "restaurant", name: "Gasthaus Weiden", lat: 50.9563 + 0.00162, lon: 6.8562 },
  { amenity: "toilet", name: "WC Messe", lat: 50.9466 + 0.00072, lon: 6.9822 },
] as const;
const NEARBY_CHARGERS = [
  { source_feed: "afir_chargecloud_stat", site_id: "c891", name: "Ladepark Messe", operator: "RheinEnergie", street: null, house_number: null, city: "Köln", lat: 50.9466 - 0.00099, lon: 6.9822, distance_m: 110,
    points: [chargePoint(150, "available", 3), chargePoint(150, "available", 3)], also_feeds: [] },
  // a register row beside it is never a nearby charger (#526: its points can be town centres)
  { source_feed: "bnetza_lsr", site_id: "c891r", name: "Register", operator: "TankE", street: null, house_number: null, city: "Köln", lat: 50.9466 - 0.0003, lon: 6.9822, distance_m: 33,
    points: [chargePoint(22, null, null)], also_feeds: [] },
];
const metresApart = (aLat: number, aLon: number, bLat: number, bLon: number): number => {
  const rad = Math.PI / 180;
  const x = (bLon - aLon) * rad * Math.cos(((aLat + bLat) / 2) * rad);
  return Math.sqrt(x * x + ((bLat - aLat) * rad) ** 2) * 6_371_008.8;
};
function nearbyOsmRows(params: readonly unknown[] | undefined): unknown[] {
  const lons = (params?.[0] as readonly number[] | undefined) ?? [];
  const lats = (params?.[1] as readonly number[] | undefined) ?? [];
  const radii = (params?.[2] as readonly number[] | undefined) ?? [];
  return lons.flatMap((lon, i) => {
    const lat = lats[i] ?? 0;
    const near = NEARBY_POIS.map((p) => ({ ...p, metres: Math.round(metresApart(lat, lon, p.lat, p.lon)) })).filter((p) => p.metres <= (radii[i] ?? 0));
    const kinds = [...new Set(near.map((p) => p.amenity))];
    return kinds.map((k) => near.filter((p) => p.amenity === k).sort((a, b) => a.metres - b.metres)[0]!).map((p) => ({ site: i + 1, amenity: p.amenity, name: p.name, metres: p.metres, lat: p.lat, lon: p.lon, extract_date: "2026-10-01" }));
  });
}
/**
 * #1070: Germany's boundary as the fixture world knows it — a rough box with Basel and Strasbourg cut out (they are
 * 3 and 4 km from Weil am Rhein and Kehl), so a browser fix or a neighbour's address meets the rule as production does:
 * inside, at the border (the nearest German place's cards and the A5 crossing), or far (Paris, Reykjavik, the US).
 */
const BORDER_TOWNS = [
  { at: [47.5596, 7.5886], town: { name: "Weil am Rhein", admin_code: "08336091", population: 30_000, lat: 47.5947, lon: 7.6203 }, metres: 3_000 },
  { at: [48.5734, 7.7521], town: { name: "Kehl", admin_code: "08317057", population: 37_000, lat: 48.5728, lon: 7.8155 }, metres: 4_100 },
] as const;
const borderOf = (lat: number, lon: number): (typeof BORDER_TOWNS)[number] | undefined => BORDER_TOWNS.find((b) => metresApart(lat, lon, b.at[0], b.at[1]) < 15_000);
/**
 * #1188: the planted world's own towns besides Köln, so a point there is named honestly — the Autohof Kitzingen of
 * `energy-autohof.ts` lies in Kitzingen, and its pages' "In der Nähe" says so. Every other German point stays Köln's.
 */
const PLANTED_TOWNS = [{ name: "Kitzingen", admin_code: "09675139", population: 22_000, lat: 49.7366, lon: 10.1638 }] as const;
const PLANTED_TOWN_M = 15_000;
const nearestTown = (lat: number, lon: number): typeof KOELN | (typeof PLANTED_TOWNS)[number] & { metres: number } => {
  const t = PLANTED_TOWNS.find((x) => metresApart(lat, lon, x.lat, x.lon) < PLANTED_TOWN_M);
  return t === undefined ? KOELN : { ...t, metres: Math.round(metresApart(lat, lon, t.lat, t.lon)) };
};
const insideGermany = (lat: number, lon: number): boolean => lat >= 47.27 && lat <= 55.1 && lon >= 5.87 && lon <= 15.04 && borderOf(lat, lon) === undefined;
const PLACE_DB = {
  query: (text: string, params?: readonly unknown[]) => {
    const ags = typeof params?.[0] === "string" ? params[0] : "";
    if (text === POINT_IN_GERMANY_SQL) return Promise.resolve({ rows: [{ loaded: true, inside: insideGermany(Number(params?.[1]), Number(params?.[0])) }] });
    if (text === GEMEINDE_NEAREST_SQL) {
      const lat = Number(params?.[1]);
      const lon = Number(params?.[0]);
      const b = borderOf(lat, lon);
      if (b !== undefined) return Promise.resolve({ rows: [{ ...b.town, metres: b.metres }] });
      return Promise.resolve({ rows: insideGermany(lat, lon) ? [nearestTown(lat, lon)] : [] });
    }
    const town = BORDER_TOWNS.find((b) => b.town.admin_code === ags);
    if (text === GEMEINDE_BY_AGS_SQL && town !== undefined) return Promise.resolve({ rows: [town.town] });
    const planted = PLANTED_TOWNS.find((x) => x.admin_code === ags);
    if (text === GEMEINDE_BY_AGS_SQL && planted !== undefined) return Promise.resolve({ rows: [{ ...planted, metres: 0 }] });
    if (text === BORDER_CANDIDATES_SQL) return Promise.resolve({ rows: [{ road: "A5", name: "Grenzübergang Weil am Rhein", lon: 7.6, lat: 47.6, metres: 41_000 }] });
    if (text === NEAR_NATIONAL_BORDER_SQL) return Promise.resolve({ rows: [{ i: 1 }] });
    if (text === GEMEINDE_BY_AGS_SQL && POPULAR.has(ags)) return Promise.resolve({ rows: [{ ...KOELN, name: POPULAR.get(ags)!, admin_code: ags }] });
    if (text === MOTORWAY_SUMMARY_SQL || text === MOTORWAY_SUMMARY_PAGE_SQL) return motorwayQuery(text, params);
    if (text === PLACES_MOTORWAYS_SQL) return Promise.resolve({ rows: placesMotorways((params?.[0] as readonly string[] | undefined) ?? []) });
    if (text === PLACE_NEIGHBOURS_SQL) return Promise.resolve({ rows: neighboursOf(params) });
    if (text === PARKING_NEARBY_OSM_SQL) return Promise.resolve({ rows: nearbyOsmRows(params) });
    if (text === PARKING_NEARBY_CHARGING_SQL) return Promise.resolve({ rows: NEARBY_CHARGERS });
    if (text === CHARGING_NEAR_SQL || text === CHARGING_NEAR_FILTERED_SQL) return Promise.resolve({ rows: chargingNearRows(params, text === CHARGING_NEAR_FILTERED_SQL) });
    if (text === CHARGING_FACETS_SQL) return Promise.resolve({ rows: chargingFacetRows(params) });
    if (text === SCHEDULED_AT_STOPS_SQL) return Promise.resolve({ rows: planAnswer(params) });
    if (LORRY_FIXTURE && text === SEVAS_PLACE_SQL) return Promise.resolve({ rows: [SEVAS_KOELN] });
    // #1075: one survey row at the fixture's Dom/Hbf stop, by its DHID, only for the spec that asks for it (no other page moves)
    if (SURVEY_FIXTURE && text === BFRK_AT_STOPS_SQL) return Promise.resolve({ rows: ((params?.[0] ?? []) as readonly string[]).includes(VBB_SURVEY.dhid) ? [VBB_SURVEY] : [] });
    return Promise.resolve({ rows: [...(PLACE_ROWS.get(text) ?? [])] });
  },
} as unknown as Parameters<typeof createPlaceService>[0]["db"];

/**
 * #1027: the road pages' rows — `ROAD_PAGE_SQL`'s shape, read by the digest's own `createRoadService` (its sources, its
 * model, its renderer), so the fragment the shell embeds is the one production renders. The two roads are the examples
 * llms.txt names (`site/discovery.ts`): the B 51 (two works in force, one ended this week) and the L 249 under NRW (a
 * closure in force), both from NRW's roadworks feed, at fixture places that have a place page. Plausible, not
 * production's: no production row is copied.
 */
const roadPageRow = (over: Partial<RoadPageRow> & Pick<RoadPageRow, "publication_id" | "road_number">): RoadPageRow => ({
  feed_key: "roadworks_nrw_lvz",
  source_id: "nrw_lvz",
  event_type: "roadworks",
  overall_start: ago(3 * 1440),
  overall_end: new Date(NOW.getTime() + 14 * 86_400_000),
  closed_at: null,
  first_seen_at: ago(3 * 1440 - 5),
  last_seen_at: ago(4),
  lat: 50.96,
  lon: 6.98,
  in_force: true,
  fresh: true,
  ended_at: null,
  closes: false,
  place_text: null,
  detail_text: null,
  detour_via: null,
  gem_ags: "05315000",
  gem_name: "Köln",
  ...over,
});
const ROAD_ROWS: readonly RoadPageRow[] = [
  roadPageRow({ publication_id: "nrw-b51-1", road_number: "B 51", place_text: "zwischen Köln-Mülheim und Köln-Dellbrück", detail_text: "Fahrbahnerneuerung, eine Fahrspur je Richtung" }),
  roadPageRow({ publication_id: "nrw-b51-2", road_number: "B 51", lat: 51.51, lon: 7.47, gem_ags: "05913000", gem_name: "Dortmund", place_text: "Höhe Dortmund-Brackel", detail_text: "Leitungsarbeiten" }),
  roadPageRow({ publication_id: "nrw-b51-3", road_number: "B 51", overall_start: ago(9 * 1440), overall_end: ago(2 * 1440), closed_at: ago(2 * 1440), in_force: false, ended_at: ago(2 * 1440), last_seen_at: ago(2 * 1440) }),
  roadPageRow({ publication_id: "nrw-l249-1", road_number: "L 249", event_type: "roadOrCarriagewayOrLaneManagement", closes: true, lat: 51.45, lon: 7.01, gem_ags: "05113000", gem_name: "Essen", place_text: "zwischen Essen-Kettwig und Essen-Werden", detail_text: "Vollsperrung" }),
];
const laterOf = (a: Date | null, b: Date | null): Date | null => (a === null ? b : b === null ? a : a > b ? a : b);
/**
 * The statements' answers over `ROAD_ROWS`: the page read by its road key (`$1`) and feeds (`$2`), the list read
 * grouped by road key and feed as `ROAD_PAGE_LIST_SQL` groups them — derived from the same rows, never typed twice.
 */
const ROAD_DB = {
  query: (text: string, params?: readonly unknown[]) => {
    const feeds = new Set((text === ROAD_PAGE_SQL ? params?.[1] : params?.[0]) as readonly string[] | undefined);
    const rows = ROAD_ROWS.filter((r) => feeds.has(r.feed_key));
    if (text === ROAD_PAGE_SQL) return Promise.resolve({ rows: rows.filter((r) => roadRefKey(r.road_number) === params?.[0]) });
    if (text !== ROAD_PAGE_LIST_SQL) return Promise.reject(new Error(`the road fixture does not answer ${text.slice(0, 60)}`));
    const groups = new Map<string, RoadPageListRow>();
    for (const r of rows) {
      const key = roadRefKey(r.road_number);
      const g = groups.get(`${key ?? ""}|${r.feed_key}`);
      groups.set(`${key ?? ""}|${r.feed_key}`, {
        road_key: key,
        feed_key: r.feed_key,
        active: (g?.active ?? false) || (r.closed_at === null && r.in_force && r.fresh),
        ended_at: laterOf(g?.ended_at ?? null, r.ended_at),
        first_seen_at: laterOf(g?.first_seen_at ?? null, r.first_seen_at) ?? r.first_seen_at,
      });
    }
    return Promise.resolve({ rows: [...groups.values()] });
  },
} as unknown as Parameters<typeof createRoadService>[0]["db"];
/** `roads: "empty"` — a database holding no road row (the list is empty); `"down"` — every road read fails. */
const NO_ROAD_DB = { query: () => Promise.resolve({ rows: [] }) } as unknown as Parameters<typeof createRoadService>[0]["db"];
const DOWN_ROAD_DB = { query: () => Promise.reject(new Error("the road fixture is down")) } as unknown as Parameters<typeof createRoadService>[0]["db"];

/**
 * `pageSize` (#938): the card pager's size (`ui.card_page_size`, 12 by default) for this digest, so a browser test can page
 * the fixture's short place lists (Köln's roads, chargers, car parks) to their end without planting more rows — the
 * rows, and every golden read off them, are unchanged.
 */
export async function startRealDigest(
  opts: { readonly scale?: "e2e" | "production"; readonly exits?: "walked" | "none"; readonly roads?: "held" | "empty" | "down"; readonly pageSize?: number; readonly energy?: "autohof"; readonly lorry?: "sevas"; readonly survey?: "vbb" } = {},
): Promise<{ readonly url: string; close: () => Promise<void> }> {
  LORRY_FIXTURE = opts.lorry === "sevas";
  SURVEY_FIXTURE = opts.survey === "vbb";
  // #1064: the page budget asks for production's size; every browser test for the shape it was written against.
  PRODUCTION_SCALE = opts.scale === "production";
  setMotorwayLayerScale(PRODUCTION_SCALE);
  const snapshot = fixtureSnapshot();
  const report = buildDigest({ snapshot });
  const service: DigestService = {
    report: () => Promise.resolve(report),
    current: () => Promise.resolve({ snapshot, report }),
    databaseState: () => "up",
    start: () => Promise.resolve(),
    stop: () => undefined,
  };
  const chargingStore = createMotorwayCharging({ db: MOTORWAY_DB, now: () => NOW });
  const motorways = createMotorwayService({ db: MOTORWAY_DB, now: () => NOW, chargingStore });
  // #1000: the place cards' lamps are the held motorway pages' — wired as `http.ts` wires them
  const places = createPlaceService({ db: PLACE_DB, now: () => NOW, digest: service, lampAt: (road, segment) => crossingLamp(motorways.heldPage?.(road) ?? null, segment) });
  // #716: the chargers are read in the background on a page's first view; the fixture reads them for every road first and WAITS for the
  // store to drain (`idle`, never a sleep), so a test never meets "being read".
  for (const road of MOTORWAY_REGISTER) {
    const p = await motorways.page(road);
    if (p.ok && p.value !== null) motorways.charging(road, p.value.line ?? []);
  }
  await chargingStore.idle();
  // (the A34 has no course: no corridor to read chargers along, so its page carries no charging block at all)
  for (const road of MOTORWAY_REGISTER) if (pointCount(road) > 0 && chargingStore.get(road) === "pending") throw new Error(`the fixture's chargers for ${road} were not read`);
  // #892: the place pages are addressed by their stored slug; this fixture's `place_slugs` is every place it answers for
  setPlaceSlugs([...POPULAR_PLACES, { ags: "09564000", name: "Nürnberg" }].map((p) => ({ ags: p.ags, slug: slugify(p.name) })));
  // #1025: the exit register as production serves it once its first lap is done — walked here to the end (one step per
  // motorway, as `http.ts`'s timer would), so the exit sitemaps and the index's lamps answer; `exits: "none"` keeps the
  // register before its first lap (the sitemaps' 503).
  const exits = createExitWalker({ register: () => motorways.register(), held: (road) => motorways.heldPage?.(road) ?? null, read: (road) => (motorways.exitRead ?? motorways.page)(road), now: () => NOW });
  if (opts.exits !== "none") for (let i = 0; i <= MOTORWAY_REGISTER.length && !exits.snapshot().complete; i++) await exits.step();
  if (opts.exits !== "none" && !exits.snapshot().complete) throw new Error("the fixture's exit register did not complete its lap");
  const stations = createStationService({ db: STATION_DB, now: () => NOW });
  // #1027: the road pages as production wires them (`http.ts`); `roads: "empty"`/`"down"` are the sitemaps' 503 states
  const roads = createRoadService({ db: opts.roads === "empty" ? NO_ROAD_DB : opts.roads === "down" ? DOWN_ROAD_DB : ROAD_DB, now: () => NOW });
  const size = opts.pageSize;
  // #1081: the charging card under a person's filter, and a station page's own charging card, as `http.ts` wires them
  const filteredCharging = createFilteredCharging({ db: PLACE_DB, now: () => NOW });
  const app = createApp({ service, places, motorways, exits, stations, roads, filteredCharging, ...stateDeps(), ...energyDeps(opts.energy), now: () => NOW, ...(size === undefined ? {} : { pageSize: () => Promise.resolve(size) }) });
  const server: Server = await new Promise((resolve) => {
    const s = app.listen(0, "127.0.0.1", () => resolve(s));
  });
  return {
    url: `http://127.0.0.1:${(server.address() as AddressInfo).port}`,
    close: () =>
      new Promise<void>((r) => {
        server.closeAllConnections?.();
        server.close(() => r());
      }),
  };
}

// #1074 (lane pages-1074): the Land pages as production wires them (`http.ts` `createStateService`) — the planted
// database of the digest's own tests (one Autobahn closure in Bayern, a current tick), the popular places as each
// Land's largest towns. Kept to this one block and one spread on the `createApp` line, so the lanes that also extend
// this fixture merge without touching each other's lines. (An `import` is hoisted wherever it is written.)
import { createStateService } from "@viafrei/digest";
import { stateDb } from "../test/digest-support/state-service.test.support.js";

function stateDeps(): { readonly states: ReturnType<typeof createStateService> } {
  const db = stateDb({ tick: new Date(NOW.getTime() - 120_000), cities: POPULAR_PLACES.map((p) => ({ ags: p.ags, name: p.name })) });
  return { states: createStateService({ db, now: () => NOW }) };
}

// #1076 (lane st-1076): the station pages' heaviest case for the page-weight gate — the Autohof hub and its fuel station
// (`e2e/energy-autohof.ts`), wired only when asked (`energy: "autohof"`), so every browser test keeps the digest it was
// written against (no station page service: the station routes answer 404). Kept to this block and one spread on the
// `createApp` line, like the Land pages' above.
import { autohofEnergy } from "./energy-autohof.js";

// #1190: every other digest serves the place pages' OWN charging world — a page for each site of `CHARGING_SITES` (the
// sites the Köln charging card links, by the card's own slug rule) and the sitemap list of them — so the charging
// sitemap answers 200 and no place page links a charging page that answers 404 (before 2.5.15 only the Autohof digest
// held a page service, and the crawl met three 404s from Köln's card).
function energyDeps(kind: "autohof" | undefined): { readonly energy: EnergyPageService } {
  return { energy: kind === "autohof" ? autohofEnergy(() => NOW) : placeChargingEnergy() };
}

import { chargingPageKeyedSlug } from "@viafrei/ingest";
import type { ChargingPage, EnergyPageService } from "../../../.pinned/app/packages/digest/dist/src/server/energy-page-service.js";
import { chargingNearRowOf } from "../../../.pinned/app/packages/digest/dist/src/cards/shared/sql-charging.js";
import { ENERGY_SITEMAP_PART } from "../../../.pinned/app/packages/digest/dist/src/queries/energy-pages.sql.js";

type PlantedSite = (typeof CHARGING_SITES)[number];
const siteSlug = (x: PlantedSite): string => chargingPageKeyedSlug({ sourceFeed: x.source_feed, siteId: x.site_id, operator: x.operator, name: x.name, city: x.city, street: x.street });

/** The slugs of the planted charging world, in the list's order. */
const PLANTED_CHARGING_SLUGS: readonly string[] = CHARGING_SITES.map(siteSlug);

function plantedChargingPage(x: PlantedSite): ChargingPage {
  const day = NOW.toISOString().slice(0, 10);
  return {
    kind: "charging",
    alternatives: [],
    slug: siteSlug(x),
    row: { source_feed: x.source_feed, site_id: x.site_id, operator: x.operator, name: x.name, street: x.street, house_number: x.house_number, postcode: null, city: x.city, lat: x.lat, lon: x.lon, day },
    // the town as the service judges it: Köln for the sites inside the city, no claim for the ones beyond it
    town: x.city === "Köln" || x.city === "Cologne" ? { ags: KOELN.admin_code, name: KOELN.name } : null,
    exit: null,
    // the page reads its own site at its own point: the place card's row at 0 m
    site: chargingNearRowOf({ ...x, distance_m: 0 }),
    liveness: { ok: true, value: [] },
  };
}

function placeChargingEnergy(): EnergyPageService {
  const bySlug = new Map(CHARGING_SITES.map((x) => [siteSlug(x), x] as const));
  const day = NOW.toISOString().slice(0, 10);
  const total = CHARGING_SITES.length;
  const parts = Math.ceil(total / ENERGY_SITEMAP_PART);
  return {
    fuel: () => Promise.resolve({ ok: true, value: { kind: "missing" } }),
    charging: (s) => {
      const x = bySlug.get(s);
      return Promise.resolve({ ok: true, value: x === undefined ? { kind: "missing" } : { kind: "page", page: plantedChargingPage(x) } });
    },
    fuelPrices: () => Promise.resolve({ ok: true, value: { kind: "missing" } }),
    list: (kind, part) =>
      Promise.resolve({
        ok: true,
        value: { total: kind === "charging" ? total : 0, parts: kind === "charging" ? parts : 0, entries: kind === "charging" && part === 1 ? PLANTED_CHARGING_SLUGS.map((slug) => ({ slug, day })) : [] },
      }),
    counters: () => ({ reads: 0, listHits: 0, failures: 0, collisions: 0 }),
  };
}

// #1193 (lane credit-1193): SEVAS's lorry restrictions around the place, wired only when asked (`lorry: "sevas"`), so
// every other browser test, screenshot and page budget keeps the digest it was written against. The rows are the place
// statement's shape (`lorryPlaceSql`), at the fixture's Köln point, with invented streets: plausible, not production's.

let LORRY_FIXTURE = false;
/** #1075: whether the place DB answers the step-free survey statement (`startRealDigest({ survey: "vbb" })`). */
let SURVEY_FIXTURE = false;
/** #1075: a VBB station-entrance row, the shape `BFRK_AT_STOPS_SQL` reads, at the fixture's Dom/Hbf stop. */
const VBB_SURVEY: BfrkSurveyRow = {
  source_feed: "vbb_haltestellenzugaenge", dhid: "de:05315:11111", name: "Dom/Hbf", validated: null, lifts: 3, ramps: 0, platforms_guidance: 0,
  platforms_level_boarding: 0, platforms_ramp_boarding: 0, platforms_limited_boarding: 0, platforms_no_step_free: 0, step_free: null,
};
const SEVAS_PLACE_SQL = lorryPlaceSql(LORRY_SEVAS_RELATION);
const SEVAS_KOELN: LorryPlaceRow = {
  covered: true,
  kinds: [{ kind: "max_height", n: 2, nearest_m: 600 }, { kind: "max_weight", n: 1, nearest_m: 900 }],
  restrictions: [
    { source_feed: "lorry_sevas_nrw", source_feeds: ["lorry_sevas_nrw"], kind: "max_height", group: "height", sign: "265", value: 3.5, unit: "m", published_text: null, exceptions: [], times: null, days: null, street: "Planstraße", municipality: "Köln", lat: 50.9411, lon: 6.9612, distance_m: 600 },
    { source_feed: "lorry_sevas_nrw", source_feeds: ["lorry_sevas_nrw"], kind: "max_weight", group: "weight", sign: "262", value: 7.5, unit: "t", published_text: null, exceptions: [], times: null, days: null, street: "Musterweg", municipality: "Köln", lat: 50.9431, lon: 6.9561, distance_m: 900 },
  ],
  groups: [{ group: "height", n: 2, unnamed: 0, source_feeds: ["lorry_sevas_nrw"] }, { group: "weight", n: 1, unnamed: 0, source_feeds: ["lorry_sevas_nrw"] }],
  priority: [{ source_feed: "lorry_sevas_nrw", category: "priority_route", segments: 4, route_count: 1, nearest_m: 700, streets: ["Beispielring"] }],
  reads: [{ source_feed: "lorry_sevas_nrw", read_at: ago(300).toISOString() }],
};
