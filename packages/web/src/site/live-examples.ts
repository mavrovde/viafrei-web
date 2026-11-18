/**
 * Real answers on the connect page (#472, extended for the v1.8.1
 * integrations): what each integration answers, shortened, with the moment the
 * data was read and the credit lines the answer carried.
 *
 * v1.7.6 (#472): a Trucklounge lorry park (#416) and the B3 roadworks (#451) —
 * both moved off in v1.8.16 by the rotation of the time, the two oldest, and back since #746.
 *
 * v1.8.16 (#486, #487), ASKED OF PRODUCTION (mcp.viafrei.de, serving v1.8.15) on
 * 2026-10-06 at 18:26–18:27 Europe/Berlin, one call each, read-only, the raw
 * answers kept outside the repository as the session's evidence:
 * - the lifts and escalators at a Köln Stadtbahn stop (Ebertplatz, #487), with
 *   the publisher named in full and its no-warranty sentence in every language;
 * - free hire bikes at a station (Kiel Hbf, Donkey Republic, #486).
 * (The page kept at most 25 cards from v1.8.16 to 2.1.23, rotating the oldest
 * off; #746 removed the cap — see the 2.1.24 paragraph below.)
 *
 * v1.8.1 (#460, #464, #465, #466, #467/#468), read off the RECORDED pulls of
 * 2026-10-05 because the feeds are not on production yet — each value names
 * the recording it was read from and, where one exists, the handler test that
 * replays that recording through the real tool:
 * - a lift out of service at Köln Hbf (DB OpenStation, #464);
 * - a published service alert with its validity (DELFI GTFS-RT, #466);
 * - a regional-train delay from DELFI SIRI ET (#465);
 * - a charger's live status from e-clearing.net (#468);
 * - a Köln car park from the city's own facility table (#460).
 * v1.8.2 (#474, #470), read off the RECORDED pulls of 2026-10-05 the same
 * way, each replayed through the real tool on the committed fixture:
 * - a city roadworks message found by place (Berlin, #474);
 * - a Land-road roadworks site (Thüringen's L1025, #470).
 * v1.8.2 PR 3 audit (#455, #473), the same way, from the recorded pulls of
 * 2026-10-05 (`fixtures/mobilithek/recorded/roadworks-ald-sn.xml`,
 * `situation-traffic-sh.xml`) replayed through the real tools on a throwaway
 * database, each item still in force on the day it was recorded:
 * - a Bundesstraße site in Sachsen (the B6 at Oschatz, LASuV, #455);
 * - a street closure the Schleswig-Holstein police office reports, found by
 *   place (Kiel's Werftstraße, #473).
 * Not given an example, for a stated reason and nothing invented: Köln's
 * events (#462) — every one of the ten situations in the recorded pull had
 * ENDED when it was pulled (the latest end 2026-09-21, the fixture's header),
 * so the tool answers Köln with no event; Hannover (#475) — its publication
 * is empty.
 * v1.8.2 PR 3, owner 2026-10-05 ("find more interesting and useful examples,
 * about parkings for example"), ASKED OF PRODUCTION (mcp.viafrei.de, serving
 * v1.8.0) on 2026-10-05 between 20:11 and 20:16 Europe/Berlin, read-only, the
 * raw answers kept outside the repository as the session's evidence:
 * - a secure lorry park on the A7 with live free spaces (Bosch, #412/#434);
 * - Park+Ride before switching to the train, kept apart (P+R NRW, #415);
 * - a departure with its live delay and a platform change (Berlin Hbf, #441);
 * - a conurbation's punctuality (Rhein-Ruhr as one region, #442);
 * - tomorrow's roadworks on a long route (BASt, the A7);
 * - a closure ahead (the A1 in Hamburg, Autobahn GmbH; since v1.9.6 the A7 south of Hamburg);
 * - a weather check before a mountain drive (DWD, read every 5 minutes since 1.7.0).
 * v1.8.9, data steward 2026-10-06 (#454 C1): the Baden-Württemberg police
 * message is gone from the page. Its RVWD condition allows the message only
 * unabridged and only while current; a dated card reworded into seven
 * languages is neither. In its place, asked of production: a closed slip road
 * on the A6 from the Autobahn GmbH (`motorway`), a source with no such
 * condition. An example crediting a source whose catalogue row carries a
 * condition must quote its `verbatim` message in every language — pinned.
 * Owner 2026-10-05 ("I want normal useful fuel examples"; consumer information on
 * our own page, owner's decision), asked of production at 20:44 the same way:
 * - the cheapest E10 in a city (Köln). The diesel by the A3 (Würzburg) and the
 *   E10 in Stuttgart moved off in v1.8.18 (the rotation below: the oldest
 *   cards of the oldest release go first, and fuel keeps its newest).
 *   Each card carries the Tankerkönig credit and the MTS-K consumer-information
 *   note verbatim, and says that a fuel price is an example of that evening.
 *   The price is split into `euro` and `cent` so each language writes its own
 *   decimal mark. `asOf` is the moment asked; `reported` is the station's own
 *   report time, as the answer printed it ("Preis von …").
 * These carry no `recheck`: they are production's own answers.
 * v1.8.9, ASKED OF PRODUCTION (mcp.viafrei.de, serving v1.8.8) on 2026-10-06
 * between 03:51 and 04:01 Europe/Berlin, one call per example, the raw answers
 * kept outside the repository as the session's evidence — the recheck the
 * v1.8.1/v1.8.2 examples were flagged for:
 * - confirmed and re-dated: the L1025 (#470), Kiel's Werftstraße (#473, asked by
 *   its own coordinates; "Werftstraße, Kiel" is ambiguous to the resolver);
 * - confirmed with production's figures: Köln Hbf's lifts (#464 — the lift that
 *   was out of service is back, so "none reported"), the B6 in Sachsen (#455 —
 *   nine sites, Oschatz among them), a Köln car park (#460 — Brückenstraße, open
 *   and fresh, where Am Gürzenich is reported closed at night);
 * - REMOVED, because production does not give the answer: the DELFI SIRI ET
 *   train (#465) — the block appears only when DB Timetables fails or answers
 *   without realtime, and at 03:51 DB answered Frankfurt (Main) Hbf in full, so
 *   no question can be relied on to show it; Berlin's Schiffbauerdamm (#474) —
 *   asked by the example's own coordinates, the 11-line answer is filled by the
 *   Autobahn GmbH's 26 closures before any Senatsverwaltung message, and asked
 *   by place, "Schiffbauerdamm, Berlin" resolves to Wismar;
 * - re-figured: the service alert (#466) — the recording's VBN line 201 is not
 *   among the six of 181 alerts production lists for Niedersachsen; the card
 *   quotes the first, the L133 closure between Lilienthal and Grasberg;
 * - still to re-ask: the e-clearing.net charger (#468) — production timed out
 *   twice (fixed in this release), so `recheck: "v1.8.9"`.
 * v1.8.10, ASKED OF PRODUCTION (mcp.viafrei.de, serving v1.8.9) on 2026-10-06 at
 * 05:26–05:28 Europe/Berlin, one call per example, the raw answers kept outside
 * the repository as the session's evidence:
 * - the charger (#468), re-asked: five sites at the address, one "1 von 1 frei",
 *   four "keine Statusdaten" — reworded and re-dated, `recheck` cleared;
 * - two AFIR pairs with their live half (#467): an EnBW fast charger in Würselen
 *   (EnBW static + EnBW availability) and a JOLT fast charger in Hamburg through
 *   Eco-Movement (static + availability). Tesla's live status is already on the
 *   home's "Laden" moment (Hilden, both Tesla lines); VW cannot have one — its two
 *   halves share no identifier (#467, measured 2026-10-05).
 * - Berlin's Schiffbauerdamm back (#474) — CONFIRMED on production v1.8.10 at
 *   2026-10-06T04:31:20Z (same first line, period and credits; Stand 06:24), flag dropped: production cannot
 *   give this answer before the v1.8.10 deploy — by place "Schiffbauerdamm, Berlin"
 *   resolved to a stop in Wismar, and by coordinates the A100/A111 closures filled
 *   the answer first; both are fixed in this release. The figures are the
 *   Senatsverwaltung message as production's database holds it (read-only SELECT
 *   on `road_events_live`, 2026-10-06 05:20 Europe/Berlin). After the deploy, ask
 *   `check_road_status {"place":"Schiffbauerdamm, Berlin","language":"de"}` once,
 *   confirm or replace the figures, the Stand and the credits, and drop the flag.
 * v1.8.12 (#481, #482, #484, #485), ASKED OF PRODUCTION (mcp.viafrei.de, serving v1.8.12) on 2026-10-06 between
 * 12:25 and 12:29 Europe/Berlin, one call per example, read-only, the raw answers kept outside the repository as the
 * session's evidence — one card per feed that went live in that release (owner: each feed ships with a site example):
 * - a charger's live status through MobiData BW's OCPDB, chargecloud's points (Köln, Ottostraße 7, #481);
 * - a charger only the Bundesnetzagentur's Ladesäulenregister knows, said as having no live status (Freiburg, #482);
 * - a Hamburg car park with the city's own caveat that its real-time data is unverified (Europa-Passage, #484);
 * - a Münster car park from the city's Parkleitsystem (Parkhaus Stubengasse, #485).
 * Each card credits exactly the sources its answer returned.
 * v1.9.14 (#488): a planned Bundesstraße site in Baden-Württemberg (the B27 at Bad Dürrheim, BEMaS via MobiData BW),
 * read off the RECORDED cut of 2026-10-11 and replayed through the real tool, `recheck: "v1.9.14"` — BEMaS is not on
 * production yet. It moved the oldest card off by the rotation: the Köln car park (v1.8.1, #460), deleted here and
 * from the seven catalogues in the same change. The signed BW detours (#492) have no card: they ride on a motorway
 * closure's answer only when the closure's words name a detour's junction pair, and no such answer has been seen.
 * v1.9.14 (#490): Hamburg's city roadworks by place (Bauweiser), read off the recorded pull the same way,
 * `recheck: "v1.9.14"`. The roads integration of both (1.9.15) put 26 cards against the cap of 25, and the rotation
 * moved the next-oldest off: the e-clearing.net charger in Düsseldorf (v1.8.1, #468; re-asked in v1.8.10), deleted
 * here and from the seven catalogues in the same change. The charging domain keeps its newer cards (EnBW, Eco-Movement,
 * OCPDB, the Ladesäulenregister).
 * Each carries `recheck`: after the v1.8.1 (or v1.8.2) deploy, ask production the same
 * question and either confirm the figures still describe that answer's shape
 * or replace them (and the "Stand") with production's — then drop the flag.
 * `recheckAfterDeploy()` is the list, and `test/live-examples.test.ts` pins it.
 *
 * 2.1.24 (#746, owner 2026-10-15: "restore every removed example"), ASKED OF PRODUCTION (mcp.viafrei.de,
 * serverInfo 2.1.23) on 2026-10-16 between 21:14 and 21:21 Europe/Berlin, one call per card with `language: "de"`,
 * every fuel question ONCE, the raw answers kept outside the repository as the session's evidence. The page budget
 * that rotated cards off is 500 KB since #742, so CONNECT_CARD_CAP and the rotation are gone: every card is on the page
 * again, and the seven that had moved off are back — the e-clearing.net charger, the Köln car park, the Trucklounge
 * lorry park (with its ODbL § 4.6 offer), the B3 roadworks, the regional train (with a new question, its comment says
 * why) and the two fuel cards by the A3 and in Stuttgart. Every card's figures and Stand are that evening's; a sentence
 * was rewritten in all seven languages wherever the answer said something else, the card's comment saying so, and the
 * two recordings (`hhworks`, `bwroad`) were confirmed or replaced on production, so nothing carries `recheck`. One card
 * was REPLACED: `lsr` (the Freiburg address answers from an AFIR feed now). Not restored, for a stated reason: the
 * Baden-Württemberg police message (`police`), removed for the RVWD condition (#454 C1), not for the budget.
 * 2.5.4: every card ASKED OF PRODUCTION again on 2026-11-02 between about 13:58 and 14:23 Europe/Berlin, one call per
 * card with `language: "de"`, every fuel question ONCE; each card's comment quotes that answer and says what was reworded
 * (in all 22 languages). Two were replaced in kind: `kiel` (the ferry's message had ended; a closure from the city of
 * Kiel's own roadworks list, the same question shape) and `platform` (no platform change on the board; a live delay).
 * `test/example-freshness.test.ts` fails a card older than 14 days against the real clock.
 * 2026-11-18: every card ASKED OF PRODUCTION again between 14:29 and 14:31 Europe/Berlin, one call per card with
 * `language: "de"`, every fuel question ONCE (B27: the week 23.-29.11.; A7 tomorrow: 19.11.). Cards whose sentence still
 * holds took that day's figures and Stand (the per-card comments still quote the 02.11 answers); `fuelcity` had no
 * current price, so it takes the "no new price" sentence. Asked again 14:30-14:40: kiel, lorry, parkride and citywork
 * still hold; carpark (Altstadt-Nord/Hbf) and platform (ICE 600) take a new subject; ecomove names the operator. No
 * subject fitted after five candidates each, so stadtbahn, lift, ocpdb, charger, landroad and weather were reworded in
 * all 22 languages to that day's answer for the same subject (asked 14:37-14:52).
 *
 * The WORDS are copy and live in the deck (`connectPage.live.*`), one per
 * language. The VALUES are figures read off one answer and are the same in
 * every language, so they live here — and nowhere is a figure made up. A value
 * not yet read would carry the marker — the constant `TODO_VALUE`, whose value
 * is the string "TODO-VALUE" — which `test/live-examples.test.ts` names.
 *
 * Proper names (a park, a station, a stop, a street address) are rendered
 * `translate="no"`, so a translated page names them and the language check
 * (#449) judges them as names, not as copy. `name` is the one name a question
 * leads with (and the answer is headed by); `names` are any further names the
 * question or the answer puts in a `{placeholder}`.
 */
import type { MessageKey } from "../i18n/index.js";
import { isRetired } from "./example-ledger.js";
import type { SignKind } from "./signs.js";

/** The placeholder a value carries until it is read off a production answer. */
export const TODO_VALUE = "TODO-VALUE";

export type LiveKey =
  | "stadtbahn" | "bikes"
  | "lift" | "alert" | "enbw" | "ecomove" | "ocpdb" | "lsr" | "charger" | "hamburg" | "hhworks" | "muenster" | "carpark"
  | "motorway" | "citywork" | "landroad" | "saxony" | "bwroad" | "roadworks" | "kiel"
  | "truckstop" | "lorry" | "parkride" | "platform" | "train" | "region" | "tomorrow" | "closure" | "weather"
  | "fuelcity" | "fuelroad" | "fuelland";

/**
 * The domain a card shows — the examples page (#747) groups by it: bus, train and station
 * (`transit`), a place to park (`parking`), a place to charge (`charging`), a fuel price (`fuel`), and the
 * road itself — closures, roadworks, weather (`roads`).
 */
export const DOMAINS = ["transit", "parking", "charging", "fuel", "roads"] as const;
export type Domain = (typeof DOMAINS)[number];

export type LiveExample = {
  readonly key: LiveKey;
  /** What the card shows: the examples page's group (#747). */
  readonly domain: Domain;
  /** The release whose feed or answer the card was added for. */
  readonly added: `v${number}.${number}.${number}`;
  /** The tool that gave the answer — an identifier, not copy. */
  readonly tool: string;
  /** The German traffic sign the answer's card carries beside its title (owner 2026-10-05). */
  readonly sign: SignKind;
  /** The question, `{name}` standing for `name` (rendered untranslated). */
  readonly question: MessageKey;
  /** A proper name the question and the answer carry, never translated; it heads the answer. */
  readonly name?: string;
  /** Further proper names, by placeholder, wherever the question or the answer uses them — never translated. */
  readonly names?: Readonly<Record<string, string>>;
  /** The credit lines the answer carried: register ids, rendered verbatim and German from the catalogue. */
  readonly credits: readonly string[];
  /** The figures of ONE answer, by the deck's placeholder name. */
  readonly values: Readonly<Record<string, string>>;
  /**
   * The publisher's message text, unchanged, for a source whose terms bind the text itself (the RVWD condition of
   * `mobilithek_traffic_bw`, #454 C1): every language's answer must contain it verbatim, or the example may not exist.
   * `test/live-examples.test.ts` refuses such an example without it.
   */
  readonly verbatim?: string;
  /** Read off a recording, not production: to be re-checked against production after the deploy that enables the feed. */
  readonly recheck?: "v1.8.1" | "v1.8.2" | "v1.8.9" | "v1.8.10" | "v1.9.14";
};

/** A fuel card (v1.8.2): find_cheapest_fuel's answer for a place, with the Tankerkönig credit. */
const fuelCard = (key: LiveKey, question: MessageKey, names: Readonly<Record<string, string>>, values: Readonly<Record<string, string>>): LiveExample => ({
  key,
  domain: "fuel",
  added: "v1.8.2",
  tool: "find_cheapest_fuel",
  sign: "fuel",
  question,
  credits: ["tankerkoenig"],
  names,
  values,
});

export const LIVE_EXAMPLES: readonly LiveExample[] = [
  {
    key: "stadtbahn",
    domain: "transit",
    added: "v1.8.16",
    tool: "check_station_facilities",
    sign: "info",
    question: "connectPage.live.stadtbahn.q",
    // check_station_facilities {station: "Ebertplatz"}, asked 2026-11-02 14:10: "Stadtbahn Köln Ebertplatz (Störungsliste Stand 14:02):
    // 4 von 10 gemeldeten Anlagen sind außer Betrieb. Fahrtreppe 51 …: gemeldet seit 06.10. 17:32 · Fahrtreppe 52 …: gemeldet seit 06.10. 17:32
    // · Fahrtreppe 53 …: gemeldet seit 31.10. 20:21 · Fahrtreppe 62 …: gemeldet seit 31.10. 03:01 · Aufzug 01 …: in Betrieb · Aufzug 02 …:
    // in Betrieb" and the KVB no-warranty sentence. Reworded: a fourth escalator is out. The steward's ruling on #487 stands: the publisher
    // named in full, its no-warranty sentence in every language.
    credits: ["delfi_zhv", "kvb_lifts"],
    names: { stop: "Ebertplatz", publisher: "Kölner Verkehrs-Betriebe AG" },
    // 2026-11-18, asked 14:45 (Störungsliste Stand 14:37): 3 von 10 — Fahrtreppe 51 and 52 since 11.11. 17:30, Fahrtreppe 60 since
    // 15.11. 10:36; Aufzug 01 and 02 in Betrieb. Reworded: three escalators.
    values: { out: "3", total: "10", e1: "51", e2: "52", since: "11.11., 17:30", e3: "60", since3: "15.11., 10:36", asOf: "18.11.2026, 14:37" },
  },
  {
    key: "bikes",
    domain: "transit",
    added: "v1.8.16",
    tool: "find_sharing",
    sign: "info",
    question: "connectPage.live.bikes.q",
    // find_sharing {place: "Kiel Hbf"}, asked 2026-11-02 14:10: "Leihräder nahe Kiel Hbf (Umkreis 1 km): … - Hauptbahnhof (Donkey Republic
    // Kiel) — 6 Räder frei · 112 m …" — eight docks; Stand 14:09. Kiel and not Köln on purpose (data steward, #486).
    credits: ["gbfs_donkey", "db_stada"],
    names: { station: "Kiel Hbf", dock: "Hauptbahnhof", operator: "Donkey Republic" },
    values: { free: "5", docks: "8", radius: "1", asOf: "18.11.2026, 14:27" },
  },
  {
    key: "lift",
    domain: "transit",
    added: "v1.8.1",
    tool: "check_station_facilities",
    sign: "info",
    question: "connectPage.live.lift.q",
    // check_station_facilities {station: "Köln Hbf", facility: "elevator"}, asked 2026-11-02 14:10: 8 lifts, 6 in Betrieb; "Aufzug zu Gleis
    // 8/9 (Anlage 10801910): außer Betrieb" and "Aufzug zu Gleis 8/9 (Anlage 10849189): Status unbekannt — wird nicht überwacht". Stand
    // 13:44. Reworded: the second lift to 8/9 is out of service now. The answer's Stadtbahn half (KVB) is not on this card.
    credits: ["db_stada", "mobilithek_openstation_netex", "mobilithek_openstation_siri_fm"],
    names: { station: "Köln Hbf" },
    // 2026-11-18, asked 14:40: 8 lifts, 7 in Betrieb, none außer Betrieb; "Aufzug zu Gleis 8/9 (Anlage 10849189): Status unbekannt — wird
    // nicht überwacht". Stand 14:38. Reworded: none out of service.
    values: { total: "8", working: "7", platforms: "8/9", asOf: "18.11.2026, 14:38" },
  },
  {
    key: "alert",
    domain: "transit",
    added: "v1.8.1",
    tool: "check_transit_disruption",
    sign: "stop",
    question: "connectPage.live.alert.q",
    // check_transit_disruption {region: "Niedersachsen"}, asked 2026-11-02 (Stand 13:58): "Veröffentlichte Störungsmeldungen für
    // Niedersachsen, jetzt in Kraft (169): - Linien 831, 863, 864: Baustellenfahrpläne gültig wegen Sperrung der L133 Lilienthal-Grasberg …
    // (gültig 27.07.2026 bis 12.12.2026)".
    credits: ["delfi_rt_tu", "delfi_static", "delfi_rt_sa", "delfi_siri_sx"],
    names: { a: "Lilienthal", b: "Grasberg" },
    values: { count: "163", lines: "831, 863, 864", road: "L133", from: "27.07.2026", to: "12.12.2026", asOf: "18.11.2026, 14:28" },
  },
  {
    key: "enbw",
    domain: "charging",
    added: "v1.8.10",
    tool: "find_charging_station",
    sign: "charging",
    question: "connectPage.live.enbw.q",
    // find_charging_station {place: "Schumanstraße 4, Würselen", limit: 3}, asked 2026-11-02 14:11: "1. Schumanstraße 4, 52146 Würselen
    // (ENBW) — 0,1 km, CCS2/Typ 2, bis 300 kW, 0,70 €/kWh" with five points, none of them with a status, and no EnBW availability line among
    // the sources. Stand 14:11. Reworded: no status at all; the credits are the answer's (EnBW static, the register, OSM).
    credits: ["mobilithek_afir_enbw_stat", "bnetza_lsr", "osm"],
    names: { brand: "EnBW", address: "Schumanstraße 4, Würselen" },
    values: { n: "5", kw: "300", euro: "0", cent: "70", asOf: "18.11.2026, 14:29" },
  },
  {
    key: "ecomove",
    domain: "charging",
    added: "v1.8.10",
    tool: "find_charging_station",
    sign: "charging",
    question: "connectPage.live.ecomove.q",
    // find_charging_station {place: "Schiffbeker Weg 299, Hamburg", limit: 2}, asked 2026-11-02 14:11: "1. JOLT HH008701, Schiffbeker Weg
    // 299, 22043 Hamburg (JOLT Energy) — CCS2, bis 350 kW, 0,785 €/kWh, Status von 01.11. 20:15 — möglicherweise veraltet". Stand 14:11.
    // The card rounds the price to the cent. Asked again 2026-11-18 14:29: "1. Schiffbeker Weg 299, 22043 Hamburg (JOLT Energy) — CCS2,
    // bis 350 kW, 0,79 €/kWh, 1 frei, 1 belegt, Status von 15.11. 16:20 — möglicherweise veraltet": the site id is no longer printed,
    // so the card names the operator the answer names. Reworded: the two last statuses, possibly out of date (as charger).
    credits: ["mobilithek_afir_ecomovement", "mobilithek_afir_ecomovement_dyn", "osm"],
    names: { site: "JOLT Energy", address: "Schiffbeker Weg 299, Hamburg" },
    values: { kw: "350", euro: "0", cent: "79", free: "1", busy: "1", t: "15.11., 16:20", asOf: "18.11.2026, 14:29" },
  },
  {
    key: "ocpdb",
    domain: "charging",
    added: "v1.8.12",
    tool: "find_charging_station",
    sign: "charging",
    question: "connectPage.live.ocpdb.q",
    // find_charging_station {place: "Ottostraße 7, 50823 Köln", limit: 1}, asked 2026-11-02 14:10: "1. … Ottostraße 7, 50823 Köln (TankE
    // GmbH) — two points: CCS bis 50 kW außer Betrieb, Typ 2 bis 22 kW frei, 0,49 €/kWh netto (Stand 14:10)". Reworded: one is free.
    credits: ["mobilithek_afir_chargecloud_stat", "ocpdb_chargecloud", "osm"],
    names: { address: "Ottostraße 7, 50823 Köln" },
    // 2026-11-18, asked 14:45: "CCS2/Typ 2, bis 50 kW, 0,49 €/kWh netto, 2 von 2 frei". Stand 14:44. Reworded: both free.
    values: { kw: "50", euro: "0", cent: "49", asOf: "18.11.2026, 14:44" },
  },
  {
    key: "lsr",
    domain: "charging",
    added: "v1.8.12",
    tool: "find_charging_station",
    sign: "charging",
    question: "connectPage.live.lsr.q",
    // REPLACED (#746) by this Leipzig address. find_charging_station {place: "Friedrich-Ebert-Straße 51, Leipzig", limit: 1}, asked
    // 2026-11-02 14:11: "1. Friedrich-Ebert-Straße 51, 04109 Leipzig … — Typ 2, bis 22 kW, keine Statusdaten, laut Ladesäulenregister" and
    // "Stand des Ladesäulenregisters: 01.09.2026 … ohne Gewähr". Stand 14:11. The 19 m are computed from the address's own geocode
    // (one find_address call), as this answer printed no distance.
    credits: ["bnetza_lsr", "osm"],
    names: { address: "Friedrich-Ebert-Straße 51, Leipzig" },
    values: { m: "19", kw: "22", register: "01.09.2026", asOf: "18.11.2026, 14:29" },
  },
  {
    key: "charger",
    domain: "charging",
    added: "v1.8.1",
    tool: "find_charging_station",
    sign: "charging",
    question: "connectPage.live.charger.q",
    // find_charging_station {place: "Martin-Luther-Platz 26, Düsseldorf", limit: 2} (limit 2: the site is the second row, as before),
    // asked 2026-11-02 14:12: "2. Parkhaus Schadow Arkaden, Martin-Luther-Platz 26, 40212 Düsseldorf (Ladenetz) — Typ 2, bis 22,08 kW,
    // 0,403 €/kWh netto (11 Ladeeinrichtungen)": none occupied, 8 with a status from 01.11. 14:19 (möglicherweise veraltet), 3 without
    // one. Stand 14:12. Reworded: nothing occupied, and too old or unknown to say "free".
    credits: ["mobilithek_afir_eclearing_stat", "mobilithek_afir_eclearing_dyn", "osm"],
    names: { address: "Martin-Luther-Platz 26, Düsseldorf", site: "Parkhaus Schadow Arkaden" },
    // 2026-11-18, asked 14:52: "Typ 2, bis 22,1 kW, 0,40 €/kWh netto, 4 frei, 5 belegt, 1 außer Betrieb, Status von 17.11. 17:27 —
    // möglicherweise veraltet, 1 ohne Status (11 Ladeeinrichtungen)". Stand 14:52. Reworded: the last statuses, said to be old.
    values: { points: "11", kw: "22", kwd: "1", euro: "0", cent: "40", free: "4", busy: "5", out: "1", unknown: "1", t: "17.11., 17:27", asOf: "18.11.2026, 14:52" },
  },
  {
    key: "hamburg",
    domain: "parking",
    added: "v1.8.12",
    tool: "find_parking",
    sign: "parking",
    question: "connectPage.live.hamburg.q",
    // find_parking {place: "Hamburg Jungfernstieg"}, asked 2026-11-02 14:12: "1. Europa-Passage — Parkhaus, 0,1 km, 690 Plätze, 19 frei,
    // Störung … 2. Alsterhaus — Parkhaus, 0,2 km, 87 Plätze, 0 frei (Stand 14:07)" and the city's caveat „Diese Echtzeitdaten sind
    // ungeprüft.“ The card quotes the Alsterhaus, whose figure carries no fault flag; sources as answered.
    credits: ["hamburg_parkhaeuser", "osm", "delfi_zhv"],
    names: { stop: "Jungfernstieg", park: "Alsterhaus" },
    values: { free: "8", total: "87", asOf: "18.11.2026, 14:25" },
  },
  {
    key: "hhworks",
    domain: "roads",
    added: "v1.9.14",
    tool: "find_roadworks_ahead",
    sign: "warning",
    question: "connectPage.live.hhworks.q",
    // find_roadworks_ahead {place: "Steinstraße, Hamburg"}, asked 2026-11-02 14:12: "• Steinstraße, Speersort / Straßenumbau — Autoverkehr:
    // Die Steinstraße bleibt bis auf die Vollsperrung (voraussichtlich im Frühjahr 2027) durchgehend a… (laufend, 31.08.2026–31.05.2028;
    // 0,3 km)". Stand 14:10. Confirmed.
    credits: ["hh_bauweiser", "delfi_zhv"],
    names: { street: "Steinstraße", b: "Speersort" },
    values: { from: "31.08.2026", to: "31.05.2028", asOf: "18.11.2026, 14:14" },
  },
  {
    key: "muenster",
    domain: "parking",
    added: "v1.8.12",
    tool: "find_parking",
    sign: "parking",
    question: "connectPage.live.muenster.q",
    name: "Parkhaus Stubengasse",
    // find_parking {place: "Stubengasse, Münster", kind: "car_park"}, asked 2026-11-02 14:12: "1. Parkhaus Stubengasse — 300 Plätze,
    // 105 frei (Stand 14:09)", then four more car parks, each with its own "frei". Stand 14:09. The separate OSM list is not quoted.
    credits: ["muenster_pls", "delfi_zhv"],
    values: { free: "89", total: "300", more: "4", asOf: "18.11.2026, 14:25" },
  },
  {
    key: "carpark",
    domain: "parking",
    added: "v1.8.1",
    tool: "find_parking",
    sign: "parking",
    question: "connectPage.live.carpark.q",
    name: "Altstadt-Nord/Hbf",
    // find_parking {place: "Köln", kind: "car_park"}, asked 2026-11-02 14:12: "Brückenstraße — Parkhaus, 0,1 km, 531 Plätze, 340 frei",
    // published 13:48 and flagged as no longer current (every Köln car park was; the feed was last read 13:49). Reworded: "zuletzt …
    // gemeldet", an older report. Sources as answered (OSM for the separate list, the BKG for the place).
    // REPLACED 2026-11-18 (Brückenstraße now reports current figures): find_parking {place: "Köln Hbf", kind: "car_park"}, asked
    // 14:40: "2. Altstadt-Nord/Hbf — Parkhaus, 0,2 km, 550 Plätze, zuletzt 458 frei gemeldet … (Stand 12:38, vor 2 h 2 min)". Sources
    // as answered (Stadt Köln, Parkhäuser NRW, OSM for the separate list).
    credits: ["mobilithek_park_koeln_static", "mobilithek_park_koeln_dyn", "mobilithek_park_nrw_parken", "osm"],
    values: { free: "458", total: "550", asOf: "18.11.2026, 12:38" },
  },
  {
    key: "motorway",
    domain: "roads",
    added: "v1.8.9",
    tool: "check_road_status",
    sign: "autobahn",
    question: "connectPage.live.motorway.q",
    // check_road_status {road: "A6"}, asked 2026-11-02 14:12: "A6: 7 Sperrungen … • Sperrung: A6 Ersatzneubau BW 6416707 AS Frankenthal
    // · AS Frankenthal (aus Richtung Frankenthal) nach A6 — Zeitraum dieser Bauphase: Beginn: 20.03.25 …, Ende: 30.01.27 …". Stand 14:12.
    // It replaced the BW police message (#454 C1): an Autobahn GmbH answer carries no RVWD condition.
    credits: ["autobahn", "mobilithek_roadworks_bast"],
    names: { place: "Frankenthal" },
    values: { from: "20.03.2025", to: "30.01.2027", count: "6", asOf: "18.11.2026, 14:28" },
  },
  {
    key: "citywork",
    domain: "roads",
    added: "v1.8.2",
    tool: "check_road_status",
    sign: "warning",
    question: "connectPage.live.citywork.q",
    // check_road_status {place: "Schiffbauerdamm, Berlin"}, asked 2026-11-02 14:13: "• Sperrung: Schiffbauerdamm (Mitte) — in beiden
    // Richtungen zwischen Luisenstraße und Albrechtstraße Leitungsbau, Vollsperrung für Kfz-Verkehr. … (09.07.2025–31.08.2028)". Stand
    // 14:10. The same message with a later end, so CITYWORK_CARD_EXPIRES moves with it.
    credits: ["autobahn", "mobilithek_roadworks_bast", "mobilithek_nms_events", "mobilithek_traffic_berlin", "osm"],
    names: { street: "Schiffbauerdamm", a: "Luisenstraße", b: "Albrechtstraße" },
    // Asked again 2026-11-18 14:31: the same message, same dates; Senatsverwaltung Stand 13:54.
    values: { from: "09.07.2025", to: "31.08.2028", asOf: "18.11.2026, 13:54" },
  },
  {
    key: "landroad",
    domain: "roads",
    added: "v1.8.2",
    tool: "find_roadworks_ahead",
    sign: "warning",
    question: "connectPage.live.landroad.q",
    // find_roadworks_ahead {road: "L1025"}, asked 2026-11-02: "L1025: 2 Arbeitsstellen zwischen 02.11.2026 und 09.11.2026 … •
    // Instandsetzung (Thüringen): Alte Hauptstraße / Kirchplatz; Engstellensignalisierung — 04.05.2026 bis 04.05.2028" (the other, at
    // Waltershausen, a night's closure on 06./07.11.). Stand 13:58. Reworded: two sites, the card names one.
    credits: ["mobilithek_roadworks_ald_th"],
    names: { site: "Alte Hauptstraße / Kirchplatz" },
    // 2026-11-18, asked 14:45: "L1025: 1 Arbeitsstelle zwischen 18.11.2026 und 25.11.2026" — the same site. Stand 13:07. Reworded: one site.
    values: { from: "04.05.2026", to: "04.05.2028", asOf: "18.11.2026, 13:07" },
  },
  {
    key: "saxony",
    domain: "roads",
    added: "v1.8.2",
    tool: "find_roadworks_ahead",
    sign: "warning",
    question: "connectPage.live.saxony.q",
    // find_roadworks_ahead {road: "B6"}, asked 2026-11-02: "B6: 8 Arbeitsstellen zwischen 02.11.2026 und 09.11.2026, alle bereits
    // begonnen. … Niedersachsen 4, Sachsen 4. … • Instandsetzung (Sachsen): Dresden - Ortschaft Cossebaude; Ausbau westlich Cossebaude —
    // 04.03.2025 bis 02.03.2027". Stand 13:45. The answer's attribution line also names Sachsen's Sperrinfosys; the card quotes the
    // LASuV site only, so its credits are unchanged.
    credits: ["mobilithek_roadworks_ald_ni", "mobilithek_roadworks_nlstbv", "mobilithek_roadworks_ald_sn"],
    names: { place: "Cossebaude" },
    values: { count: "12", from: "04.03.2025", to: "02.03.2027", asOf: "18.11.2026, 12:59" },
  },
  {
    key: "bwroad",
    domain: "roads",
    added: "v1.9.14",
    tool: "find_roadworks_ahead",
    sign: "warning",
    question: "connectPage.live.bwroad.q",
    // find_roadworks_ahead {road: "B27", from: "2026-11-09", to: "2026-11-15"}, asked 2026-11-02: "B27: 12 Arbeitsstellen zwischen
    // 09.11.2026 und 15.11.2026, alle bereits begonnen. … Niedersachsen 2, Baden-Württemberg 3, Bayern 4, Hessen 3. … • Instandsetzung
    // (Baden-Württemberg): B 27 Bietigheim-Bissingen BA 4 zwischen Geisinger Straße und Wilhelmstraße, Stuttgart-Heilbronn — Erneuerung an
    // der Decke, 1 von 2 Fahrstreifen eingeschränkt, 15.06.2025 bis 12.12.2026". Stand 14:10. The week asked is the coming one, as before.
    credits: ["bemas_bw"],
    names: { a: "Stuttgart", b: "Heilbronn" },
    values: { count: "4", all: "11", from: "15.06.2025", to: "12.12.2026", asOf: "18.11.2026, 14:28" },
  },
  {
    key: "roadworks",
    domain: "roads",
    added: "v1.7.6",
    tool: "find_roadworks_ahead",
    sign: "warning",
    question: "connectPage.live.roadworks.q",
    // find_roadworks_ahead {road: "B3"}, asked 2026-11-02: "B3: 21 Arbeitsstellen zwischen 02.11.2026 und 09.11.2026 … Niedersachsen 5
    // (alle begonnen), Baden-Württemberg 2, Hessen 14. • Arbeitsstelle (Niedersachsen): BW Örtzebrücke, Unterführung der Örtze — 01.07.2021
    // bis 30.09.2029 …". Stand 14:10. Confirmed.
    credits: ["mobilithek_roadworks_ald_ni", "mobilithek_roadworks_nlstbv"],
    names: { section: "BW Örtzebrücke, Unterführung der Örtze" },
    values: { count: "5", start: "01.07.2021", end: "30.09.2029", asOf: "18.11.2026, 14:20" },
  },
  {
    key: "kiel",
    domain: "roads",
    added: "v1.8.2",
    tool: "check_road_status",
    sign: "warning",
    question: "connectPage.live.kiel.q",
    // REPLACED (2.5.4): the Holtenau-Wik ferry's message ended 23.10., and asked again, check_road_status {place: "Kiel"} on
    // 2026-11-02 14:15 carries no Landesmeldestelle message near Kiel (that feed is alive: it answered on the A7 the same hour). The same
    // kind of card from the same answer, a closure in Kiel found by place: "• Sperrung: Kanalbauarbeiten für Neubau Schmutzwasser und
    // Regenwasser — Lorentzendamm, Lorentzendamm zw. Hausnr. 14 und Dahlmannstraße, Damperhof … (02.11.2026–27.11.2026; 0,6 km)", from
    // the city's own roadworks list. Stand 14:12. Still a summary with every element, said so in each language (#473).
    credits: ["kiel_baustellen"],
    names: { street: "Lorentzendamm", b: "Dahlmannstraße" },
    // Asked again 2026-11-18 14:30: the same message, same dates; the city's list Stand 14:18.
    values: { no: "14", from: "02.11.2026", to: "27.11.2026", asOf: "18.11.2026, 14:18" },
  },
  {
    key: "truckstop",
    domain: "parking",
    added: "v1.8.2",
    tool: "find_parking",
    sign: "lorry",
    question: "connectPage.live.truckstop.q",
    name: "BREAK Autohof Hamburg-Nordheide",
    // find_parking {lat: 53.162, lon: 10.062, kind: "truck"}, asked 2026-11-02: "1. BREAK Autohof Hamburg-Nordheide — Lkw-Parkplatz,
    // 150 Plätze, 125 frei (Stand 13:46)". Sources as answered (the Lkw-Parken BAB register for the other rows).
    credits: ["mobilithek_park_bosch_static", "mobilithek_park_bosch_dyn", "mobilithek_truckpark_static_geonutzv"],
    values: { free: "135", total: "150", asOf: "18.11.2026, 14:29" },
  },
  {
    key: "lorry",
    domain: "parking",
    added: "v1.7.6",
    tool: "find_parking",
    sign: "lorry",
    question: "connectPage.live.lorry.q",
    name: "Trucklounge Ecopark",
    // find_parking {place: "Emstek"}, asked 2026-11-02: "Außerdem, aus einer separat geführten ODbL-Datenbank (nicht mit den Listen
    // oben abgeglichen): 1. Trucklounge Ecopark — Lkw-Parkplatz, 3,0 km, 54 frei (Stand 14:15)" and the ODbL § 4.6 offer, which the card
    // prints in the page's language (`offerHtml`). Sources as answered.
    credits: ["mobilithek_truckpark_static_geonutzv", "mobilithek_park_trucklounge", "mobilithek_park_trucklounge_occ", "bkg_gvisys"],
    // Asked again 2026-11-18 14:30: "1. Trucklounge Ecopark — Lkw-Parkplatz, 3,0 km, 54 frei … (Stand 14:15)".
    values: { free: "54", asOf: "18.11.2026, 14:15" },
  },
  {
    key: "parkride",
    domain: "parking",
    added: "v1.8.2",
    tool: "find_parking",
    sign: "parking",
    question: "connectPage.live.parkride.q",
    // find_parking {place: "Dortmund", kind: "park_and_ride"}, asked 2026-11-02: "— aus P+R NRW (CC BY-SA), separat geführt … Dortmund
    // Hafen — P+R, 1,7 km, 430 Plätze … P&R Westfalenpark — P+R, 2,0 km, 190 Plätze …". Stand 14:20. The credit is the register's P+R NRW
    // line alone, as the register has it.
    credits: ["mobilithek_park_nrw_pr"],
    names: { p1: "Dortmund Hafen", p2: "P&R Westfalenpark" },
    // Asked again 2026-11-18 14:30: the same two rows, 430 and 190 Plätze, "Belegung übernehmen wir nicht".
    values: { t1: "430", t2: "190", asOf: "18.11.2026, 14:30" },
  },
  {
    key: "platform",
    domain: "transit",
    added: "v1.8.2",
    tool: "get_train_departures",
    sign: "train",
    question: "connectPage.live.platform.q",
    // get_train_departures {station: "Berlin Hbf"}, asked 2026-11-02: no platform change among the ten departures; the first,
    // "13:56 ICE 2795 → Innsbruck Hbf, Gleis 3, +29 min (ca. 14:25)". Stand 14:20. REPLACED in kind: no platform change to show, so the
    // card shows a live delay from the same board (title, question and answer reworded in every language).
    credits: ["db_timetables", "db_stada"],
    // REPLACED 2026-11-18 (ICE 2795 is not on the board): get_train_departures {station: "Berlin Hbf"}, asked 14:40: "13:37 ICE 600 →
    // Hamburg-Altona, ab Berlin Hbf, Gleis 6, +65 min (ca. 14:42)", no platform change. Stand 14:40.
    names: { station: "Berlin Hbf", train: "ICE 600", dest: "Hamburg-Altona" },
    values: { planned: "13:37", expected: "14:42", delay: "65", platform: "6", asOf: "18.11.2026, 14:40" },
  },
  {
    key: "train",
    domain: "transit",
    added: "v1.8.1",
    tool: "get_train_departures",
    sign: "stop",
    question: "connectPage.live.train.q",
    // get_train_departures {station: "Frankfurt (Main) Hbf", categories: ["RE", "RB"]}, asked 2026-11-02: "14:34 RE RE60 → Mannheim
    // Hbf, Gleis 10, pünktlich …" — ten regional departures to 14:50, nine on time (the RE50 to Bad Hersfeld +3 min, from another
    // platform). Stand 14:21. Reworded: nine of ten, not all. The note still says where SIRI ET comes in.
    credits: ["db_timetables", "db_stada"],
    names: { station: "Frankfurt (Main) Hbf", dest: "Mannheim Hbf" },
    values: { line: "RE60", planned: "14:34", platform: "10", n: "8", all: "10", last: "14:59", asOf: "18.11.2026, 14:30" },
  },
  {
    key: "region",
    domain: "transit",
    added: "v1.8.2",
    tool: "check_transit_disruption",
    sign: "stop",
    question: "connectPage.live.region.q",
    // check_transit_disruption {region: "Rhein-Ruhr"}, asked 2026-11-02: "Rhein-Ruhr (30 Kreise und kreisfreie Städte zusammen): 15 %
    // der beobachteten Fahrten mehr als 5 Minuten zu spät … Trend: schlechter als in den 60 Minuten davor (12 %)." Stand 13:58. Reworded:
    // "more than", as the tool says.
    credits: ["delfi_rt_tu"],
    values: { share: "20", before: "16", districts: "30", asOf: "18.11.2026, 14:28" },
  },
  {
    key: "tomorrow",
    domain: "roads",
    added: "v1.8.2",
    tool: "find_roadworks_ahead",
    sign: "warning",
    question: "connectPage.live.tomorrow.q",
    // find_roadworks_ahead {road: "A7", from: "2026-11-03", to: "2026-11-03"}, asked 2026-11-02: "A7: 78 Arbeitsstellen laut BASt
    // zwischen 03.11.2026 und 03.11.2026: 49 laufend … • Baustelle: A7 zw. Hammelburg → Bad Kissingen/Oberthulba 1,0 km — Brückenneubau,
    // 1 von 3 Fahrstreifen gesperrt, Tempo 80 — bis 30.09.2027". Stand 13:58. Reworded: not all are running yet, and the Derneburg site
    // is not among the ten shown, so the card names the bridge (the driving moment quotes it too).
    credits: ["mobilithek_roadworks_bast"],
    names: { a: "Hammelburg", b: "Bad Kissingen/Oberthulba" },
    values: { count: "78", started: "42", km: "1", speed: "80", until: "30.09.2027", asOf: "18.11.2026, 14:20" },
  },
  {
    key: "closure",
    domain: "roads",
    added: "v1.8.2",
    tool: "check_road_status",
    sign: "autobahn",
    question: "connectPage.live.closure.q",
    // check_road_status {road: "A7", limit: 11}, asked 2026-11-02: the Maschener Kreuz - Seevetal closure is not among the eleven any
    // more; near Hamburg: "A7, AS HH-Volkspark - AS HH-Othmarschen, achtstreifige Erweiterung und Neubau Altonatunnel — Bauphase …, Ende
    // 31.10.27 05:00", a closed ramp at AS Hamburg-Bahrenfeld, no direction given. Stand 14:17. Reworded: a ramp at a junction on that
    // works section. Withdrawn by CLOSURE_CARD_EXPIRES.
    credits: ["autobahn"],
    names: { at: "Hamburg-Bahrenfeld", a: "HH-Volkspark", b: "HH-Othmarschen" },
    values: { until: "31.10.2027", end: "05:00", asOf: "18.11.2026, 14:28" },
  },
  {
    key: "weather",
    domain: "roads",
    added: "v1.8.2",
    tool: "check_weather_warnings",
    sign: "warning",
    question: "connectPage.live.weather.q",
    name: "Oberstdorf",
    // check_weather_warnings {place: "Oberstdorf"}, asked 2026-11-02: one warning — "FROST, Warnstufe 1: Es tritt leichter Frost bis
    // -1 °C auf", gültig 03.11. 00:00 bis 08:00, published 12:33. Stand 14:17. Reworded: a warning now, the lowest level. The road-weather
    // forecast in the same answer is not quoted.
    credits: ["dwd"],
    // 2026-11-18, asked 14:45: "Stufe 2 von 4 — Markante Wetterwarnung — SCHWERE STURMBÖEN, Gültig: bis 19.11. 00:00", "oberhalb 1500 m".
    // Stand 14:43. Reworded: severe storm gusts, level 2 of 4.
    values: { alt: "1500", day: "19.11.", to: "00:00", level: "2", asOf: "18.11.2026, 14:43" },
  },
  fuelCard(
    "fuelcity",
    "connectPage.live.fuelcity.q",
    // find_cheapest_fuel {place: "Köln", fuel: "e10"}, asked ONCE 2026-11-02 14:22: current prices, ranked — "1. Markant (Tankautomat)
    // Automatentankstelle, Olpener Str. 27, 51103 Köln — 2,019 €/l (Stand 14:22)", tied with a JET. 2026-11-18: no current price, so the "no new price" sentence.
    { station: "TotalEnergies", address: "Holzmarkt 49, 50676 Koeln" },
    { euro: "1", cent: "879", reported: "17.11., 20:34", asOf: "18.11.2026, 14:30" },
  ),
  fuelCard(
    "fuelroad",
    "connectPage.live.fuelroad.q",
    // find_cheapest_fuel {place: "Würzburg", fuel: "diesel", radius_km: 10}, asked ONCE 2026-11-02 14:23: "kein Preis aus den letzten 30
    // Minuten … TopTank, Schweinfurter Str. 42, 97076 Würzburg — 2,249 €/l … (Preis von 31.10. 20:04) — neuer Preis wird gerade abgefragt"
    // (the lowest of the five, with the JET).
    { station: "TopTank", address: "Schweinfurter Str. 42, 97076 Würzburg" },
    { euro: "2", cent: "299", reported: "16.11., 12:46", asOf: "18.11.2026, 14:30" },
  ),
  fuelCard(
    "fuelland",
    "connectPage.live.fuelland.q",
    // find_cheapest_fuel {place: "Stuttgart", fuel: "e10"}, asked ONCE 2026-11-02 14:23: "kein Preis aus den letzten 30 Minuten … Shell,
    // Karl-Kloss-Str. 18, 70199 Stuttgart — 1,999 €/l … (Preis von 02.11. 03:33) — neuer Preis wird gerade abgefragt" (the lowest, with
    // two others).
    { station: "ESSO", address: "Immenhofer Str. 48, 70180 Stuttgart" },
    { euro: "1", cent: "939", reported: "14.11., 13:17", asOf: "18.11.2026, 14:30" },
  ),
];

/**
 * The cards the connect page renders: every card `RETIRED_FUEL` does not hold off (data-steward Verdict 2,
 * at most three Tankerkönig examples on the whole site).
 */
export const CONNECT_EXAMPLES: readonly LiveExample[] = LIVE_EXAMPLES.filter((e) => !isRetired(`card:${e.key}`));

/**
 * When the Kiel card stops being true (data steward, #473; replaced 2.5.4): the Lorentzendamm is closed
 * "02.11.2026–27.11.2026", a date with no time, so the card holds to the end of that day (23:59, +01:00),
 * and it answers "no" to a "right now" question. After this instant the card must be asked of production
 * again and replaced, or reworded — the test that reads it compares against the real clock on purpose. One
 * constant, and the example's own `to` value is pinned to it, so the two cannot drift apart.
 */
export const KIEL_CARD_EXPIRES = new Date("2026-11-27T23:59:00+01:00");

/**
 * When the Berlin card stops being true (#474): the Schiffbauerdamm works run to 31.08.2028 17:00 Europe/Berlin
 * (summer time, so +02:00; moved from 28.10.2026 by the publisher, read 2026-11-02), and the card answers "yes" to a
 * "right now" question. The same rule as the Kiel card: after this instant ask production again and replace it, or
 * reword it. Pinned to the example's `to`.
 */
export const CITYWORK_CARD_EXPIRES = new Date("2028-08-31T17:00:00+02:00");

/**
 * When the closure card stops being true (v1.9.6; re-asked 2.5.4): this construction phase of the A7 works between
 * HH-Volkspark and HH-Othmarschen, with the ramp at Hamburg-Bahrenfeld closed, ends 31.10.2027 05:00 Europe/Berlin
 * (winter time by then, so +01:00), and the card answers "yes" to a "right now" question. The same rule as the Kiel
 * and Berlin cards: after this instant ask production again and replace it, or reword it. Pinned to the example's
 * `until`/`end`.
 */
export const CLOSURE_CARD_EXPIRES = new Date("2027-10-31T05:00:00+01:00");

/**
 * The cards that describe a state with a stated end, and that end (#473, #474, v1.9.6). Past it a card would
 * answer a "right now" question with something that is over, so the connect page leaves it out — judged with
 * the REQUEST's clock (`connectExamples`), not at build time — until it is asked of production again and
 * replaced or reworded (then its constant moves).
 */
export const CARD_EXPIRES: Readonly<Partial<Record<LiveExample["key"], Date>>> = {
  kiel: KIEL_CARD_EXPIRES,
  citywork: CITYWORK_CARD_EXPIRES,
  closure: CLOSURE_CARD_EXPIRES,
};

/** The cards the connect page renders at `now`: `CONNECT_EXAMPLES` without a card whose stated end has passed. */
export function connectExamples(now: Date): readonly LiveExample[] {
  return CONNECT_EXAMPLES.filter((e) => {
    const end = CARD_EXPIRES[e.key];
    return end === undefined || now.getTime() < end.getTime();
  });
}

/** Every value still waiting for a production answer, as `<example>.<value>`. */
export function pendingValues(): readonly string[] {
  return LIVE_EXAMPLES.flatMap((e) => Object.entries(e.values).filter(([, v]) => v === TODO_VALUE).map(([k]) => `${e.key}.${k}`));
}

/** Every example whose figures came from a recording and must be re-checked against production after the deploy. */
export function recheckAfterDeploy(): readonly string[] {
  return LIVE_EXAMPLES.filter((e) => e.recheck !== undefined).map((e) => e.key);
}

/** The proper names an example's question and answer may carry, by placeholder. */
export function namesOf(e: LiveExample): Readonly<Record<string, string>> {
  return { ...(e.name === undefined ? {} : { name: e.name }), ...(e.names ?? {}) };
}
