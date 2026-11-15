/**
 * The five example questions of the connect page (#142 item 1), in the order
 * transit, parking, charging first (owner 2026-10-03, #379).
 *
 * This file binds each question to the tool that answers it — an identifier,
 * not copy. The QUESTION is copy and lives in the deck
 * (`connectPage.asks.<key>`), so every page asks in its own language (#449:
 * the five used to be typed here as literals, three German and two English,
 * and every language's page printed them unchanged).
 *
 * The eval corpus holds German and English prompts only, so for those two
 * languages the deck's question must be a golden prompt quoted byte for byte
 * from `evals/prompts/<tool>.yaml` — the file of the tool it names, with that
 * `expect_tool` and that `lang`, the rule `evals/run.ts` scores by.
 * `test/pages-content.test.ts` fails otherwise, so those pages can only
 * promise what the eval suite grades; the other languages carry a
 * translation of the German question, naming places as that language does
 * (Кёльн, Münih, Dresda — the exonyms of #449, as on the home).
 */
import type { MessageKey } from "../i18n/index.js";
import type { MomentAnswer } from "./examples.js";

/**
 * Each question carries what production answered to it (owner 2026-10-05:
 * "All example requests must have the right response! Not only first."),
 * asked of mcp.viafrei.de on 2026-10-05 between 23:24 and 23:25 Europe/Berlin
 * (v1.8.2), one call per question with the arguments it implies; the words
 * are `connectPage.askAnswers.<key>` in the deck, the shape `MomentAnswer`'s.
 */
export type ConnectPrompt = {
  readonly tool: string;
  readonly key: MessageKey;
  readonly answerKey: MessageKey;
  /** The answer to the GERMAN question, which ru, uk, bg, ro and tr translate. */
  readonly answer: MomentAnswer;
  /**
   * The answer to the ENGLISH question, which is a different golden prompt (the
   * eval corpus grades en on its own prompts, `test/pages-content.test.ts`), asked
   * of production on its own between 23:31 and 23:32 with `language: "en"`.
   */
  readonly answerEn: MomentAnswer;
};

/** The answer a page in `lang` prints under the question it asks. */
export const answerFor = (p: ConnectPrompt, lang: string): MomentAnswer => (lang === "en" ? p.answerEn : p.answer);

export const CONNECT_PROMPTS: readonly ConnectPrompt[] = [
  {
    tool: "get_train_departures",
    key: "connectPage.asks.train",
    answerKey: "connectPage.askAnswers.train",
    // get_train_departures {station: "Köln Hbf", limit: 5}: "23:25 RB RB27 → Grevenbroich, Gleis 8 D-G, pünktlich
    // 23:29 RB RB38 → Bedburg(Erft), Gleis 7 D-G, pünktlich …". Stand 23:24.
    answer: { values: { l1: "RB27", t1: "23:25", l2: "RB38", t2: "23:29", asOf: "05.10.2026, 23:24" }, names: { d1: "Grevenbroich", p1: "8 D-G", d2: "Bedburg(Erft)", p2: "7 D-G" }, credits: ["db_timetables", "db_stada"] },
    // en "Next departures from Cologne main station, please." — get_train_departures {station: "Köln Hbf", limit: 5, language: "en"}:
    // "23:37 RB RB25 → Köln Hansaring, platform 11 B-C, on time 23:37 S S6 → Köln-Dellbrück, platform 10 A-B, on time". As of 23:31.
    answerEn: { values: { l1: "RB25", t1: "23:37", l2: "S6", t2: "23:37", asOf: "05.10.2026, 23:31" }, names: { d1: "Köln Hansaring", p1: "11 B-C", d2: "Köln-Dellbrück", p2: "10 A-B" }, credits: ["db_timetables", "db_stada"] },
  },
  {
    tool: "find_parking",
    key: "connectPage.asks.parking",
    answerKey: "connectPage.askAnswers.parking",
    // find_parking {place: "Köln Innenstadt", kind: "car_park"}: "1. An Farina — Parkhaus, 36 m, 160 Plätze, 146 frei (Stand 23:18)
    // 2. Brückenstraße — Parkhaus, 0,1 km, 531 Plätze, 492 frei (Stand 23:18)". Stand 23:18.
    answer: { values: { f1: "146", t1: "160", f2: "492", t2: "531", asOf: "05.10.2026, 23:18" }, names: { p1: "An Farina", p2: "Brückenstraße" }, credits: ["mobilithek_park_koeln_static", "mobilithek_park_koeln_dyn"] },
    // en "Where can I leave the car near Freiburg station? Answer in English." (the en prompt until 2026-10-05, "Is there a park
    // and ride near Freiburg?", got "none of them is recorded as a Park and ride", so the page asks the other golden prompt) —
    // find_parking {place: "Freiburg Hbf", language: "en"}: "1. Schauinsland W — Lorry parking, 6.8 km, 12 lorry spaces … 2. Schauinsland —
    // Lorry parking (Lkw-Parkplatz), 6.8 km, 57 spaces, 15 of them for lorries … 3. Schlatthof — Lorry parking, 7.9 km, 8 lorry spaces". As of 23:31.
    answerEn: { values: { f1: "6.8", t1: "57", f2: "7.9", t2: "8", asOf: "05.10.2026, 23:31" }, names: { p1: "Schauinsland", p2: "Schlatthof" }, credits: ["autobahn"] },
  },
  {
    tool: "find_charging_station",
    key: "connectPage.asks.charging",
    answerKey: "connectPage.askAnswers.charging",
    // find_charging_station {place: "Leipzig"}: "1. Leipzig, Petersstr. eBox1, Petersstraße 36-44, 04109 Leipzig (E.ON Drive) —
    // 0,3 km, Typ 2, bis 3,7 kW, keine Statusdaten … 3. Pocher Service e.K. - Nordstraße, Nordstraße 3, 04105 Leipzig … 0,8 km, Typ 2,
    // bis 22 kW, 1,20 €/kWh, keine Statusdaten". Stand 23:24.
    answer: { values: { m: "300", kw1: "3,7", kw2: "22", m2: "800", asOf: "05.10.2026, 23:24" }, names: { a1: "Petersstraße 36-44, 04109 Leipzig", a2: "Nordstraße 3, 04105 Leipzig" }, credits: ["mobilithek_afir_ecomovement", "mobilithek_afir_eclearing_stat"] },
    // en "Is there a 300 kW charger near Hannover for a quick stop?" (the en prompt until 2026-10-05, "Where can I charge my EV near
    // Stuttgart?", timed out on production) — find_charging_station {place: "Hannover", min_power_kw: 300, language: "en"}: "1. Electra
    // Hannover - Waschbox, Herschelstraße 9, 30159 Hannover (Electra) — 1.0 km, CCS2, up to 400 kW, … no status data 2. enercity …,
    // Glockseeplatz 1, 30169 Hannover — 1.2 km, CCS2, up to 300 kW, no status data". As of 23:31.
    answerEn: { values: { m: "1,000", kw1: "400", kw2: "300", m2: "1,200", asOf: "05.10.2026, 23:31" }, names: { a1: "Electra Hannover - Waschbox, Herschelstraße 9, 30159 Hannover", a2: "enercity, Glockseeplatz 1, 30169 Hannover" }, credits: ["mobilithek_afir_ecomovement"] },
  },
  {
    tool: "check_autobahn_traffic",
    key: "connectPage.asks.road",
    answerKey: "connectPage.askAnswers.road",
    // check_autobahn_traffic {roads: ["A3"]}: "A3: 0 Staus/Störungen, 29 Sperrungen, 190 Baustellen (+1 weitere Meldungen) — Stand 23:19."
    answer: { values: { closures: "29", works: "190", asOf: "05.10.2026, 23:19" }, names: {}, credits: ["autobahn"] },
    // en "Is the A9 towards Nuremberg moving at the moment?" — check_autobahn_traffic {roads: ["A9"], language: "en"}: "A9: 0 jams/incidents,
    // 19 closures, 76 roadworks sites (+1 further reports) — As of 23:29."
    answerEn: { values: { closures: "19", works: "76", asOf: "05.10.2026, 23:29" }, names: {}, credits: ["autobahn"] },
  },
  {
    tool: "check_weather_warnings",
    key: "connectPage.asks.weather",
    answerKey: "connectPage.askAnswers.weather",
    // check_weather_warnings {place: "Dresden"}: "Für Dresden (14612000) liegt derzeit keine amtliche Wetterwarnung des DWD vor
    // (geprüft für jetzt und die nächsten 24 Stunden)." Stand 23:24.
    answer: { values: { hours: "24", asOf: "05.10.2026, 23:24" }, names: { place: "Dresden" }, credits: ["dwd"] },
    // en "Are there any storm warnings for Hamburg right now?" — check_weather_warnings {place: "Hamburg", language: "en"}: "No official
    // DWD weather warning is currently in force for Hamburg (checked for now and the next 24 hours)." As of 23:31.
    answerEn: { values: { hours: "24", asOf: "05.10.2026, 23:31" }, names: { place: "Hamburg" }, credits: ["dwd"] },
  },
];

/** The languages the eval corpus grades (`lang:` in `evals/prompts/*.yaml`). */
export const GRADED_PROMPT_LANGS = ["de", "en"] as const;

/** The public bridge — the only repository the site may link (#143: never the private platform repo). */
export const BRIDGE_REPO = "https://github.com/mavrovde/viafrei-mcp";
export const NPM_PACKAGE = "https://www.npmjs.com/package/viafrei";
/** The directories that list ViaFrei (owner 2026-10-04): links only — the CSP serves no third-party image. */
export const SMITHERY_LISTING = "https://smithery.ai/servers/viafrei/viafrei";
export const GLAMA_LISTING = "https://glama.ai/mcp/servers/mavrovde/viafrei-bridge";
