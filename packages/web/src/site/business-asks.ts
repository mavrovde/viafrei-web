/**
 * In the archive since 2.5.15 (owner 2026-10-15: "archived, never deleted"): the business page's six typed questions and
 * their recorded answers, taken off that page by #992 and restored here from git; `site/example-archive.ts` lists them.
 *
 * What production answered to the business page's six example questions
 * (owner 2026-10-05: "All example requests must have the right response! Not
 * only first."), asked of mcp.viafrei.de (v1.8.3) on 2026-10-05 between 23:41
 * and 23:43 Europe/Berlin, one call per question; the words are
 * `bizPage.u<n>a` in the deck, the shape `MomentAnswer`'s.
 *
 * Four questions were REPHRASED to what production answers today rather than
 * printed bare: `check_road_status` takes a road OR a place, never both, and a
 * place answers every road through it end to end (Augsburg answered the whole
 * A8, München to Neunkirchen), so the A7 question names the stretch the answer
 * lists (Würzburg–Ulm, not Hamburg–Hannover) and the A8 question asks the road;
 * `find_roadworks_ahead` takes dates, not places, so the A3 question asks the
 * coming days; "what do guests need to know" became the weather warning the
 * answer gives; and the punctuality of a Land is no tool's answer
 * (`check_transit_disruption` timed out for Nordrhein-Westfalen and for a
 * Düsseldorf coordinate), so the public-bodies case asks for Köln's warnings.
 */
import type { MessageKey } from "../i18n/index.js";
import type { MomentAnswer } from "./examples.js";

export type BusinessAsk = {
  readonly n: 1 | 2 | 3 | 4 | 5 | 6;
  readonly tool: string;
  readonly answerKey: MessageKey;
  readonly answer: MomentAnswer;
};

export const BUSINESS_ASKS: readonly BusinessAsk[] = [
  {
    n: 1,
    tool: "check_road_status",
    answerKey: "bizPage.u1a",
    // check_road_status {road: "A7"}: "A7: 36 Sperrungen, 344 Einschränkungen … Zeitraum bis 08.10.2026. • Sperrung: A7 | Dinkelsbühl/Fichtenau
    // - Aalen/Westhausen · Würzburg -> Ulm … • Sperrung: A7 | Aalen/Westhausen - Aalen/Oberkochen · Würzburg -> Ulm …". Stand 21:27.
    answer: { values: { n: "36", to: "08.10.2026", asOf: "05.10.2026, 21:27" }, names: { a: "Dinkelsbühl/Fichtenau", b: "Aalen/Westhausen", c: "Aalen/Oberkochen" }, credits: ["autobahn", "mobilithek_roadworks_bast"] },
  },
  {
    n: 2,
    tool: "find_charging_station",
    answerKey: "bizPage.u2a",
    // find_charging_station {place: "Kassel", min_power_kw: 150}: "1. Kassel, Germany - Zentrum, Neue Fahrt 9, 34117 Kassel (Tesla, Inc.) —
    // 0,2 km, CCS2, bis 250 kW, … 5 von 6 frei, 6 ohne Status (Stand 22:51) 2. Circle K I Kassel Leipziger Strasse 22, Leipziger Strasse 22,
    // 34125 Kassel (Spirii) — 1,2 km, CCS2, bis 400 kW, … keine Statusdaten". Stand 22:51.
    answer: { values: { m: "200", kw1: "250", free: "5", total: "6", kw2: "400", asOf: "05.10.2026, 22:51" }, names: { s1: "Tesla", a1: "Neue Fahrt 9, 34117 Kassel", s2: "Circle K", a2: "Leipziger Strasse 22, 34125 Kassel" }, credits: ["mobilithek_afir_tesla_stat", "mobilithek_afir_tesla_dyn", "mobilithek_afir_ecomovement"] },
  },
  {
    n: 3,
    tool: "check_weather_warnings",
    answerKey: "bizPage.u3a",
    // check_weather_warnings {place: "Garmisch-Partenkirchen"}: "Für Garmisch-Partenkirchen (09180117) liegt derzeit keine amtliche Wetterwarnung
    // des DWD vor (geprüft für jetzt und die nächsten 24 Stunden). Das ist keine Entwarnung für die weitere Strecke …". Stand 23:41.
    answer: { values: { hours: "24", asOf: "05.10.2026, 23:41" }, names: { place: "Garmisch-Partenkirchen" }, credits: ["dwd"] },
  },
  {
    n: 4,
    tool: "find_roadworks_ahead",
    answerKey: "bizPage.u4a",
    // find_roadworks_ahead {road: "A3", from: "2026-10-06", to: "2026-10-12"}: "A3: 37 geplante Arbeitsstellen zwischen 06.10.2026 und 12.10.2026 …
    // • Instandsetzung: A3 zw. Raunheim → Wiesbaden/Niedernhausen 8,116 km … 1 von 4 Fahrstreifen gesperrt, Tempo 80 — 14.08.2023 bis 15.12.2026". Stand 21:27.
    answer: { values: { from: "06.10.2026", to: "12.10.2026", n: "37", speed: "80", until: "15.12.2026", asOf: "05.10.2026, 21:27" }, names: { a: "Raunheim", b: "Wiesbaden/Niedernhausen" }, credits: ["mobilithek_roadworks_bast"] },
  },
  {
    n: 5,
    tool: "check_road_status",
    answerKey: "bizPage.u5a",
    // check_road_status {road: "A8"}: "A8: 32 Sperrungen, 190 Einschränkungen … Zeitraum bis 08.10.2026. • Sperrung: A8 | München-Süd - Sauerlach ·
    // Kreuz München-Süd -> München … • Sperrung: A8-A81 Leonberg-Ost - Fahrbahninstandsetzung …". Stand 21:27.
    answer: { values: { n: "32", to: "08.10.2026", asOf: "05.10.2026, 21:27" }, names: { a: "München-Süd", b: "Sauerlach", c: "Leonberg-Ost" }, credits: ["autobahn"] },
  },
  {
    n: 6,
    tool: "check_weather_warnings",
    answerKey: "bizPage.u6a",
    // check_weather_warnings {place: "Köln"}: "Für Köln (05315000) liegt derzeit keine amtliche Wetterwarnung des DWD vor (geprüft für jetzt und die
    // nächsten 24 Stunden)." Stand 23:42.
    answer: { values: { hours: "24", asOf: "05.10.2026, 23:42" }, names: { place: "Köln" }, credits: ["dwd"] },
  },
];
