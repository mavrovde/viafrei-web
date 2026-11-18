/**
 * #449, the owner's rule (2026-10-05): every translated page speaks only its
 * own language. Renders the home, /connect, /developers and /business in
 * every live language but German — and the 404 page — against the BUILT shell and the REAL digest
 * (`real-digest.ts`: the production renderer over a fixture snapshot), and
 * judges each page with `language-purity.ts`.
 *
 * Measured against production before the fix (2026-10-05, v1.7.4): 152
 * findings over the 24 pages — the connect questions in German and English,
 * the publishers' German free text in the reports tile, "Hbf" and German
 * place names in the example questions, "(Impressum)" in every footer.
 */
import type { ChildProcess } from "node:child_process";
import { chromium, type Browser } from "playwright";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { DWD_LEVEL_NAMES, DWD_ROAD_SUMMARY_LINE, DWD_SUMMARY_LINE, DWD_TRANSLATED_LINE } from "@viafrei/digest";
import { LICENCE_CATALOGUE, MTSK_CONSUMER_NOTE, POI_NEEDS, conditionAsRegistered, datedAttribution } from "@viafrei/ingest";
import { ATTRIBUTION } from "@viafrei/mcp";
import { shortSource } from "@viafrei/design";
import catalogue from "../src/generated/catalogue.json" with { type: "json" };
import { LIVE_LANGS, pathFor, type PageId } from "../src/site/pages.js";
import { placePath } from "../src/site/places.js";
import { motorwayPath } from "../src/site/motorways.js";
import { stationPath } from "../src/site/stations.js";
import { COLLECT_JS, LATIN_COMMON, LATIN_PHRASES, judge, type PageText } from "./language-purity.js";
import { startRealDigest } from "./real-digest.js";
import { startShell } from "./server.js";

const PORT = 8806;
const PAGES: readonly PageId[] = ["start", "connect", "developers", "business", "fuel", "news", "motorways", "404"];
const VERBATIM: readonly string[] = [
  MTSK_CONSUMER_NOTE,
  // A register line naming the year of retrieval ({Jahr}, #804) is printed with the render's Berlin year.
  ...Object.values(ATTRIBUTION).map((r) => datedAttribution(r.text, new Date())),
  // A publisher's condition of use, printed German under its credit (#454, the RVWD line).
  // A dated condition (the VMZ Bremen lines, #641) is printed on a register page with its date named, never as {date}.
  ...Object.values(ATTRIBUTION).flatMap((r) => (r.conditionNote === undefined ? [] : [conditionAsRegistered(r.conditionNote.de, "de")])),
  ...Object.values(LICENCE_CATALOGUE).map((r) => datedAttribution(r.attribution ?? "", new Date())),
  // The weather card's credit for a summarised DWD warning: German on every card, as the DWD's own words are (#564).
  DWD_SUMMARY_LINE,
  // #1085: the place Ampel credits a slipperiness reason with the road-weather summary line, as the motorway Ampel does
  DWD_ROAD_SUMMARY_LINE,
  // A warning shown in the German original beside OUR template translation is credited in the DWD's German form for
  // altered data (#937, steward 2026-10-23); the DWD's own English keeps the Quellenvermerk.
  DWD_TRANSLATED_LINE,
  // #716 (steward M25/M26): a motorway page names a DWD warning's level by the DWD's own German Warnstufe name, with our gloss beside it.
  ...DWD_LEVEL_NAMES,
];
// #746: the publishers a later example answer names as standing above it ("Ebenso aus den Quellen oben: ..."), each a
// `<span translate="no" lang="de">` holding exactly `shortSource` of its register line, derived here the same way
// the set is the register's possible prints; a text is matched against it whole and exactly, never by substring
const PUBLISHERS: ReadonlySet<string> = new Set(catalogue.credits.map((c) => shortSource(c.text).replace(/\s+/g, " ").trim()));
const USED = new Set<string>();
let browser: Browser;
let shell: ChildProcess;
let digest: Awaited<ReturnType<typeof startRealDigest>>;

beforeAll(async () => {
  digest = await startRealDigest();
  shell = await startShell(PORT, { DIGEST_URL: digest.url, IMPRESSUM_NAME: "Site Probe", IMPRESSUM_STREET: "Probeweg 3", IMPRESSUM_CITY: "00000 Probe", IMPRESSUM_EMAIL: "site@example.invalid" });
  browser = await chromium.launch();
});

afterAll(async () => {
  await browser?.close();
  shell?.kill();
  await digest?.close();
});

describe("translated pages speak only their own language (#449)", () => {
  const langs = LIVE_LANGS.filter((l) => l !== "de");
  it("covers every translated language — not nothing", () => {
    expect(langs.length).toBeGreaterThanOrEqual(6);
  });
  for (const lang of langs) {
    for (const id of PAGES) {
      const path = pathFor(id, lang);
      it(`${path}`, async () => {
        const page = await browser.newPage();
        try {
          await page.goto(`http://127.0.0.1:${PORT}${path}`, { waitUntil: "load" });
          const text: PageText = await page.evaluate(COLLECT_JS);
          // the check read the page: a page whose text it could not reach would pass on nothing
          expect(text.texts.length, path).toBeGreaterThan(20);
          if (id === "start") expect(text.otherLang.filter((x) => x.lang === "de").length, `${path}: the tiles' credit lines were read`).toBeGreaterThan(3);
          const findings = judge(lang, text, VERBATIM, USED, PUBLISHERS);
          expect(findings.map((f) => `${f.why} @ ${f.where}: ${f.text}`), path).toEqual([]);
        } finally {
          await page.close();
        }
      });
    }
    // A place page (#564, #693) is judged WHOLE: its cards, its lead and its menus. The
    // town is the gazetteer's German proper name, printed as such and marked
    // translate="no" in the heading and the lead (a named place, not German words).
    // The <title> and the meta description cannot carry a mark, so they are left out.
    // #715: the A7's page — its junctions are German proper names, marked translate="no" by the digest.
    const a7 = motorwayPath(lang, "A7");
    it(`${a7}`, async () => {
      const page = await browser.newPage();
      try {
        await page.goto(`http://127.0.0.1:${PORT}${a7}`, { waitUntil: "load" });
        expect(await page.locator("#motorway .motorway__ask").count(), a7).toBe(1);
        const text: PageText = await page.evaluate(COLLECT_JS);
        expect(text.texts.length, a7).toBeGreaterThan(20);
        const findings = judge(lang, text, VERBATIM, USED, PUBLISHERS);
        expect(findings.map((f) => `${f.why} @ ${f.where}: ${f.text}`), a7).toEqual([]);
      } finally {
        await page.close();
      }
    });
    const place = placePath(lang, "koeln");
    it(`${place}`, async () => {
      const page = await browser.newPage();
      try {
        await page.goto(`http://127.0.0.1:${PORT}${place}`, { waitUntil: "load" });
        // #693's two cards: the stations, and the nearby places — since #1117 one card per everyday need
        expect(await page.locator("#pcard-stations").count(), `${place}: the #693 stations card is on the page`).toBe(1);
        expect(await page.locator(POI_NEEDS.map((n) => `#pcard-${n}`).join(", ")).count(), `${place}: #1117's need cards are on the page`).toBeGreaterThanOrEqual(1);
        await page.evaluate(() => {
          document.title = "";
          document.querySelector('meta[name="description"]')?.remove();
        });
        const text: PageText = await page.evaluate(COLLECT_JS);
        expect(text.texts.length, place).toBeGreaterThan(20);
        const findings = judge(lang, text, VERBATIM, USED, PUBLISHERS);
        expect(findings.map((f) => `${f.why} @ ${f.where}: ${f.text}`), place).toEqual([]);
      } finally {
        await page.close();
      }
    });
    // #1042: a DB station page judged WHOLE — its head, its live cards (the board, the lifts, the platforms, the
    // alerts) and the cards of its position. The station's and the board's places are German proper names, marked
    // translate="no" by the digest; the <title> and the meta description cannot carry a mark, so they are left out.
    const station = stationPath(lang, "koeln-hbf");
    it(`${station}`, async () => {
      const page = await browser.newPage();
      try {
        await page.goto(`http://127.0.0.1:${PORT}${station}`, { waitUntil: "load" });
        expect(await page.locator("#station-live #pcard-station-board").count(), `${station}: the live part is on the page`).toBe(1);
        await page.evaluate(() => {
          document.title = "";
          document.querySelector('meta[name="description"]')?.remove();
        });
        const text: PageText = await page.evaluate(COLLECT_JS);
        expect(text.texts.length, station).toBeGreaterThan(20);
        const findings = judge(lang, text, VERBATIM, USED, PUBLISHERS);
        expect(findings.map((f) => `${f.why} @ ${f.where}: ${f.text}`), station).toEqual([]);
      } finally {
        await page.close();
      }
    });
  }
  // runs after every page above (one file, in order): an allow-list entry no page needs is a hole, not a convenience
  it("every Latin allow-list entry was needed by at least one checked page", () => {
    expect([...LATIN_COMMON, ...LATIN_PHRASES].filter((w) => !USED.has(w))).toEqual([]);
  });
});

describe("the check itself can say NO", () => {
  type Extra = { readonly names?: readonly string[]; readonly otherLang?: readonly { lang: string; text: string }[] };
  const on = (lang: string, texts: readonly string[], extra: Extra = {}): string[] =>
    judge(lang, { pageLang: lang, texts: texts.map((text) => ({ where: "p", text })), names: extra.names ?? [], otherLang: extra.otherLang ?? [] }, VERBATIM, undefined, PUBLISHERS).map((f) => f.why);

  it("flags German words, letters and quotation marks on a translated page", () => {
    expect(on("ru", ["Wann fährt der nächste Zug?"]).length).toBeGreaterThan(0);
    expect(on("en", ["at AS Herbolzheim (aus Richtung Riegel)"]).length).toBeGreaterThan(0);
    expect(on("uk", ["Запитайте: „Чи вільна A8?“"])).toContain("the German quotation mark „");
    expect(on("tr", ["Straße"]).length).toBeGreaterThan(0);
  });
  it("a multiplication sign is no Latin word, a Latin word beside it still is", () => {
    expect(on("ru", ["3 × Зарядка, 1 × Парковка."])).toEqual([]);
    expect(on("ru", ["3 × Laden"])).toEqual(['the Latin-script word "Laden"']);
  });
  it("flags a German place left in Latin script on a Cyrillic page (#449 S2)", () => {
    expect(on("ru", ["Автобусы и поезда в Hamburg"])).toEqual(['the Latin-script word "Hamburg"']);
    expect(on("ru", ["Где парковка в Köln?"])).toContain('the Latin-script word "Köln"');
  });
  it("keeps NAMES per language: Köln is Romanian and Turkish, not English", () => {
    expect(on("ro", ["E liberă A8 spre München?"])).toEqual([]);
    expect(on("tr", ["Köln Ana Garı'ndaki asansör çalışıyor mu?"])).toEqual([]);
    expect(on("en", ["Where is a car park in Köln?"])).toContain("a German letter");
  });
  it("checks a name for German road words and junction abbreviations", () => {
    expect(on("ru", [], { names: ["Vollsperrung"] }).length).toBe(1);
    expect(on("ru", [], { names: ["AS Hagen-West"] }).length).toBe(1);
    expect(on("ru", [], { names: ["Parkplatz Hösel"] }).length).toBe(1);
    expect(on("ru", [], { names: ["Hagen-West", "Elbtunnel (Nordportal)"] })).toEqual([]);
    // #1051: a publisher's name as its register line writes it is accepted; the same word in an invented name is not
    expect(VERBATIM.some((v) => v.includes("Freie und Hansestadt Hamburg"))).toBe(true);
    expect(on("ru", [], { names: ["Freie und Hansestadt Hamburg"] })).toEqual([]);
    expect(on("ru", [], { names: ["Musterstadt und Umgebung"] }).length).toBe(1);
  });
  it("flags an element in another language, and German-marked text that is not licence text", () => {
    expect(on("ru", [], { otherLang: [{ lang: "en", text: "No fares, tickets or booking of any kind." }] })).toEqual(['an element in "en" on a "ru" page']);
    expect(on("en", [], { otherLang: [{ lang: "de", text: "Vollsperrung nach Unfall" }] })).toEqual(["German-marked text that is not licence text"]);
  });
  it("accepts a register publisher's short name marked German (#746), and nothing more around it", () => {
    const delfi = catalogue.credits.find((c) => c.id === "delfi_rt_tu")!;
    const name = shortSource(delfi.text);
    expect(PUBLISHERS.has(name)).toBe(true);
    expect(on("en", [], { otherLang: [{ lang: "de", text: name }] })).toEqual([]);
    expect(on("en", [], { otherLang: [{ lang: "de", text: ` ${name} ` }] })).toEqual([]);
    // the mutants: an invented German phrase, and a register name with German words beside it, still fail
    expect(on("en", [], { otherLang: [{ lang: "de", text: "Ebenso aus den Quellen oben" }] })).toEqual(["German-marked text that is not licence text"]);
    expect(on("en", [], { otherLang: [{ lang: "de", text: `${name} und Partner` }] })).toEqual(["German-marked text that is not licence text"]);
    expect(on("en", [], { otherLang: [{ lang: "de", text: "Verkehrsverbund Musterstadt" }] })).toEqual(["German-marked text that is not licence text"]);
  });
  it("accepts the language's own words, its quotation marks, allowed Latin words and licence text", () => {
    expect(on("ru", ["Спросите: «Свободна ли A8 в сторону Мюнхена?»"])).toEqual([]);
    expect(on("ru", ["Подключите ViaFrei в Claude: Connectors → Add custom connector, 3 min назад, 150 kW, A8, S1."])).toEqual([]);
    expect(on("bg", ["Попитайте: „Свободна ли е A8?“"])).toEqual([]);
    expect(on("en", [], { otherLang: [{ lang: "de", text: MTSK_CONSUMER_NOTE }] })).toEqual([]);
  });
  it("leaves the German page alone", () => {
    expect(on("de", ["Wann fährt der nächste Zug ab Köln Hbf?"])).toEqual([]);
  });
});
