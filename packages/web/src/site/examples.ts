/**
 * The daily moments and the tool catalogue the home prints (#379). The
 * QUESTIONS live in the copy deck (`day.moments.*`); this file binds each to
 * the tool that answers it, which is an identifier and not copy, to what
 * production ANSWERED to it, and to the live tile the moment carries.
 *
 * Every example must be TRUE on prod when it was asked, and is dated: no
 * scheduled bus or tram board (`get_departures` has no timetable until #399
 * ships), so the bus and tram moment asks for the nearest station and two
 * stations' boards — what the feeds already answer.
 *
 * The tool catalogue is still typed here; Phase 3 reads it from the server at
 * build (`src/generated/`).
 */
import type { MessageKey } from "../i18n/index.js";
import type { AskKey } from "../lib/ask.js";
import type { EmbeddedTileId, PendingTileId } from "../lib/tiles.js";
import { isRetired } from "./example-ledger.js";
import type { SignKind } from "./signs.js";

export type MomentKey = "commute" | "bus" | "station" | "driving" | "jam" | "parking" | "charging" | "places" | "watch";

/** One, two or three of a kind — a moment's questions, in the deck's order (`q1`, `q2`, `q3`). */
export type UpToThree<T> = readonly [T] | readonly [T, T] | readonly [T, T, T];

export type Moment = {
  readonly key: MomentKey;
  /** The live figure that proves the moment — one embedded tile — or null when nothing live proves it yet. */
  readonly tile: EmbeddedTileId | null;
  /** A second live tile under the first (#423: fuel beside the motorway reports). */
  readonly extra?: EmbeddedTileId;
  /** A slot the page renders ONLY when that tile is live (the bus and tram board, #399). */
  readonly pending?: PendingTileId;
  /** The German traffic sign the moment's card carries beside its title (owner 2026-10-05). */
  readonly sign: SignKind;
  /** The tool that answers each question of the copy deck (`day.moments.<key>.q*`), in order. */
  readonly tools: UpToThree<string>;
  /** What production answered to each question, shortened (`day.moments.<key>.a1|a2|a3`) — see `MomentAnswer`. One per tool. */
  readonly answers: UpToThree<MomentAnswer>;
  /**
   * #746: the first question is the one the MCP engine asks itself every 15 minutes (`packages/mcp/src/server/site-examples.ts`,
   * the same tool and arguments): the moment then shows that LIVE answer (`LiveAsk`), and the recorded one is its fallback.
   * Never fuel and never a watch — the engine asks neither, by construction.
   */
  readonly live?: AskKey;
};

/**
 * One real answer to one example question (owner 2026-10-05: "add there also
 * responses", then "All example requests must have the right response! Not
 * only first."), asked of the production server mcp.viafrei.de with the
 * question's own tool and arguments, one call per question, read-only except
 * the three watches (which a session's end removes). The WORDS are copy, one
 * per language (`msg`); the figures and proper names are the answer's and live
 * here, the same in every language. `asOf` is the answer's own "Stand",
 * Europe/Berlin — for a fuel price the moment it was asked, the price's own
 * report time riding as `reported`. `credits` are the register lines of the
 * sources the quoted figures rest on (a place-resolution source the excerpt
 * does not quote is left out, as on /connect); they render verbatim and German.
 *
 * #746 (owner 2026-10-15, "restore every removed example"), ASKED OF PRODUCTION
 * (mcp.viafrei.de, serverInfo 2.1.23) on 2026-10-16 between 21:13 and 21:19
 * Europe/Berlin, one call per question, every call with `language: "de"`, the
 * raw answers kept outside the repository as the session's evidence. Every
 * question removed by v1.8.16 (7a58b520, the nine third questions and two fuel
 * requests) and v1.8.18 (55281d44, seven second questions) is back, so every
 * moment carries three again; the page budget that rotated them off is 500 KB
 * now (#742). Each answer below is the one production gave that evening, and
 * a sentence of the deck was rewritten in all seven languages wherever the
 * answer said something else than the old one (each entry says so). Three
 * changes of the questions themselves, each said again at its entry:
 *   - the Nürnberg diesel (driving q3 until v1.8.16) is a fuel request now: a
 *     Tankerkönig figure stands only in the fuel fold, never in a moment, so the
 *     driving moment asks a new third question of its own domain (the A2's
 *     roadworks over the weekend, `find_roadworks_ahead`);
 *   - the Fulda pharmacies are asked with today's schema (`find_poi {name, in,
 *     category}`) and the watches with `kind`/`key`;
 *   - the Hilden Supercharger is not in the first five fast chargers by
 *     Hilden any more, so it was asked with `limit: 10` (it is the tenth).
 *
 * Re-asked on 2026-11-02 (2.5.4) between about 13:58 and 14:23 Europe/Berlin, on
 * production, once per question, `language` "de", the same tools and arguments
 * (each entry names any deviation); every Stand is that day's, and each sentence
 * the answer no longer matched is rewritten in all 22 languages.
 * `test/example-freshness.test.ts` fails a recorded answer older than 14 days
 * against the real clock: the release re-asks them, never the build.
 *
 * Re-asked on 2026-11-18 between 14:28 and 14:31 Europe/Berlin, on production, once per question, `language`
 * "de", the same tools and arguments (the A2 weekend is 21./22.11.). Every answer whose sentence still holds took
 * that day's figures and Stand (the per-entry comments above still quote the 02.11 answers). Answers the sentence no
 * longer fitted (bus a2, station a1, driving a1, jam a1/a2) were reworded in all 22 languages to that day's answer (asked
 * 14:40-14:52); station a3 took ICE 706, the next ICE to leave. Asked again
 * 14:39-14:53 with up to five candidates each (the same board or road later, or another station or road): commute a2
 * moved to Leipzig Hbf and bus a3 to Dresden Hbf (the question's place name swapped in every language); the others
 * found none that fits its sentence. commute a1 now says "mehr als in der Stunde davor" (the region card's sentence).
 */
export type MomentAnswer = {
  readonly values: Readonly<Record<string, string>> & { readonly asOf: string };
  /** Proper names the answer carries, rendered `translate="no"` (#449). */
  readonly names: Readonly<Record<string, string>>;
  readonly credits: readonly string[];
  /** The first answer goes on (`day.moments.<key>.a1more`), shown at the top of the fold: the card shows a glance, not a wall. */
  readonly more?: true;
};

/** The deck key of a moment's answer to question `i` (1-based). */
export const answerKey = (m: Moment, i: 1 | 2 | 3): MessageKey => `day.moments.${m.key}.a${String(i)}` as MessageKey;

/** The deck key of a moment's question `i` (1-based). */
export const questionKey = (m: Moment, i: 1 | 2 | 3): MessageKey => `day.moments.${m.key}.q${String(i)}` as MessageKey;

const DB = ["db_timetables", "db_stada"] as const;
const OPENSTATION = ["db_stada", "mobilithek_openstation_netex", "mobilithek_openstation_siri_fm"] as const;
const BAST = ["mobilithek_roadworks_bast"] as const;
const FUEL = ["tankerkoenig"] as const;
const WATCH = ["viafrei_watch"] as const;

/**
 * "Ihr Tag mit ViaFrei" (#379, owner 2026-10-03, second ask; #430-#432 added jam,
 * places and watch on 2026-10-04): nine daily moments, in the order of a day.
 * Every question is answered by the named tool, and its answer is printed under it.
 */
export const MOMENTS: readonly Moment[] = [
  {
    key: "commute", sign: "stop", tile: "punctuality", live: "transit", tools: ["check_transit_disruption", "get_train_departures", "get_train_departures"],
    answers: [
      // check_transit_disruption {region: "Hamburg"}, 2026-11-02: "Hamburg: 4 % der beobachteten Fahrten mehr als 5 Minuten zu spät (120
      // von 2.770 Fahrten in den letzten 60 Minuten …) … Trend: etwa wie in den 60 Minuten davor (4 %)." Stand 13:58.
      { values: { share: "12", before: "8", asOf: "18.11.2026, 14:25" }, names: {}, credits: ["delfi_rt_tu"] },
      // get_train_departures {station: "Hannover Hbf"}, 2026-11-02: "14:03 S S2 → Haste, Gleis 1, +5 min (ca. 14:08) · 14:04 S S7 → Celle,
      // Gleis 14, pünktlich · 14:05 S S5 → Hannover Flughafen, +2 min …". Stand 14:03.
      // REPLACED 2026-11-18 (Hannover's first two were both late at 14:40 and 14:45): get_train_departures {station: "Leipzig Hbf"},
      // asked 14:40: "14:38 ICE 1559 → Dresden Hbf, ab Leipzig Hbf, Gleis 14, +11 min (ca. 14:49) · 14:42 S3 → Halle-Nietleben, ab Leipzig
      // Hbf (tief), Gleis 2, pünktlich". Stand 14:40. The question names Leipzig Hbf in every language.
      { values: { t1: "14:38", p1: "14", delay: "11", exp: "14:49", l2: "S3", t2: "14:42", asOf: "18.11.2026, 14:40" }, names: { l1: "ICE 1559", d1: "Dresden Hbf", d2: "Halle-Nietleben" }, credits: DB },
      // get_train_departures {station: "Köln Hbf", duration_min: 60}, 2026-11-02: ten departures shown (52 more), none cancelled, the
      // latest "14:14 S S11"; the largest delay "13:53 ICE 2857 → Nürnberg Hbf, Gleis 7 D-G, +20 min (ca. 14:13)". Stand 14:03. Reworded:
      // no platform change today, so the sentence names the largest delay.
      { values: { n: "10", last: "14:38", delay: "22", asOf: "18.11.2026, 14:28" }, names: { l1: "S11", d1: "Bergisch Gladbach" }, credits: DB },
    ],
  },
  {
    key: "bus", sign: "stop", tile: null, pending: "transit", tools: ["find_nearby", "get_train_departures", "get_train_departures"],
    answers: [
      // find_nearby {place: "Kölner Dom", categories: ["station"]}, 2026-11-02: resolved to "Dom, Köln"; "Bahnhöfe: Köln Hbf; Köln
      // Hansaring; Köln Messe/Deutz" — this answer carries coordinates only, so the 0,2 km is computed from them (Köln Hbf to the Dom).
      // Stand 14:03.
      { values: { km: "0", kmd: "2", asOf: "18.11.2026, 14:28" }, names: { s1: "Köln Hbf", s2: "Köln Hansaring", s3: "Köln Messe/Deutz" }, credits: ["db_stada"] },
      // get_train_departures {station: "Frankfurt (Main) Hauptwache"}, 2026-11-02: "14:05 S S3 → Bad Soden (Taunus), Gleis 3, pünktlich · …
      // 14:11 S S3 → Frankfurt (Main) Süd, Gleis 2, +1 min (ca. 14:12)" — every other one on time. Stand 14:03. Reworded: the next one is
      // on time, a later one is a minute late.
      // 2026-11-18, asked 14:45: "14:38 S1 → Frankfurt-Höchst, Gleis 3, +12 min (ca. 14:50) · 14:44 S2 → Dietzenbach Bahnhof, Gleis 2,
      // +13 min (ca. 14:57)" — the rest of the board late as well. Stand 14:45. Reworded: the next two are both late.
      { values: { l1: "S1", t1: "14:38", p1: "3", delay1: "12", exp1: "14:50", l2: "S2", delay2: "13", exp2: "14:57", asOf: "18.11.2026, 14:45" }, names: { d1: "Frankfurt-Höchst", d2: "Dietzenbach Bahnhof" }, credits: DB },
      // get_train_departures {station: "Leipzig Hbf"}, 2026-11-02: of ten departures, "14:06 S S6 → Naumburg (Saale) Hbf, Gleis 7, +13 min"
      // and "14:12 ICE 508 → Hamburg-Altona, Gleis 11, +2 min"; the other eight "pünktlich", no platform change. Stand 14:03.
      // REPLACED 2026-11-18 (Leipzig had three and six late at 14:40 and 14:45): get_train_departures {station: "Dresden Hbf"}, asked
      // 14:51: "14:53 RJ 176 → Hamburg-Altona, Gleis 3, +3 min (ca. 14:56) · 14:59 S1 → Bad Schandau, Gleis 13, +1 min (ca. 15:00)"; the
      // other eight of the ten "pünktlich". Stand 14:51. The question names Dresden's main station in every language.
      { values: { l1: "RJ 176", dl1: "3", p1: "3", l2: "S1", dl2: "1", n: "8", asOf: "18.11.2026, 14:51" }, names: { d1: "Hamburg-Altona", d2: "Bad Schandau" }, credits: DB },
    ],
  },
  {
    key: "station", sign: "train", tile: "lifts", extra: "station", tools: ["check_station_facilities", "check_station_facilities", "get_train_departures"],
    answers: [
      // check_station_facilities {station: "Köln Hbf", facility: "elevator"}, 2026-11-02: 8 lifts, 6 in Betrieb, 1 außer Betrieb (zu Gleis
      // 8/9, Anlage 10801910), 1 without status (zu Gleis 8/9, Anlage 10849189, "wird nicht überwacht"). Stand 13:44. Reworded: one is out
      // of service now.
      // 2026-11-18, asked 14:40: 8 lifts, 7 in Betrieb, none außer Betrieb, 1 without status (zu Gleis 8/9, Anlage 10849189, "wird nicht
      // überwacht"). Stand 14:38. Reworded: none is out of service.
      { values: { working: "7", total: "8", asOf: "18.11.2026, 14:38" }, names: { station: "Köln Hbf" }, credits: OPENSTATION },
      // check_station_facilities {station: "Erlangen", facility: "elevator"}, 2026-11-02: "Aufzug zu Gleis 2/3: in Betrieb". Stand 13:44.
      { values: { platforms: "2/3", asOf: "18.11.2026, 14:17" }, names: { station: "Erlangen" }, credits: OPENSTATION },
      // get_train_departures {station: "Nürnberg Hbf", duration_min: 120, categories: ["ICE"]}, 2026-11-02: "14:05 ICE 506 → Kiel Hbf,
      // Gleis 6, pünktlich". Stand 14:03.
      // 2026-11-18, asked 14:46: "13:29 ICE 1007 → München Hbf, Gleis 8, +137 min (ca. 15:46) · 15:04 ICE 706 → Hamburg-Altona, Gleis 7,
      // pünktlich · 15:29 ICE 1009 fällt aus". Stand 14:46. The next ICE to leave is ICE 706; the sentence holds as written.
      { values: { t: "15:04", p: "7", asOf: "18.11.2026, 14:46" }, names: { train: "ICE 706", dest: "Hamburg-Altona" }, credits: DB },
    ],
  },
  {
    key: "driving", sign: "autobahn", tile: "reports", extra: "fuel", live: "roads", tools: ["check_autobahn_traffic", "find_roadworks_ahead", "find_roadworks_ahead"],
    answers: [
      // check_autobahn_traffic {roads: ["A8"]}, 2026-11-02: "A8: 0 Staus, 1 Warnmeldung, 3 Sperrungen, 61 Baustellen" — Stand 14:01 — and
      // the police message "A8 Stuttgart Richtung München zwischen Günzburg (67) und Burgau (69): Unfall, Gefahr durch Personen auf der
      // Fahrbahn, Standstreifen blockiert" (since 13:19). Reworded: towards München, an accident.
      // 2026-11-18, asked 14:40: "A8: 3 Staus, 3 Sperrungen, 71 Baustellen" — the jams Karlsruhe -> Stuttgart, München -> Salzburg and
      // München -> Stuttgart, none towards München, no police message. Stand 14:39. Reworded: nothing reported towards München.
      { values: { jams: "3", closures: "3", works: "71", asOf: "18.11.2026, 14:39" }, names: {}, credits: ["autobahn"], more: true },
      // find_roadworks_ahead {road: "A7"}, 2026-11-02: "A7: 92 Arbeitsstellen laut BASt zwischen 02.11.2026 und 09.11.2026: 49 laufend …
      // • Baustelle: A7 zw. Hammelburg → Bad Kissingen/Oberthulba 1,0 km (+3 weitere Abschnitte) — Brückenneubau, 1 von 3 Fahrstreifen
      // gesperrt, Tempo 80 — bis 30.09.2027". The BASt data's Stand: 12:27.
      { values: { count: "99", to: "25.11.2026", speed: "80", until: "30.09.2027", asOf: "18.11.2026, 14:20" }, names: { a: "Hammelburg", b: "Bad Kissingen/Oberthulba" }, credits: BAST },
      // find_roadworks_ahead {road: "A2", from: "2026-11-07", to: "2026-11-08", limit: 1} (asked with limit 1), 2026-11-02: "A2: 25
      // Arbeitsstellen laut BASt zwischen 07.11.2026 und 08.11.2026: 22 laufend … • A2, Dortmund-Nordost, Rampe 0,2 km — Erneuerung an der
      // Tragschicht/Oberbau, voll gesperrt (1 von 1 Fahrstreifen), bis 04.03.2027". Stand 12:27. Reworded: a ramp at one junction.
      { values: { count: "22", from: "21.11.2026", to: "22.11.2026", until: "04.03.2027", asOf: "18.11.2026, 14:20" }, names: { a: "Dortmund-Nordost" }, credits: BAST },
    ],
  },
  // #430: jams incl. the motorways inside the cities — city streets are not in the
  // open data yet (#427 requests them), and the limit line says so. #520: the
  // moment's live tile is the jams the police report now in the ten largest
  // cities, counted as check_road_status {place} counts them.
  {
    key: "jam", sign: "autobahn", tile: "jams", tools: ["check_autobahn_traffic", "check_autobahn_traffic", "check_road_status"],
    answers: [
      // check_autobahn_traffic {roads: ["A3"]}, 2026-11-02: "A3: 4 Staus, 6 Warnmeldungen, 4 Sperrungen, 99 Baustellen" — Stand 14:01 —
      // "• Stau: A3 | Hanau - Offenbacher Kreuz · Würzburg -> Frankfurt, seit 12:23, +60 min, 8,7 km, im Stillstand", and the police: an
      // accident at the Offenbacher Kreuz. Reworded: the A3 towards Frankfurt is jammed now.
      // 2026-11-18, asked 14:52: "A3: 5 Staus, 3 Warnmeldungen, 6 Sperrungen, 103 Baustellen" — "Stau: A3 | Kohlsberg-Nord - Marktheidenfeld
      // · Frankfurt -> Würzburg, ca. 3,3 km, seit 14:31, +41 min", no accident named. Stand 14:50. Reworded: towards Würzburg, no accident.
      { values: { jams: "5", delay: "41", closures: "6", works: "103", asOf: "18.11.2026, 14:50" }, names: { a: "Kohlsberg-Nord", b: "Marktheidenfeld" }, credits: ["autobahn"], more: true },
      // check_autobahn_traffic {roads: ["A1", "A3", "A4"]}, 2026-11-02: counts.jams 9 (A1 3, A3 4, A4 2) — "• Stockender Verkehr: A4 |
      // Köln-West - Köln-Eifeltor · Heerlen/Aachen -> Köln, +4 min, 4,2 km". Stand 14:01. Reworded: there is one at Köln now.
      // 2026-11-18, asked 14:40: counts.jams 15, and the police message "A4 Heerlen/Aachen Richtung Köln zwischen Kreuz Köln-West und
      // Köln-Eifeltor 4 km Stau". Stand 14:39. Reworded: the police report the jam.
      { values: { km: "4", n: "15", asOf: "18.11.2026, 14:39" }, names: { a: "Köln-West", b: "Köln-Eifeltor" }, credits: ["autobahn", "mobilithek_nms_events"] },
      // check_road_status {road: "A7", horizon_days: 1, limit: 11}, 2026-11-02: "A7: 21 Sperrungen … • Sperrung: A7, AS HH-Volkspark - AS
      // HH-Othmarschen, achtstreifige Erweiterung und Neubau Altonatunnel" (this phase to 31.10.27). Stand 14:01.
      { values: { n: "14", asOf: "18.11.2026, 14:28" }, names: { a: "HH-Volkspark", b: "HH-Othmarschen", tunnel: "Altonatunnel" }, credits: ["autobahn"] },
    ],
  },
  {
    key: "parking", sign: "parking", tile: "lorry", extra: "carparks", live: "parking", tools: ["find_parking", "find_parking", "find_parking"],
    answers: [
      // find_parking {place: "Köln Hbf", kind: "car_park"}, 2026-11-02 14:06: "Am Dom — Parkhaus, 0,3 km, 220 Plätze, 12 frei · Philharmonie —
      // Parkhaus, 0,3 km, 459 Plätze, 353 frei", both published 13:48 and flagged as no longer current (the Köln feed was last read 13:49),
      // the other two rows a closed car park and one from the day before. Reworded: "zuletzt … gemeldet"; `asOf` is their Stand.
      { values: { f1: "9", t1: "220", f2: "260", t2: "459", asOf: "18.11.2026, 14:18" }, names: { p1: "Am Dom", p2: "Philharmonie" }, credits: ["mobilithek_park_koeln_static", "mobilithek_park_koeln_dyn"] },
      // find_parking {road: "A9", kind: "truck"}, 2026-11-02: "1. 24-TOTAL Autohof Leipzig Flughafen — Lkw-Parkplatz, davon 151 für Lkw,
      // keine Belegungsdaten veröffentlicht 2. Aral Autohof Bad Berneck — davon 120 für Lkw 3. Aral Autohof Zorbau — davon 56 für Lkw".
      // Stand 14:05.
      { values: { n1: "151", n2: "120", n3: "56", asOf: "18.11.2026, 14:29" }, names: { p1: "24-TOTAL Autohof Leipzig Flughafen", p2: "Aral Autohof Bad Berneck", p3: "Aral Autohof Zorbau" }, credits: ["mobilithek_truckpark_static_geonutzv"] },
      // find_parking {place: "Essen Hbf", kind: "park_and_ride"}, 2026-11-02: "— aus P+R NRW (CC BY-SA), separat geführt … 1. Essen West S —
      // P+R, 2,5 km, Belegung übernehmen wir nicht 2. Essen Frohnhausen S — P+R, 3,5 km …". Stand 14:05.
      { values: { k1: "2", k1d: "5", k2: "3", k2d: "5", asOf: "18.11.2026, 14:29" }, names: { p1: "Essen West S", p2: "Essen Frohnhausen S" }, credits: ["mobilithek_park_nrw_pr"] },
    ],
  },
  {
    key: "charging", sign: "charging", tile: "charging", live: "charging", tools: ["find_charging_station", "find_charging_station", "find_charging_station"],
    answers: [
      // find_charging_station {place: "Leipzig", min_power_kw: 150}, 2026-11-02: "1. JOLT LEJ00440, Leplaystraße 9, 04103 Leipzig — 0,4 km,
      // bis 300 kW, Status vom 31.10. … 2. Friedrich-Ebert-Str. 51, 04109 Leipzig (Stadtwerke Leipzig GmbH) — 1,1 km, CCS2, bis 170 kW,
      // keine Statusdaten, laut Ladesäulenregister". Stand 14:09. Reworded: "zum Beispiel", since it is not the nearest any more.
      { values: { kw: "170", asOf: "18.11.2026, 14:13" }, names: { site: "Stadtwerke Leipzig GmbH", address: "Friedrich-Ebert-Str. 51, 04109 Leipzig" }, credits: ["bnetza_lsr"], more: true },
      // find_charging_station {place: "Ingolstadt", min_power_kw: 150}, 2026-11-02: "1. Hallenbad Parkplatz - öffentlicher Ladepunkt,
      // Jahnstraße  0, 85049 Ingolstadt (Stadtwerke Ingolstadt Beteiligungen GmbH) — CCS2, bis 150 kW, 4 von 4 frei (Stand 14:08) … Eviny
      // Germany Ingolstadt Frühlingsstraße, Frühlingstraße 31, 85055 Ingolstadt (Eviny) — bis 400 kW, … möglicherweise veraltet". Stand 14:08.
      { values: { kw1: "150", free1: "4", total1: "4", kw2: "400", asOf: "18.11.2026, 14:29" }, names: { op1: "Stadtwerke Ingolstadt Beteiligungen GmbH", a1: "Jahnstraße 0, 85049 Ingolstadt", s2: "Eviny Germany Ingolstadt Frühlingsstraße", a2: "Frühlingstraße 31, 85055 Ingolstadt" }, credits: ["mobilithek_afir_chargecloud_stat", "ocpdb_chargecloud", "mobilithek_afir_ecomovement", "mobilithek_afir_ecomovement_dyn"] },
      // find_charging_station {place: "Hilden", min_power_kw: 150, limit: 10}, 2026-11-02: "10. Hilden, Germany, Nordpark 2-4, 40724 Hilden
      // (Tesla, Inc.) — CCS2, bis 250 kW, Status vom 01.11. 14:56 — möglicherweise veraltet". Stand 14:09. Reworded: the status is from the
      // day before, so the sentence carries its date.
      { values: { kw: "250", t: "16.11., 22:15", asOf: "18.11.2026, 14:29" }, names: { brand: "Tesla", address: "Nordpark 2-4, 40724 Hilden" }, credits: ["mobilithek_afir_tesla_stat", "mobilithek_afir_tesla_dyn"] },
    ],
  },
  // #431: a thing by its NAME to its address, and a coordinate back to words.
  {
    key: "places", sign: "info", tile: null, tools: ["describe_location", "find_poi", "find_poi"],
    answers: [
      // describe_location {lat: 50.1109, lon: 8.6821}, 2026-11-02: "Nächste Adresse: Braubachstraße 41, 60311 Frankfurt am Main (10 m) …
      // Anschlussstelle: Frankfurt-Miquelallee (2,9 km)". Stand 14:09, address data 2026-10-06.
      { values: { m: "10", km: "2", kmd: "9", asOf: "18.11.2026, 14:29" }, names: { address: "Braubachstraße 41, 60311 Frankfurt am Main", junction: "Frankfurt-Miquelallee" }, credits: ["osm"] },
      // find_poi {name: "Apotheke", in: "Fulda", category: "healthcare"}, 2026-11-02: "1. Löwen Apotheke — Unterm Heilig Kreuz 9, 36037
      // Fulda 2. Apotheke am Heertor — Rabanusstraße 1a, 36037 Fulda 3. Altstadt Apotheke — Robert-Kircher-Straße 9, 36037 Fulda". OSM
      // data 2026-10-06; Stand 14:09.
      { values: { osm: "27.10.2026", asOf: "18.11.2026, 14:29" }, names: { p1: "Löwen Apotheke", a1: "Unterm Heilig Kreuz 9, 36037 Fulda", p2: "Apotheke am Heertor", a2: "Rabanusstraße 1a, 36037 Fulda", p3: "Altstadt Apotheke", a3: "Robert-Kircher-Straße 9, 36037 Fulda" }, credits: ["osm"] },
      // find_poi {name: "Elbphilharmonie", in: "Hamburg"}, 2026-11-02: "1. Elbphilharmonie — Theater, Platz der Deutschen Einheit 1, 20457
      // Hamburg". OSM data 2026-10-06; Stand 14:09.
      { values: { osm: "27.10.2026", asOf: "18.11.2026, 14:29" }, names: { poi: "Elbphilharmonie", address: "Platz der Deutschen Einheit 1, 20457 Hamburg" }, credits: ["osm"] },
    ],
  },
  // #432: what a watch can report — a closure lifted on a road, a region's late share crossing a
  // threshold, a DWD warning. The answers are the confirmations watch_situation returned on production
  // (2026-11-02, 14:09-14:10; each watch stopped again with stop_watch right after), asked with the
  // `kind`/`key` schema: the A7 with condition {event: "reopen"}, the region by its AGS 05315 (Köln) with
  // {late_share: 0.25}, the weather by the place name "Köln", which the server resolved to the DWD warn cell
  // 705315101 (Köln-Innenstadt). A watch runs three hours now. Never asked by the site's engine: a watch is a write.
  {
    key: "watch", sign: "warning", tile: null, tools: ["watch_situation", "watch_situation", "watch_situation"],
    answers: [
      // "Ich beobachte die Straße A7 und melde mich hier. Bedingung: nur wenn eine Sperrung oder Einschränkung aufgehoben wird. Läuft bis
      // 02.11. 17:09. 1 von 10 Beobachtungen dieser Sitzung belegt."
      { values: { road: "A7", until: "18.11., 17:29", used: "1", asOf: "18.11.2026, 14:29" }, names: {}, credits: WATCH },
      // "Ich beobachte die Region 05315 und melde mich hier. Bedingung: mindestens 25 % der beobachteten Fahrten mit 5 Minuten Verspätung
      // oder mehr, bei mindestens 10 Fahrten. Läuft bis 02.11. 17:10."
      { values: { ags: "05315", pct: "25", until: "18.11., 17:29", asOf: "18.11.2026, 14:29" }, names: { city: "Köln" }, credits: WATCH },
      // "Ich beobachte die Wetterlage für 705315101 und melde mich hier. Aus "Köln" aufgelöst: Warnzelle 705315101 (Köln-Innenstadt).
      // Bedingung: amtliche DWD-Warnungen ab Warnstufe 2. Läuft bis 02.11. 17:10." Credited to the DWD as well: the cell is the DWD's.
      { values: { cell: "705315101", until: "18.11., 17:29", asOf: "18.11.2026, 14:29" }, names: { city: "Köln-Innenstadt" }, credits: [...WATCH, "dwd"] },
    ],
  },
];

/**
 * The example requests under the fuel tile (owner 2026-10-05: "add some
 * request/reasons"): what a driver asks, a short reason why it is worth
 * asking, and production's answer.
 *
 * #746: all four asked of production on 2026-10-16 between 21:15:39 and 21:15:44
 * Europe/Berlin, ONCE each and never in a loop — Tankerkönig is asked only on a
 * person's request, and this one-off ask for the site is that (owner 2026-10-15).
 * Görlitz had current prices; München, Leipzig and Nürnberg had none from the last
 * 30 minutes, so the tool named the last known ones with their times, unranked,
 * and asked for new ones — and the answers say exactly that. Every REASON is now a
 * reading of the answer itself, not of a watch list (the fuel worker keeps none
 * since #712): the spread between the stations it listed. Görlitz, München and
 * Leipzig came back from v1.8.16's rotation; Nürnberg was the driving moment's
 * third question until then, and is a fuel request here because a Tankerkönig
 * figure stands only in this fold.
 *
 * Re-asked on 2026-11-02 at 14:10 Europe/Berlin (2.5.4), again ONCE each: now
 * Nürnberg had current prices and Görlitz, München and Leipzig had none from the
 * last 30 minutes, so Görlitz takes the "no new price yet" sentence and Nürnberg
 * the current one (each entry says so). Consumer information only (MTS-K), with
 * the Tankerkönig line.
 *
 * Re-asked on 2026-11-18 at 14:29 Europe/Berlin, ONCE each: Görlitz had a current price again and Nürnberg none,
 * so the two swap sentences back. Leipzig's lowest last-known price was at a station named "Access", a word the
 * JSON-LD guard of #531 finds in every page's JSON-LD, so the first re-ask left Leipzig at its 02.11 answer.
 * Asked again at 14:41-14:46: Leipzig (twice) and Dresden had current prices, so the "no new price" sentence does
 * not hold; Leipzig takes Görlitz's current-price sentence and why, and Greenline's answer.
 */
export type FuelAskKey = "goerlitz" | "muenchen" | "leipzig" | "nuernberg";
export type FuelAsk = { readonly key: FuelAskKey; readonly tool: "find_cheapest_fuel"; readonly answer: MomentAnswer };

/** One fuel request under the fuel tile: find_cheapest_fuel's answer (price euro,cent; when reported; the Stand) at a station, credited to Tankerkönig. */
const fuelAsk = (key: FuelAskKey, euro: string, cent: string, reported: string, asOf: string, station: string, address: string): FuelAsk => ({
  key,
  tool: "find_cheapest_fuel",
  answer: { values: { euro, cent, reported, asOf }, names: { station, address }, credits: FUEL },
});

export const FUEL_ASKS: readonly FuelAsk[] = [
  fuelAsk(
    "goerlitz",
    // find_cheapest_fuel {place: "Görlitz", fuel: "diesel"}, asked ONCE 2026-11-02 14:10: no price from the last 30 minutes — "zuletzt
    // bekannte Preise … TotalEnergies, Bahnhofstr. 68-72, 02826 Goerlitz — 2,179 €/l … (Preis von 23.10. 21:36) — neuer Preis wird gerade
    // abgefragt". 2026-11-18 14:29: a current price, reported 14:29, so the current-price sentence holds.
    "2", "319", "14:29", "18.11.2026, 14:29",
    "TotalEnergies", "Bahnhofstr. 68-72, 02826 Goerlitz",
  ),
  fuelAsk(
    "muenchen",
    // find_cheapest_fuel {place: "München", fuel: "e10"}, asked ONCE 2026-11-02 14:10: "kein Preis aus den letzten 30 Minuten — zuletzt
    // bekannte Preise, je mit Uhrzeit, nicht nach Preis gerankt … Aral, Schwere-Reiter-Straße 26b, 80797 München — 1,929 €/l … (Preis von
    // 02.11. 07:34)"; the five listed span 1,929 to 1,999 €/l.
    "1", "789", "17.11., 23:22", "18.11.2026, 14:29",
    "AVIA", "Hochstr. 5, 81669 München",
  ),
  fuelAsk(
    "leipzig",
    // find_cheapest_fuel {place: "Leipzig", fuel: "e5"}, asked ONCE 2026-11-02 14:10: "kein Preis aus den letzten 30 Minuten … OIL!,
    // Wittenberger Straße 7, 04129 Leipzig — 1,999 €/l … (Preis von 02.11. 09:28)" — the lowest of the five.
    // Asked again 2026-11-18 14:45: current prices, ranked — "1. Greenline, Mockauer Str. 117, 04357 Leipzig — 2,058 €/l, 4,6 km,
    // zuletzt offen (Stand 14:31)". The "no new price" sentence no longer holds, so the request takes Görlitz's current-price
    // sentence and its why (in every language).
    "2", "058", "14:31", "18.11.2026, 14:45",
    "Greenline", "Mockauer Str. 117, 04357 Leipzig",
  ),
  fuelAsk(
    "nuernberg",
    // find_cheapest_fuel {place: "Nürnberg", fuel: "diesel"}, asked ONCE 2026-11-02 14:10: current prices, ranked — "1. HEM, Rothenburger
    // Str. 325, 90431 Nürnberg — 2,259 €/l, 3,6 km (Stand 14:05) 2. SUPOL, Gibitzenhofstr. 172 — 2,269 €/l, 2,5 km". Reworded: a current
    // price (the Görlitz shape of 2026-10-16); the nearer station is the dearer one.
    "2", "349", "16.11., 12:44", "18.11.2026, 14:29",
    "AVIA", "Adlerstrasse 4, 90403 Nürnberg",
  ),
];

/**
 * The fuel requests the home renders: those `RETIRED_FUEL` does not hold off (data-steward Verdict 2, at
 * most three Tankerkönig examples on the whole site — Görlitz here, Köln and Würzburg on /connect).
 */
export const HOME_FUEL_ASKS: readonly FuelAsk[] = FUEL_ASKS.filter((f) => !isRetired(`fuel:${f.key}`));

/** The traffic signs each tool group's panel carries (owner 2026-10-05). */
export const TOOL_GROUP_SIGNS: Readonly<Record<keyof typeof TOOL_GROUPS, readonly SignKind[]>> = {
  roads: ["autobahn"],
  rail: ["train"],
  transit: ["stop"],
  energy: ["charging", "fuel"],
  places: ["info"],
  rules: ["warning"],
};

/** The tool catalogue by domain. Every tool the server serves is in exactly one group — held equal to `src/generated/catalogue.json` by `test/moment-answers.test.ts`. */
export const TOOL_GROUPS: Readonly<Record<"roads" | "rail" | "transit" | "energy" | "places" | "rules", readonly string[]>> = {
  roads: ["check_autobahn_traffic", "check_road_status", "find_roadworks_ahead", "find_parking", "watch_situation", "stop_watch"],
  rail: ["get_train_departures", "check_station_facilities", "describe_station"],
  transit: ["get_departures", "check_transit_disruption", "find_sharing"],
  energy: ["find_charging_station", "find_cheapest_fuel", "find_fuel_station", "find_hydrogen_station"],
  places: ["find_place", "find_address", "find_nearby", "find_poi", "describe_location"],
  rules: ["get_driving_rules", "check_weather_warnings", "find_speed_cameras"],
};
