/**
 * The real answers on the connect page (#472, extended for v1.8.1), checked at
 * their sources: the tools they name are tools the server lists, the credit
 * lines they print are register lines the server answers from, the honest
 * sentences are said in every language, and every value still waiting for a
 * production answer — or read off a recording and waiting for production to
 * confirm it — is named here, so the lists below are the record of what is left.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { MOBILITHEK_FEEDS } from "@viafrei/ingest";
import { webPinned } from "./lang-pins.js";
import { describe, expect, it } from "vitest";
import catalogue from "../src/generated/catalogue.json" with { type: "json" };
import register from "../src/generated/register.json" with { type: "json" };
import { catalogue as deck, t } from "../src/i18n/index.js";
import { CARD_EXPIRES, CITYWORK_CARD_EXPIRES, CLOSURE_CARD_EXPIRES, CONNECT_EXAMPLES, connectExamples, DOMAINS, KIEL_CARD_EXPIRES, LIVE_EXAMPLES, TODO_VALUE, namesOf, pendingValues, recheckAfterDeploy, type LiveExample } from "../src/site/live-examples.js";
import { LIVE_LANGS, PAGE_IDS } from "../src/site/pages.js";
import { FUEL_ASKS } from "../src/site/examples.js";
import { jsonLdText, pageJsonLd, structuredData } from "../src/site/structured-data.js";

/** The keys the connect page renders `ms` milliseconds after `at` (#473: an ended card is withdrawn at the request's clock). */
const shownAt = (at: Date, ms: number): readonly string[] => connectExamples(new Date(at.getTime() + ms)).map((e) => e.key);

/**
 * The values the v1.7.6 deploy has to supply (#472): read them off ONE
 * production answer to each question, write them into
 * `src/site/live-examples.ts`, and empty this list in the same commit.
 */
const STILL_PENDING: string[] = [];

/**
 * The v1.8.1 examples, read off the recorded pulls of 2026-10-05 before the
 * feeds reach production. After the v1.8.1 deploy: ask production each
 * question, confirm or replace the figures and the "Stand", drop `recheck`
 * from the example, and remove its key here in the same commit.
 */
// v1.9.14 (#488, #490): the BEMaS and the Hamburg Bauweiser cards were read off the recorded cuts; #746 asked production
// both on 2026-10-16 (Bauweiser confirmed, BEMaS replaced with production's answer), so none is left.
const RECHECK_AFTER_DEPLOY: string[] = [];

const KEYS = [
  "stadtbahn", "bikes",
  "lift", "alert", "enbw", "ecomove", "ocpdb", "lsr", "charger", "hamburg", "hhworks", "muenster", "carpark",
  "motorway", "citywork", "landroad", "saxony", "bwroad", "roadworks", "kiel",
  "truckstop", "lorry", "parkride", "platform", "train", "region", "tomorrow", "closure", "weather",
  "fuelcity", "fuelroad", "fuelland",
] as const;

/** The v1.8.2 PR 3 answers asked of PRODUCTION on 2026-10-05 (owner: "more interesting and useful examples, about parkings for example"). */
// "closure" was asked of production again on 2026-10-09 (v1.9.6) and has its own block below.
const ASKED_OF_PRODUCTION = ["truckstop", "parkride", "platform", "region", "tomorrow", "weather", "fuelcity"] as const;

describe("real answers on the connect page (#472, v1.8.1, v1.8.2)", () => {
  it("are the two v1.8.16 cards, one answer per v1.8.1 integration and the v1.8.2 to v1.8.12 answers, each with the tool that gave it", () => {
    expect(LIVE_EXAMPLES.map((e) => [e.key, e.tool])).toEqual([
      ["stadtbahn", "check_station_facilities"],
      ["bikes", "find_sharing"],
      ["lift", "check_station_facilities"],
      ["alert", "check_transit_disruption"],
      ["enbw", "find_charging_station"],
      ["ecomove", "find_charging_station"],
      ["ocpdb", "find_charging_station"],
      ["lsr", "find_charging_station"],
      ["charger", "find_charging_station"],
      ["hamburg", "find_parking"],
      ["hhworks", "find_roadworks_ahead"],
      ["muenster", "find_parking"],
      ["carpark", "find_parking"],
      ["motorway", "check_road_status"],
      ["citywork", "check_road_status"],
      ["landroad", "find_roadworks_ahead"],
      ["saxony", "find_roadworks_ahead"],
      ["bwroad", "find_roadworks_ahead"],
      ["roadworks", "find_roadworks_ahead"],
      ["kiel", "check_road_status"],
      ["truckstop", "find_parking"],
      ["lorry", "find_parking"],
      ["parkride", "find_parking"],
      ["platform", "get_train_departures"],
      ["train", "get_train_departures"],
      ["region", "check_transit_disruption"],
      ["tomorrow", "find_roadworks_ahead"],
      ["closure", "check_road_status"],
      ["weather", "check_weather_warnings"],
      ["fuelcity", "find_cheapest_fuel"],
      ["fuelroad", "find_cheapest_fuel"],
      ["fuelland", "find_cheapest_fuel"],
    ]);
  });

  it("name tools the server lists", () => {
    const tools = catalogue.tools.map((x) => x.name);
    for (const e of LIVE_EXAMPLES) expect(tools, e.tool).toContain(e.tool);
  });

  it("print credit lines the server answers from today — none planned, none missing", () => {
    const live = new Set(catalogue.credits.map((c) => c.id));
    for (const e of LIVE_EXAMPLES) {
      expect(e.credits.length, e.key).toBeGreaterThan(0);
      for (const id of e.credits) expect(live.has(id), `${e.key}: ${id}`).toBe(true);
    }
  });

  it("credit the v1.8.1 feeds each example rests on", () => {
    const credits = Object.fromEntries(LIVE_EXAMPLES.map((e) => [e.key, [...e.credits].sort()]));
    expect(credits["lift"]).toEqual(["db_stada", "mobilithek_openstation_netex", "mobilithek_openstation_siri_fm"]);
    expect(credits["alert"]).toEqual(["delfi_rt_sa", "delfi_rt_tu", "delfi_siri_sx", "delfi_static"]);
    // The e-clearing.net charger (#468), back since #746: its static and availability lines, and OSM for the address.
    expect(credits["charger"]).toEqual(["mobilithek_afir_eclearing_dyn", "mobilithek_afir_eclearing_stat", "osm"]);
  });

  it("show a live AFIR pair on the site, each with BOTH its halves' lines, as production answered (#467)", () => {
    const credits = Object.fromEntries(LIVE_EXAMPLES.map((e) => [e.key, [...e.credits].sort()]));
    // EnBW: the static and the availability line (the VW line came with another site of the same answer).
    // #746 (2026-10-16): the register line came with a third site of the same answer, as the VW line once did.
    // 2.5.4 (2026-11-02): production answered the site with no status for any of its five points and no EnBW availability
    // line among its sources, so the card credits the static half alone and says there is no status.
    expect(credits["enbw"]).toEqual(["bnetza_lsr", "mobilithek_afir_enbw_stat", "osm"]);
    // Eco-Movement: the static and the availability line.
    expect(credits["ecomove"]).toEqual(["mobilithek_afir_ecomovement", "mobilithek_afir_ecomovement_dyn", "osm"]);
    // CC BY 4.0 on both availability lines: the catalogue carries the licence link ConnectPage renders beside them.
    for (const id of ["mobilithek_afir_enbw_dyn", "mobilithek_afir_ecomovement_dyn"]) {
      expect(catalogue.credits.find((c) => c.id === id)?.licence?.url, id).toBe("https://creativecommons.org/licenses/by/4.0/");
    }
    for (const k of ["enbw", "ecomove"] as const) {
      const e = LIVE_EXAMPLES.find((x) => x.key === k)!;
      expect(e.recheck, k).toBeUndefined();
      expect(e.values["asOf"], k).toMatch(/^18\.11\.2026, 14:29$/);
      const vars = { ...e.values, ...namesOf(e) };
      expect(t("de", `connectPage.live.${k}.a`, vars), k).toContain(`${e.values["euro"]},${e.values["cent"]} €/kWh`);
      expect(t("en", `connectPage.live.${k}.a`, vars), k).toContain(`€${e.values["euro"]}.${e.values["cent"]}/kWh`);
      // one or two sentences: the page-weight budget (owner)
      for (const lang of LIVE_LANGS) expect(t(lang, `connectPage.live.${k}.a`, vars).length, `${lang}: ${k}`).toBeLessThanOrEqual(140);
    }
    // 2.5.4: EnBW gave no status at all and JOLT's was from the day before, and the cards say so rather than "free"
    expect(t("de", "connectPage.live.enbw.a", { ...LIVE_EXAMPLES.find((x) => x.key === "enbw")!.values })).toBe("Bis 300 kW, 0,70 €/kWh – doch für keinen der 5 Ladepunkte liegt ein Status vor, also sagt ViaFrei nicht „frei“.");
    expect(t("de", "connectPage.live.ecomove.a", { ...LIVE_EXAMPLES.find((x) => x.key === "ecomove")!.values, site: "JOLT HH008701" })).toBe("JOLT HH008701: bis 350 kW, 0,79 €/kWh; der letzte Status stammt vom 15.11., 16:20 – zu alt, um „frei“ zu sagen.");
  });

  it("show one card per feed that went live in v1.8.12, each crediting exactly what production answered (#481, #482, #484, #485)", () => {
    const credits = Object.fromEntries(LIVE_EXAMPLES.map((e) => [e.key, [...e.credits].sort()]));
    expect(credits["ocpdb"]).toEqual(["mobilithek_afir_chargecloud_stat", "ocpdb_chargecloud", "osm"]);
    expect(credits["lsr"]).toEqual(["bnetza_lsr", "osm"]);
    expect(credits["hamburg"]).toEqual(["delfi_zhv", "hamburg_parkhaeuser", "osm"]);
    expect(credits["muenster"]).toEqual(["delfi_zhv", "muenster_pls"]);
    for (const k of ["ocpdb", "lsr", "hamburg", "muenster"] as const) {
      const e = LIVE_EXAMPLES.find((x) => x.key === k)!;
      expect(e.recheck, k).toBeUndefined();
      expect(e.values["asOf"], k).toMatch(/^(?:02|18)\.11\.2026, 14:\d\d$/);
      // short cards: the page-weight budget (owner)
      for (const lang of LIVE_LANGS) expect(t(lang, `connectPage.live.${k}.a`, { ...e.values, ...namesOf(e) }).length, `${lang}: ${k}`).toBeLessThanOrEqual(170);
    }
    const vars = (k: string) => { const e = LIVE_EXAMPLES.find((x) => x.key === k)!; return { ...e.values, ...namesOf(e) }; };
    expect(t("de", "connectPage.live.ocpdb.a", vars("ocpdb"))).toBe("Ja, einer: Typ 2 bis 22 kW ist frei, der CCS-Ladepunkt bis 50 kW außer Betrieb – 0,49 €/kWh netto.");
    expect(t("de", "connectPage.live.muenster.a", vars("muenster"))).toBe("89 von 300 Plätzen frei – dazu 4 weitere Parkhäuser in der Nähe, jedes mit seiner Belegung.");
    // the register has no live status, and says so in every language; its own Stand is quoted
    for (const lang of LIVE_LANGS) expect(t(lang, "connectPage.live.lsr.a", vars("lsr")), lang).toContain("01.09.2026");
    // CC BY 4.0 § 3(a)(1)(A)(iv): the publisher's no-warranty notice travels with every share of register data
    // (steward ruling on #482) — the tool's own clause in German and English, its meaning in each other language
    const NO_WARRANTY: Record<(typeof LIVE_LANGS)[number], string> = {
      de: "ohne Gewähr für Richtigkeit und Vollständigkeit", en: "no warranty of accuracy or completeness",
      ru: "без гарантии точности и полноты", bg: "без гаранция за точност и пълнота", uk: "без гарантії точності та повноти",
      ro: "fără garanție de exactitate sau completitudine", tr: "doğruluk ve eksiksizlik garantisi verilmez",
      ...webPinned((p) => p.noWarranty),
    };
    for (const lang of LIVE_LANGS) expect(t(lang, "connectPage.live.lsr.a", vars("lsr")), lang).toContain(NO_WARRANTY[lang]);
    // Hamburg's own caveat: verbatim in German, in each language's own words elsewhere — never the German quoted
    expect(t("de", "connectPage.live.hamburg.a", vars("hamburg"))).toContain("„Diese Echtzeitdaten sind ungeprüft.“");
    const UNVERIFIED: Record<(typeof LIVE_LANGS)[number], string> = {
      de: "ungeprüft", en: "unverified", ru: "не проверены", bg: "не са проверени", uk: "не перевірені", ro: "nu sunt verificate", tr: "doğrulanmadığını",
      ...webPinned((p) => p.unverified),
    };
    for (const lang of LIVE_LANGS) {
      const a = t(lang, "connectPage.live.hamburg.a", vars("hamburg"));
      expect(a, lang).toContain(UNVERIFIED[lang]);
      if (lang !== "de") expect(a, lang).not.toContain("Echtzeitdaten");
    }
  });

  it("credit the feeds behind each answer asked of production on 2026-10-05, re-asked on 2026-10-16 (#746) and 2026-11-02 (2.5.4)", () => {
    const credits = Object.fromEntries(LIVE_EXAMPLES.map((e) => [e.key, [...e.credits].sort()]));
    expect(credits["truckstop"]).toEqual(["mobilithek_park_bosch_dyn", "mobilithek_park_bosch_static", "mobilithek_truckpark_static_geonutzv"]);
    expect(credits["parkride"]).toEqual(["mobilithek_park_nrw_pr"]);
    expect(credits["platform"]).toEqual(["db_stada", "db_timetables"]);
    expect(credits["region"]).toEqual(["delfi_rt_tu"]);
    expect(credits["tomorrow"]).toEqual(["mobilithek_roadworks_bast"]);
    expect(credits["closure"]).toEqual(["autobahn"]);
    expect(credits["weather"]).toEqual(["dwd"]);
    for (const k of ["fuelcity", "fuelroad", "fuelland"]) expect(credits[k], k).toEqual(["tankerkoenig"]);
    // production's own answers: nothing to re-check, every one re-asked on 2026-11-02 (2.5.4)
    for (const k of ASKED_OF_PRODUCTION) {
      const e = LIVE_EXAMPLES.find((x) => x.key === k)!;
      expect(e.recheck, k).toBeUndefined();
      expect(e.values["asOf"], k).toMatch(/^(?:02|18)\.11\.2026, \d\d:\d\d$/);
    }
    // the share-alike P+R line keeps its licence in the credit, never in the copy
    expect(catalogue.credits.find((c) => c.id === "mobilithek_park_nrw_pr")?.text).toContain("CC BY-SA");
  });

  it("each carry the question, a response excerpt with the answer's figures, a date and a credit (owner 2026-10-05)", () => {
    for (const e of LIVE_EXAMPLES) {
      const vars = { ...e.values, ...namesOf(e) };
      for (const lang of LIVE_LANGS) {
        const a = t(lang, `connectPage.live.${e.key}.a`, vars);
        expect(a.trim().length, `${lang}: ${e.key} has no response`).toBeGreaterThan(15);
        // the response is not the question said again
        expect(a, `${lang}: ${e.key}`).not.toBe(t(lang, e.question, vars));
        // and quotes at least one of the answer's own figures, unless it is an honest "none"
        const figures = Object.entries(e.values).filter(([k]) => k !== "asOf").map(([, v]) => v);
        if (figures.length > 0) expect(figures.some((f) => a.includes(f)), `${lang}: ${e.key} quotes none of ${figures.join(", ")}`).toBe(true);
      }
      expect(e.values["asOf"], e.key).toMatch(/^\d\d\.\d\d\.\d{4}, \d\d:\d\d$/);
      expect(e.credits.length, e.key).toBeGreaterThan(0);
    }
  });

  it("the fuel examples (owner 2026-10-05): station, address, price in each language's own decimal mark, the time asked and, where printed, the station's report time; the note says a price is an example", () => {
    const fuel = LIVE_EXAMPLES.filter((e) => e.tool === "find_cheapest_fuel");
    // v1.8.18 rotated Würzburg and Stuttgart off; #746 brought them back (three, the steward's ceiling below)
    expect(fuel.map((e) => e.key)).toEqual(["fuelcity", "fuelroad", "fuelland"]);
    for (const e of fuel) {
      expect(namesOf(e)["station"], e.key).toBeTruthy();
      expect(namesOf(e)["address"], e.key).toMatch(/\d{5} /);
      expect(e.values["asOf"], e.key).toMatch(/^18\.11\.2026, 14:30$/);
      const vars = { ...e.values, ...namesOf(e) };
      expect(t("de", `connectPage.live.${e.key}.a`, vars), e.key).toContain(`${e.values["euro"]},${e.values["cent"]} €/l`);
      expect(t("en", `connectPage.live.${e.key}.a`, vars), e.key).toContain(`€${e.values["euro"]}.${e.values["cent"]}`);
      if (e.values["reported"] !== undefined) for (const lang of LIVE_LANGS) expect(t(lang, `connectPage.live.${e.key}.a`, vars), `${lang}: ${e.key}`).toContain(e.values["reported"]);
    }
    expect(t("de", "connectPage.live.fuelcity.note")).toMatch(/alle paar Minuten/);
    expect(t("de", "connectPage.live.fuelcity.note")).toMatch(/nicht der heutige Preis/);
    // the credit and the MTS-K consumer-information note, verbatim, from the register
    expect(catalogue.credits.find((c) => c.id === "tankerkoenig")?.text).toBe("Tankstellenpreise: Tankerkönig.de — MTS-K, CC BY 4.0, bearbeitet");
    // the card markup lives in LiveCard.astro since #746, shared by the connect page and the examples page (#747)
    const connect = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "..", "src", "components", "LiveCard.astro"), "utf8");
    expect(connect).toContain('e.credits.includes("tankerkoenig") && <p class="answer__note" lang="de">{register.mtskNote}</p>');
  });

  describe("the data steward's conditions on the fuel examples (2026-10-05, APPROVE WITH CONDITIONS)", () => {
    const fuel = LIVE_EXAMPLES.filter((e) => e.credits.includes("tankerkoenig"));
    // the card markup lives in LiveCard.astro since #746 (the connect page and the examples page render it)
    const connect = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "..", "src", "components", "LiveCard.astro"), "utf8");

    it("(1) at most three, each a find_cheapest_fuel / find_fuel_station answer", () => {
      expect(fuel.length).toBeGreaterThan(0);
      expect(fuel.length).toBeLessThanOrEqual(3);
      for (const e of fuel) expect(["find_cheapest_fuel", "find_fuel_station"], e.key).toContain(e.tool);
    });

    it("(2) say visibly that it is an example, dated to the minute, and that prices change", () => {
      expect(t("de", "connectPage.live.fuelExample", { asOf: "05.10.2026, 20:44" })).toBe("Beispielantwort vom 05.10.2026, 20:44 — Preise heute anders");
      for (const lang of LIVE_LANGS) for (const e of fuel) expect(t(lang, "connectPage.live.fuelExample", e.values), lang).toContain(e.values["asOf"]!);
      expect(connect).toContain('e.credits.includes("tankerkoenig") ? <strong>{t(lang, "connectPage.live.fuelExample", e.values)}</strong>');
      expect(t("de", "connectPage.live.fuelcity.note")).toMatch(/ändern sich alle paar Minuten/);
    });

    it("(3) show no id and no coordinates", () => {
      for (const e of fuel) for (const v of [...Object.values(e.values), ...Object.values(namesOf(e))]) {
        expect(v, e.key).not.toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-/i);
        expect(v, e.key).not.toMatch(/\d+\.\d{3,},?\s*\d+\.\d{3,}/);
      }
    });

    it("(5) carry the Tankerkönig line and the MTS-K consumer note verbatim, German-marked", () => {
      for (const e of fuel) expect(e.credits, e.key).toEqual(["tankerkoenig"]);
      expect(register.mtskNote).toMatch(/^Hinweis zu den Kraftstoffpreisdaten \(MTS-K\): Diese Daten dürfen ausschließlich zum Zweck der Verbraucherinformation verwendet werden/);
      expect(connect).toContain('{e.credits.includes("tankerkoenig") && <p class="answer__note" lang="de">{register.mtskNote}</p>}');
    });

    // #531 put one JSON-LD block in every page's <head> (Organization, WebSite, the app, the connect FAQ). Condition 6 is
    // about the EXAMPLES — they may not be machine-readable — so it is held here as exactly that: no data-* attribute and
    // no microdata in the templates that render them; the one ld+json element is Base.astro's, built by
    // site/structured-data.ts alone, which reads no live example and no register data; and the JSON-LD of EVERY page in
    // EVERY language carries none of a fuel example's figures, names or date, no Tankerkönig credit and no MTS-K note.
    it("(6) are not machine-readable: no data-* attribute, no microdata, and nothing of them in any page's JSON-LD (#531)", () => {
      const prices = (v: Readonly<Record<string, string>>): string[] =>
        ["", "2"].flatMap((n) => (v[`euro${n}`] !== undefined && v[`cent${n}`] !== undefined ? [`${v[`euro${n}`]},${v[`cent${n}`]}`, `${v[`euro${n}`]}.${v[`cent${n}`]}`] : []));
      const src = (f: string): string => readFileSync(join(dirname(fileURLToPath(import.meta.url)), "..", "src", f), "utf8");
      for (const f of ["layouts/ConnectPage.astro", "components/LiveCard.astro", "layouts/ExamplesPage.astro", "layouts/Base.astro", "layouts/Home.astro", "layouts/FuelPage.astro", "components/Day.astro", "components/Answer.astro"]) {
        // data-*: the templates the connect examples render in, as before #531 (the home's board script keeps its own rules, #404)
        // #717: Base.astro's `<body data-clarity-mask>` is the one exemption — a masking flag for Microsoft Clarity that carries
        // no value of an example (it HIDES them from a recording), named exactly so that no other data-* can ride on it.
        if (f === "layouts/ConnectPage.astro" || f === "components/LiveCard.astro" || f === "layouts/ExamplesPage.astro" || f === "layouts/Base.astro")
          expect(src(f).replace(/<body data-clarity-mask=\{clarity !== undefined \? "true" : undefined\}>/g, "<body>"), f).not.toMatch(/\sdata-[a-z]/);
        expect(src(f), f).not.toMatch(/itemprop|itemscope|schema\.org/);
        expect((src(f).match(/ld\+json/g) ?? []).length, f).toBe(f === "layouts/Base.astro" ? 1 : 0);
      }
      expect(src("layouts/Base.astro")).toMatch(/application\/ld\+json"[^>]*set:html=\{jsonLd\}/);
      const builder = src("site/structured-data.ts");
      expect(builder).not.toMatch(/^import (?!type )[^;]*from "\.\/(live-examples|examples)\.js"/m);
      expect(builder).not.toMatch(/generated\/(register|catalogue)\.json/);
      // #1025: the one register line the JSON-LD carries is the LCL's credit, read in its own module, which reads that id alone
      const lcl = src("site/lcl-credit.ts");
      expect([...lcl.matchAll(/id === "([a-z_0-9]+)"/g)].map((m) => m[1])).toEqual(["bast_lcl"]);
      expect(lcl).not.toMatch(/tankerkoenig|mtsk/i);
      const forbidden = [
        // every price and every station name and address of a fuel example, the connect page's and the home's (Day.astro) —
        // as whole prices: a bare "159" is also the end of a Hannover postcode, and a date is shared by any answer asked that minute
        ...[...fuel.map((e) => ({ values: e.values, names: namesOf(e) })), ...FUEL_ASKS.map((a) => a.answer)].flatMap((a) => [
          ...prices(a.values),
          ...Object.values(a.names),
        ]),
        register.mtskNote,
        ...catalogue.credits.filter((c) => c.id === "tankerkoenig").map((c) => c.text),
        "Tankerkönig",
        "MTS-K",
      ].filter((v) => v.length >= 3);
      expect(forbidden.length).toBeGreaterThan(5);
      for (const page of PAGE_IDS) {
        for (const lang of LIVE_LANGS) {
          const plain = JSON.stringify(JSON.parse(jsonLdText(structuredData(page, lang, "1.0.0"))));
          if (page === "fuel") expect(pageJsonLd(page, lang, "1.0.0"), `${lang}: the fuel page carries no JSON-LD`).toBeNull();
          for (const v of forbidden) expect(plain, `${page}/${lang}: the JSON-LD carries "${v}"`).not.toContain(v);
        }
      }
    });

    it("(7) are no older than 90 days — re-capture once (by hand, asked as a person would) or remove them", () => {
      for (const e of fuel) {
        const [d, m, y] = (e.values["asOf"] ?? "").split(",")[0]!.split(".").map(Number);
        const captured = Date.UTC(y!, m! - 1, d);
        const ageDays = (Date.now() - captured) / 86_400_000;
        expect(ageDays, `${e.key}: captured ${e.values["asOf"]}, ${Math.floor(ageDays)} days ago`).toBeLessThanOrEqual(90);
      }
    });
  });

  it("credit the v1.8.2 feeds each example rests on, and carry the RVWD line under the Baden-Württemberg credit", () => {
    const credits = Object.fromEntries(LIVE_EXAMPLES.map((e) => [e.key, [...e.credits].sort()]));
    // The BW police message left the page (#454 C1); the A6 card is an Autobahn GmbH answer, credited as answered.
    expect(credits["motorway"]).toEqual(["autobahn", "mobilithek_roadworks_bast"]);
    expect(LIVE_EXAMPLES.filter((e) => e.credits.includes("mobilithek_traffic_bw")).map((e) => e.key)).toEqual([]);
    expect(credits["landroad"]).toEqual(["mobilithek_roadworks_ald_th"]);
    expect(credits["saxony"]).toEqual(["mobilithek_roadworks_ald_ni", "mobilithek_roadworks_ald_sn", "mobilithek_roadworks_nlstbv"]);
    // #746: the B3 card, back — the two Lower Saxony lines the answer credited for its sites there
    expect(credits["roadworks"]).toEqual(["mobilithek_roadworks_ald_ni", "mobilithek_roadworks_nlstbv"]);
    // 2.5.4 (2026-11-02): the ferry message had ended and no SH police message stood near Kiel, so the card is the city of
    // Kiel's own roadworks register, credited alone; the answer's other credits came from rows the card does not show (#785).
    expect(credits["kiel"]).toEqual(["kiel_baustellen"]);
    // #474: the Berlin card, as production v1.8.10 answered it by place (2026-10-06T04:31:20Z).
    expect(credits["citywork"]).toEqual(["autobahn", "mobilithek_nms_events", "mobilithek_roadworks_bast", "mobilithek_traffic_berlin", "osm"]);
    const credit = (id: string) => catalogue.credits.find((c) => c.id === id);
    // The condition of use is the register's, German, under the one credit that owes it (#454).
    expect(credit("mobilithek_traffic_bw")?.condition).toMatch(/^Amtliche Meldungen des Verkehrswarndienstes .*RVWD.* ungekürzt und nur aktuell wiedergegeben\.$/);
    // Ten credits carry a condition — BW's RVWD line, Sachsen's SPERRINFOSYS sentence on who answers for
    // the data (#606, v2.2.3), KVB's no-warranty sentence (#487), the Hamburg cameras' "not reliably
    // available 24h" caveat (#491), the DWD road-weather disclaimer (#456) and BASt's notice on the
    // long-lorry network extract (#638, v2.2.6), and VMZ Bremen's two offers' condition of the owner's ruling
    // (#641: the signs on site bind, not for route guidance, the read date given in each answer), and Dresden's
    // lorry ban zones' note that a ban is information, not legal advice (#586), and Hamburg's heavy-transport
    // network's note that it is no permit (#570), and the Autobahn GmbH's short-duration works' note that they
    // are planned at short notice and are no GST permit (#836, AK3, v2.3.21), and the Toll Collect SID's notice beside its truck-parking figures (#707, "keine Gewähr", the terms at #sid) — and only BW's binds the wording of what is shown (the verbatim rule below reads `verbatim`, not `condition`).
    expect(catalogue.credits.filter((c) => c.condition !== null).map((c) => c.id)).toEqual(["dwd_road", "mobilithek_traffic_bw", "mobilithek_sperrinfosys_sn", "toll_collect_sid", "mobilithek_roadworks_akd", "hh_verkehrskameras", "lorry_bast_langlkw", "lorry_hb_durchfahrtshoehen", "lorry_hb_fuehrungshoehen", "lorry_dresden_verbotszonen", "lorry_hh_gst_netz", "kvb_lifts"]);
    expect(catalogue.credits.filter((c) => c.verbatim).map((c) => c.id)).toEqual(["mobilithek_traffic_bw"]);
    // One link to the licence text: BW and Berlin spell it inside their prescribed line, so the
    // catalogue's link is the only CLICKABLE one; the TLBV (GeoNutzV) owes none.
    expect(credit("mobilithek_traffic_bw")?.licence?.url).toBe("https://www.govdata.de/dl-de/by-2-0");
    expect(credit("mobilithek_traffic_berlin")?.licence?.url).toBe("https://www.govdata.de/dl-de/by-2-0");
    expect(credit("mobilithek_roadworks_ald_th")?.licence).toBeNull();
  });

  it("fill every placeholder the deck's question and answer use, in every language", () => {
    for (const e of LIVE_EXAMPLES) {
      const vars = { ...e.values, ...namesOf(e) };
      for (const lang of LIVE_LANGS) {
        expect(() => t(lang, e.question, vars), `${lang}: ${e.key} q`).not.toThrow();
        expect(() => t(lang, `connectPage.live.${e.key}.a`, vars), `${lang}: ${e.key}`).not.toThrow();
        expect(() => t(lang, "connectPage.live.asOf", e.values), `${lang}: ${e.key}`).not.toThrow();
      }
    }
  });

  it("put each proper name in the question or the answer, never left as a figure", () => {
    const muenster = LIVE_EXAMPLES.find((e) => e.key === "muenster")!;
    expect(muenster.name).toBe("Parkhaus Stubengasse");
    for (const lang of LIVE_LANGS) {
      const q = t(lang, muenster.question, { name: "\u0000" });
      expect(q.split("\u0000"), lang).toHaveLength(2);
    }
    // every name an example carries is used by its question or its answer, in every language
    for (const e of LIVE_EXAMPLES) {
      for (const [k, v] of Object.entries(namesOf(e))) {
        for (const lang of LIVE_LANGS) {
          const marked = { ...e.values, ...Object.fromEntries(Object.keys(namesOf(e)).map((n) => [n, n === k ? "\u0000" : "x"])) };
          const both = t(lang, e.question, marked) + t(lang, `connectPage.live.${e.key}.a`, marked);
          expect(both.includes("\u0000"), `${lang}: ${e.key} never says ${v}`).toBe(true);
        }
      }
    }
  });

  it("say the honest limits in every language, each in its own words", () => {
    for (const k of KEYS) {
      for (const part of ["note", "q", "a", "title"] as const) {
        const key = `connectPage.live.${k}.${part}` as const;
        const seen = new Map<string, string>();
        for (const lang of LIVE_LANGS) {
          const e = LIVE_EXAMPLES.find((x) => x.key === k)!;
          const s = t(lang, key, { ...e.values, ...namesOf(e) });
          expect(seen.get(s), `${lang}: ${key} is ${seen.get(s)}'s text`).toBeUndefined();
          seen.set(s, lang);
        }
      }
    }
    // the Land-road note is the coverage sentence: the Länder named (pinned against the registry below)
    expect(t("de", "connectPage.live.landroad.note")).toMatch(/Landesstraßen kennen wir in Baden-Württemberg, Niedersachsen und Thüringen, Staatsstraßen in Sachsen/);
    // unknown is never said as working or free
    expect(t("de", "connectPage.live.lift.note")).toMatch(/nie „in Betrieb“/);
    // (the charger card that said it moved off in 1.9.15; the register card says it now)
    expect(t("de", "connectPage.live.lsr.note")).toMatch(/nie „frei“/);
  });

  it("name exactly the Länder whose roadworks feed the registry carries, in every language (1.8.2 audit)", () => {
    // A Land roadworks feed is `roadworks_ald_<land>`, titled "… in <Land> (<authority>)". The coverage
    // note (Land roads; the federal-road card moved off in v1.8.16) must name every such Land in every language — so a Land feed
    // added to the registry fails here until the copy says so, and a Land dropped from the copy fails too.
    const LAND: Readonly<Record<string, Readonly<Record<(typeof LIVE_LANGS)[number], string>>>> = {
      Niedersachsen: { de: "Niedersachsen", en: "Lower Saxony", ru: "Нижней Саксонии", bg: "Долна Саксония", uk: "Нижній Саксонії", ro: "Saxonia Inferioară", tr: "Aşağı Saksonya", ...webPinned((p) => p.lands.Niedersachsen) },
      Sachsen: { de: "Sachsen", en: "Saxony", ru: "Саксонии", bg: "Саксония", uk: "Саксонії", ro: "Saxonia", tr: "Saksonya", ...webPinned((p) => p.lands.Sachsen) },
      Thüringen: { de: "Thüringen", en: "Thuringia", ru: "Тюрингии", bg: "Тюрингия", uk: "Тюрингії", ro: "Turingia", tr: "Thüringen", ...webPinned((p) => p.lands.Thüringen) },
    };
    const feeds = MOBILITHEK_FEEDS.filter((f) => /^roadworks_ald_[a-z]{2}$/.test(f.key));
    const covered = feeds.map((f) => /\bin (\S+) \(/u.exec(f.title)?.[1]).sort();
    expect(covered, "a Land roadworks feed whose title names no Land").not.toContain(undefined);
    expect(covered).toEqual(Object.keys(LAND).sort());
    for (const key of ["landroad"] as const) {
      for (const lang of LIVE_LANGS) {
        // Each Land's name is taken out once found: "Sachsen" is inside "Niedersachsen" (and so in every
        // language), so the longer name is matched first and Sachsen must still be there after it.
        let rest = t(lang, `connectPage.live.${key}.note`);
        for (const land of Object.keys(LAND).sort((a, b) => LAND[b]![lang].length - LAND[a]![lang].length)) {
          const name = LAND[land]![lang];
          expect(rest.includes(name), `${lang}: connectPage.live.${key}.note does not name ${land} ("${name}")`).toBe(true);
          rest = rest.replace(name, " ");
        }
      }
    }
  });

  it("say the BEMaS sites as production answered them, credited to BEMaS alone, in every language (#488, re-asked #746)", () => {
    const e = LIVE_EXAMPLES.find((x) => x.key === "bwroad")!;
    expect([...e.credits]).toEqual(["bemas_bw"]);
    expect(e.recheck).toBeUndefined();
    const a = (lang: (typeof LIVE_LANGS)[number]): string => t(lang, "connectPage.live.bwroad.a", { ...e.values, ...namesOf(e) });
    expect(a("de")).toBe("4 von 11 Arbeitsstellen in Baden-Württemberg, etwa Stuttgart – Heilbronn: neue Fahrbahndecke vom 15.06.2025 bis 12.12.2026.");
    expect(a("en")).toBe("4 of 11 sites are in Baden-Württemberg, e.g. Stuttgart – Heilbronn: a new road surface from 15.06.2025 to 12.12.2026.");
    for (const lang of LIVE_LANGS) expect(a(lang).length, lang).toBeLessThanOrEqual(140);
    // The catalogue carries the steward's line (DL-DE BY 2.0, "bearbeitet") the card renders.
    expect(catalogue.credits.find((c) => c.id === "bemas_bw")?.text).toMatch(/Datenlizenz Deutschland – Namensnennung – Version 2\.0.*bearbeitet$/);
  });

  it("carry the share-alike licence in the credit line and its licence link, never in the copy (#377 D4 rule 1)", () => {
    // The deck may not name a licence (legal-strings.test.ts); the credit line
    // the example prints names it verbatim, and the catalogue carries the link
    // to the licence text that ConnectPage renders beside it.
    const credit = (id: string) => catalogue.credits.find((c) => c.id === id);
    expect(credit("delfi_rt_sa")?.text).toContain("CC BY-SA 4.0");
    expect(credit("delfi_rt_sa")?.licence?.url).toBe("https://creativecommons.org/licenses/by-sa/4.0/");
    expect(credit("delfi_siri_et")?.text).toContain("CC BY-SA");
    expect(credit("delfi_siri_et")?.licence).not.toBeNull();
    for (const lang of LIVE_LANGS) {
      for (const k of KEYS) expect(t(lang, `connectPage.live.${k}.note`), `${lang}: ${k}`).not.toMatch(/CC BY|CC0/);
    }
  });

  it("names every value still waiting for a production answer — and invents none", () => {
    expect([...pendingValues()].sort()).toEqual([...STILL_PENDING].sort());
    // a value that is not the marker must look like a figure read off an answer, never left blank
    for (const e of LIVE_EXAMPLES) for (const [k, v] of Object.entries(e.values)) if (v !== TODO_VALUE) expect(v.trim(), `${e.key}.${k}`).not.toBe("");
  });

  it("names every example read off a recording, to be re-checked against production after the deploy", () => {
    expect([...recheckAfterDeploy()].sort()).toEqual([...RECHECK_AFTER_DEPLOY].sort());
    // and every example carries the date its figures describe
    for (const e of LIVE_EXAMPLES) expect(e.values["asOf"], e.key).toMatch(/^\d\d\.\d\d\.\d{4}, \d\d:\d\d$/);
  });
});

/**
 * The data steward's ruling on #454 (C1, 2026-10-06): a message under the RVWD
 * condition — "Der Meldungstext wird ungekürzt und nur aktuell wiedergegeben" —
 * may not be shown reworded. Which sources bind their text is read from the
 * catalogue (a credit flagged `verbatim`, the register's `currentAndUnabridged`),
 * not typed here, so a second such source is guarded the day its register row
 * says so. Until #487 this read "a credit carrying a `condition`", which was the
 * same set while BW's was the only condition; KVB's no-warranty sentence is a
 * condition that binds no wording, so the rule now reads the flag that says so.
 */
const VERBATIM_BOUND: readonly string[] = catalogue.credits.filter((c) => c.verbatim).map((c) => c.id);

/** Every way an example breaks the verbatim rule, by key and language. Empty when none does. */
function verbatimViolations(examples: readonly LiveExample[]): string[] {
  const out: string[] = [];
  for (const e of examples) {
    const bound = e.credits.filter((id) => VERBATIM_BOUND.includes(id));
    if (bound.length === 0) continue;
    const v = e.verbatim?.trim() ?? "";
    if (v === "") {
      out.push(`${e.key}: credits ${bound.join(", ")} but carries no verbatim message`);
      continue;
    }
    for (const lang of LIVE_LANGS) {
      const a = t(lang, `connectPage.live.${e.key}.a`, { ...e.values, ...namesOf(e) });
      if (!a.includes(v)) out.push(`${e.key} (${lang}): the answer is not the publisher's message, verbatim`);
    }
  }
  return out;
}

describe("a source whose terms bind the message text is quoted verbatim or not at all (#454 C1)", () => {
  it("the catalogue names the bound sources, and Baden-Württemberg is one", () => {
    expect(VERBATIM_BOUND).toContain("mobilithek_traffic_bw");
  });

  it("no example on the page breaks the rule", () => {
    expect(verbatimViolations(LIVE_EXAMPLES)).toEqual([]);
  });

  it("refuses the example that was there: the A6 jam, reworded, and the same with a verbatim text the answers do not carry", () => {
    // MUTANTS, run inline so the guard is proved on every run: the shape of the
    // 2026-10-05 card (a BW credit, the answer reworded in seven languages).
    const motorway = LIVE_EXAMPLES.find((e) => e.key === "motorway")!;
    const reworded: LiveExample = { ...motorway, credits: ["mobilithek_traffic_bw"] };
    expect(verbatimViolations([reworded])).toEqual(["motorway: credits mobilithek_traffic_bw but carries no verbatim message"]);
    const quotedNowhere: LiveExample = {
      ...reworded,
      verbatim: "A6 Mannheim Richtung Heilbronn zwischen Dreieck Hockenheim und Kreuz Walldorf 6 km Stau",
    };
    expect(verbatimViolations([quotedNowhere])).toHaveLength(LIVE_LANGS.length);
  });
});

/**
 * The data steward's conditions on the reworded Kiel card (#473, ruling of 2026-10-06, option (a)): the
 * Landesmeldestelle Schleswig-Holstein's messages are to be shown unabridged, so a summary is allowed only if
 * it carries every content element of the message, says it is a summary, and is withdrawn when the message ends.
 */
describe("the Kiel card: a summary that keeps every element of the message (#473)", () => {
  type Lang = (typeof LIVE_LANGS)[number];
  const kiel = LIVE_EXAMPLES.find((e) => e.key === "kiel")!;
  const vars = { ...kiel.values, ...namesOf(kiel) };
  const card = (lang: Lang): string => `${t(lang, kiel.question, vars)} ${t(lang, "connectPage.live.kiel.a", vars)}`;
  /** Per language: closed, and why (the sewer works). 2.5.4: the city of Kiel's closure replaced the ended ferry message. */
  const WORDS: Record<Lang, { out: string; why: string }> = {
    de: { out: "gesperrt", why: "Kanalbauarbeiten" },
    en: { out: "closed", why: "sewer works" },
    ru: { out: "перекрыт", why: "канализации" },
    bg: { out: "затворен", why: "канализацията" },
    uk: { out: "перекрито", why: "каналізації" },
    ro: { out: "închis", why: "canalizare" },
    tr: { out: "kapalı", why: "kanalizasyon" },
    ...webPinned((p) => ({ out: p.kielOut, why: p.kielWhy })),
  };
  /** Every way the card loses an element of the message, by language. Empty when none does. */
  function missing(read: (lang: Lang) => string): string[] {
    const out: string[] = [];
    for (const lang of LIVE_LANGS) {
      const c = read(lang);
      const w = WORDS[lang];
      for (const el of ["Lorentzendamm", "14", "Dahlmannstraße", "02.11.2026", "27.11.2026", w.out, w.why]) {
        if (!c.includes(el)) out.push(`${lang}: ${el}`);
      }
    }
    return out;
  }

  it("names the street, the house number, the cross street, both dates, that it is closed and why, in every language", () => {
    expect(kiel.values).toMatchObject({ no: "14", from: "02.11.2026", to: "27.11.2026" });
    expect(namesOf(kiel)).toEqual({ street: "Lorentzendamm", b: "Dahlmannstraße" });
    expect(missing(card)).toEqual([]);
  });

  it("goes red when one language drops the reason (mutant, run inline)", () => {
    const dropped = (lang: Lang): string => (lang === "ro" ? card(lang).replace("canalizare", "lucrări") : card(lang));
    expect(missing(dropped)).toEqual(["ro: canalizare"]);
  });

  it("says, in every language, that it is a summary and the tool shows the message in full — and the note agrees", () => {
    const SUMMARY: Record<Lang, string> = {
      de: "(Beispiel, zusammengefasst; im Werkzeug ungekürzt)",
      en: "(Example, summarised; the tool shows it in full)",
      ru: "(Пример, в кратком изложении; инструмент показывает сообщение полностью)",
      bg: "(Пример, обобщено; инструментът показва съобщението изцяло)",
      uk: "(Приклад, стисло; інструмент показує повідомлення повністю)",
      ro: "(Exemplu, rezumat; instrumentul îl arată integral)",
      tr: "(Örnek, özetlenmiştir; araç bildirimi eksiksiz gösterir)",
      ...webPinned((p) => p.summary),
    };
    for (const lang of LIVE_LANGS) expect(t(lang, "connectPage.live.kiel.a", vars), lang).toContain(SUMMARY[lang]);
    // The note under the card may not claim the CARD is unabridged: it says the card summarises, the tool does not.
    expect(t("de", "connectPage.live.kiel.note")).toContain("Diese Karte fasst eine Meldung zusammen; das Werkzeug zeigt ihre Meldungen ungekürzt");
    expect(t("de", "connectPage.live.kiel.note")).not.toMatch(/ViaFrei zeigt ihre Meldungen ungekürzt/);
    expect(t("en", "connectPage.live.kiel.note")).toContain("This card summarises one message; the tool shows them unabridged");
  });

  it("is withdrawn once the closure has ended: shown up to its stated last day, gone from that instant on", () => {
    // The constant is the example's own last day (the register gives a date, no hour: the card holds to 23:59 that day,
    // CET), so moving one without the other fails here first.
    const [d, m, y] = kiel.values["to"]!.split(".");
    expect(KIEL_CARD_EXPIRES.getTime()).toBe(new Date(`${y}-${m}-${d}T23:59:00+01:00`).getTime());
    expect(CARD_EXPIRES.kiel).toBe(KIEL_CARD_EXPIRES);
    expect(shownAt(KIEL_CARD_EXPIRES, -1)).toContain("kiel");
    expect(shownAt(KIEL_CARD_EXPIRES, 0)).not.toContain("kiel");
  });
});

describe("the Berlin card: a city-street message found by place, confirmed on production v1.8.10 (#474)", () => {
  const card = LIVE_EXAMPLES.find((e) => e.key === "citywork")!;

  it("names the question production was asked, with the answer's own Stand and no recheck flag", () => {
    expect(card.tool).toBe("check_road_status");
    expect(card.recheck).toBeUndefined();
    expect(card.values["asOf"]).toBe("02.11.2026, 14:10");
    expect(card.names).toEqual({ street: "Schiffbauerdamm", a: "Luisenstraße", b: "Albrechtstraße" });
    expect(t("de", card.question, { ...card.values, ...namesOf(card) })).toBe("Ist am Schiffbauerdamm in Berlin etwas gesperrt?");
    // the note promises what v1.8.10 does: by place, nearest first
    expect(t("de", "connectPage.live.citywork.note")).toMatch(/die nächste zuerst/);
  });

  it("is withdrawn once the works have ended: shown up to their stated end, gone from that instant on", () => {
    const [d, m, y] = card.values["to"]!.split(".");
    // 2.5.4: the works now end on 31.08.2028, in summer time (CEST)
    expect(CITYWORK_CARD_EXPIRES.getTime()).toBe(new Date(`${y}-${m}-${d}T17:00:00+02:00`).getTime());
    expect(CARD_EXPIRES.citywork).toBe(CITYWORK_CARD_EXPIRES);
    expect(shownAt(CITYWORK_CARD_EXPIRES, -1)).toContain("citywork");
    expect(shownAt(CITYWORK_CARD_EXPIRES, 0)).not.toContain("citywork");
  });
});

describe("the closure card: an A7 closure near Hamburg, re-asked of production on 2026-11-02 (2.5.4)", () => {
  const card = LIVE_EXAMPLES.find((e) => e.key === "closure")!;

  it("names the question production was asked, with the answer's own Stand and no recheck flag", () => {
    expect(card.tool).toBe("check_road_status");
    expect(card.recheck).toBeUndefined();
    expect(card.credits).toEqual(["autobahn"]);
    // 2.5.4: the Maschener Kreuz closure was gone; the answer's closure near Hamburg is a ramp on the Altonatunnel works
    expect(card.values).toEqual({ until: "31.10.2027", end: "05:00", asOf: "18.11.2026, 14:28" });
    expect(card.names).toEqual({ at: "Hamburg-Bahrenfeld", a: "HH-Volkspark", b: "HH-Othmarschen" });
    const vars = { ...card.values, ...namesOf(card) };
    expect(t("de", card.question, vars)).toBe("Ist auf der A7 bei Hamburg gerade etwas gesperrt?");
    expect(t("de", "connectPage.live.closure.a", vars)).toBe(
      "Ja: die Autobahn GmbH meldet eine gesperrte Rampe an der Anschlussstelle Hamburg-Bahrenfeld – auf der Baustrecke zwischen HH-Volkspark und HH-Othmarschen. Diese Bauphase endet am 31.10.2027 um 05:00 Uhr.",
    );
  });

  it("says no more than the answer did, and every figure in every language", () => {
    const vars = { ...card.values, ...namesOf(card) };
    for (const lang of LIVE_LANGS) {
      const a = t(lang, "connectPage.live.closure.a", vars);
      for (const el of ["Hamburg-Bahrenfeld", "HH-Volkspark", "HH-Othmarschen", "31.10.2027", "05:00", "Autobahn GmbH"]) expect(a, `${lang}: ${el}`).toContain(el);
      // the A1 card this replaced said "full closure" and "structural work"; the A7 answer says neither
      expect(t(lang, card.question, vars), lang).toContain("A7");
    }
    expect(t("de", "connectPage.live.closure.a", vars)).not.toMatch(/Vollsperrung|Bauwerk/);
    expect(t("en", "connectPage.live.closure.a", vars)).not.toMatch(/full closure|structural/);
  });

  it("is withdrawn once this construction phase has ended: shown up to its stated end, gone from that instant on", () => {
    const [d, m, y] = card.values["until"]!.split(".");
    // 31.10.2027 05:00 is after that night's change back to CET
    expect(CLOSURE_CARD_EXPIRES.getTime()).toBe(new Date(`${y}-${m}-${d}T${card.values["end"]}:00+01:00`).getTime());
    expect(CARD_EXPIRES.closure).toBe(CLOSURE_CARD_EXPIRES);
    expect(shownAt(CLOSURE_CARD_EXPIRES, -1)).toContain("closure");
    expect(shownAt(CLOSURE_CARD_EXPIRES, 0)).not.toContain("closure");
  });
});

/**
 * #746 (owner 2026-10-15: "restore every removed example"): the connect page renders EVERY card. The rotation that
 * kept 25 under the 100 KB budget is gone with the cap, because the page limit is 500 KB since #742
 * (`scripts/budget.ts`), and the cards that had moved off are back.
 */
describe("the connect page renders every card, no cap and no rotation (#746)", () => {
  const connect = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "..", "src", "layouts", "ConnectPage.astro"), "utf8");
  const liveCard = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "..", "src", "components", "LiveCard.astro"), "utf8");

  it("renders the whole list through the one card component — every card but a retired fuel example (Verdict 2)", () => {
    // #1179 under FS-2026-11-06: the open cards and the folded ones are one split of the whole list (`splitFold`)
    expect(connect).toContain("const cards = splitFold(liveCards, EXAMPLES_OPEN, (e) => e.credits);");
    expect(connect).toContain('cards.open.map((e) => <LiveCard lang={lang} e={e} source="connect" />)');
    expect(connect).toContain('cards.folded.map((e) => <LiveCard lang={lang} e={e} source="connect" />)');
    expect(connect).not.toMatch(/connectCards|CONNECT_CARD_CAP/);
    expect(CONNECT_EXAMPLES.map((e) => e.key)).toEqual(LIVE_EXAMPLES.map((e) => e.key).filter((k) => k !== "fuelland"));
  });

  it("the seven cards that had rotated off are back", () => {
    const keys = new Set<string>(LIVE_EXAMPLES.map((e) => e.key));
    for (const k of ["charger", "carpark", "lorry", "roadworks", "train", "fuelroad", "fuelland"]) expect(keys.has(k), k).toBe(true);
  });

  it("keeps at least one card per domain: transit, parking, charging, fuel and roads", () => {
    const domains = new Set(LIVE_EXAMPLES.map((e) => e.domain));
    for (const d of DOMAINS) expect(domains.has(d), d).toBe(true);
  });

  it("prints the ODbL § 4.6 offer under the Trucklounge card, and under no card for an address lookup alone (data-steward C2)", () => {
    expect(liveCard).toContain("offerHtml(lang, e.credits.filter((id) => ODBL_DATABASES[id] !== undefined))");
    const lorry = LIVE_EXAMPLES.find((e) => e.key === "lorry")!;
    expect(lorry.credits).toEqual(expect.arrayContaining(["mobilithek_park_trucklounge", "mobilithek_park_trucklounge_occ"]));
    expect(lorry.name).toBe("Trucklounge Ecopark");
  });
});

/**
 * The data steward's rulings on #487 (the KVB lift feed) and #486 (the bike card): the transport company's short mark
 * appears in no human-readable text of these cards, in any language — the publisher is named in full,
 * "Kölner Verkehrs-Betriebe AG", the mode is "Stadtbahn" — and the publisher's no-warranty sentence is said in every
 * language. The bike card is Kiel's (Donkey Republic), so the bike system's Köln name never reaches the page.
 */
describe("the v1.8.16 cards: the Stadtbahn lifts (#487) and the shared bikes (#486)", () => {
  type Lang = (typeof LIVE_LANGS)[number];
  const card = (k: string): LiveExample => LIVE_EXAMPLES.find((e) => e.key === k)!;
  const PARTS = ["title", "q", "a", "note"] as const;
  /** Every human-readable text a card puts on the page in `lang`: its deck strings with names filled, its names, its credit lines. */
  const texts = (e: LiveExample, lang: Lang): string[] => [
    ...PARTS.map((p) => t(lang, `connectPage.live.${e.key}.${p}`, { ...e.values, ...namesOf(e) })),
    ...Object.values(namesOf(e)),
    ...e.credits.flatMap((id) => {
      const c = catalogue.credits.find((x) => x.id === id)!;
      return [c.text, c.condition ?? ""];
    }),
  ];
  /** Every text of a card that carries the short mark, by language. Empty when none does. */
  const marks = (e: LiveExample): string[] => LIVE_LANGS.flatMap((lang) => texts(e, lang).filter((s) => /kvb/i.test(s)).map((s) => `${lang}: ${s}`));
  const answer = (e: LiveExample, lang: Lang): string => t(lang, `connectPage.live.${e.key}.a`, { ...e.values, ...namesOf(e) });
  const WARRANTY: Record<Lang, string> = {
    de: "Die Kölner Verkehrs-Betriebe AG stellt die Daten ohne jede Gewähr bereit.",
    en: "Kölner Verkehrs-Betriebe AG provides the data without any warranty.",
    ru: "Kölner Verkehrs-Betriebe AG предоставляет данные без каких-либо гарантий.",
    bg: "Kölner Verkehrs-Betriebe AG предоставя данните без каквато и да е гаранция.",
    uk: "Kölner Verkehrs-Betriebe AG надає дані без жодних гарантій.",
    ro: "Kölner Verkehrs-Betriebe AG furnizează datele fără nicio garanție.",
    tr: "Kölner Verkehrs-Betriebe AG verileri hiçbir garanti vermeden sağlar.",
    ...webPinned((p) => p.kvbWarranty),
  };

  it("the Stadtbahn card is production's answer, credited exactly as answered", () => {
    const e = card("stadtbahn");
    expect(e.tool).toBe("check_station_facilities");
    expect([...e.credits].sort()).toEqual(["delfi_zhv", "kvb_lifts"]);
    // 2.5.4: a fourth escalator was out when re-asked, so the sentence carries a fourth figure
    expect(e.values).toEqual({ out: "4", total: "10", e1: "51", e2: "52", since: "06.10., 17:32", e3: "62", since3: "31.10., 03:01", e4: "53", since4: "31.10., 20:21", asOf: "02.11.2026, 14:02" });
    expect(e.recheck).toBeUndefined();
    expect(answer(e, "de")).toBe(
      "4 von 10 gemeldeten Anlagen: die Fahrtreppen 51 und 52, gemeldet seit 06.10., 17:32, 62 seit 31.10., 03:01 und 53 seit 31.10., 20:21; beide Aufzüge in Betrieb. Die Kölner Verkehrs-Betriebe AG stellt die Daten ohne jede Gewähr bereit.",
    );
  });

  it("no text of the Stadtbahn card carries the short mark, in any language — the publisher in full, the mode Stadtbahn", () => {
    const e = card("stadtbahn");
    expect(marks(e)).toEqual([]);
    for (const lang of LIVE_LANGS) expect(answer(e, lang), lang).toContain("Kölner Verkehrs-Betriebe AG");
    for (const lang of ["de", "en"] as const) {
      expect(t(lang, "connectPage.live.stadtbahn.title"), lang).toContain("Stadtbahn");
      expect(t(lang, e.question, { ...e.values, ...namesOf(e) }), lang).toContain("Stadtbahn");
    }
  });

  it("carries the publisher's no-warranty sentence in every language — the German as the register writes it", () => {
    const e = card("stadtbahn");
    for (const lang of LIVE_LANGS) expect(answer(e, lang), lang).toContain(WARRANTY[lang]);
    expect(catalogue.credits.find((c) => c.id === "kvb_lifts")?.condition).toBe(WARRANTY.de);
  });

  it("the mark check can say no: a card naming the publisher by its short mark is red in every language (mutant, run inline)", () => {
    const e = card("stadtbahn");
    const red = marks({ ...e, names: { ...e.names, publisher: "KVB" } });
    expect(new Set(red.map((s) => s.split(":")[0]))).toEqual(new Set(LIVE_LANGS));
  });

  it("the bike card is Kiel's, from Donkey Republic, credited exactly as answered — no mark and no city of the Köln company", () => {
    const e = card("bikes");
    expect(e.tool).toBe("find_sharing");
    expect([...e.credits].sort()).toEqual(["db_stada", "gbfs_donkey"]);
    expect(namesOf(e)).toEqual({ station: "Kiel Hbf", dock: "Hauptbahnhof", operator: "Donkey Republic" });
    expect(e.values).toEqual({ free: "5", docks: "8", radius: "1", asOf: "18.11.2026, 14:27" });
    expect(marks(e)).toEqual([]);
    for (const lang of LIVE_LANGS) for (const s of texts(e, lang)) expect(s, lang).not.toMatch(/K(ö|oe)ln|Cologne|Кельн|Кёльн|Кьолн/u);
    expect(answer(e, "de")).toBe(
      "Station Hauptbahnhof von Donkey Republic: 5 Räder frei – und 8 Stationen im Umkreis von 1 km, jede mit ihrem Bestand.",
    );
  });
});

describe("the fuel reasons say why one asks, never a statistic (data-steward Verdict 2, conditions 3 and 4)", () => {
  /** A digit followed by a cent word, in each of the seven languages' spellings. */
  const CENT_FIGURE = /\d\s*(?:cent|ct\b|цент|сент|sent|cenț|cenţ)/iu;
  const reasons = (lang: (typeof LIVE_LANGS)[number]): [string, string][] => [
    ...FUEL_ASKS.map((a): [string, string] => [`day.fuelAsks.${a.key}.why`, t(lang, `day.fuelAsks.${a.key}.why`, a.answer.values)]),
    ...LIVE_EXAMPLES.filter((e) => e.credits.includes("tankerkoenig")).map((e): [string, string] => [`connectPage.live.${e.key}.note`, t(lang, `connectPage.live.${e.key}.note` as never, e.values)]),
  ];

  it("no fuel reason or card note carries a figure in cents, in any language", () => {
    for (const lang of LIVE_LANGS) for (const [k, s] of reasons(lang)) expect(s, `${lang} ${k}`).not.toMatch(CENT_FIGURE);
  });

  it("the check can say no: the 2.1.24 Görlitz reason, and each language's spelling (mutants, run inline)", () => {
    for (const s of ["lagen 7 Cent je Liter auseinander", "were 7 cents a litre apart", "разошлись на 7 центов", "с 7 цента", "на 7 центів", "au fost 7 cenți", "7 sent fark", "10 ct"]) expect(s).toMatch(CENT_FIGURE);
  });

  it("no fuel answer names a second station: the answer as the tool gave it, one station each", () => {
    for (const a of FUEL_ASKS) expect(Object.keys(a.answer.names ?? {}).sort(), a.key).toEqual(["address", "station"]);
    // and no copy keeps a placeholder for a second station or a computed figure, in any language
    for (const lang of LIVE_LANGS)
      for (const a of FUEL_ASKS) {
        const copy = ["why", "a"].map((f) => deck(lang)[`day.fuelAsks.${a.key}.${f}`] ?? "").join(" ");
        expect(copy.match(/\{(?:station2|address2|euro2|cent2|c|same)\}/g) ?? [], `${lang} ${a.key}`).toEqual([]);
      }
  });
});


describe("#473: an ended card is withdrawn by the clock, never left saying the past is now", () => {
  it("before any stated end every card is shown; past the last one only the cards without an end", () => {
    const ends = Object.values(CARD_EXPIRES).map((d) => d.getTime());
    expect(ends.length).toBeGreaterThanOrEqual(3);
    expect(connectExamples(new Date(Math.min(...ends) - 1)).map((e) => e.key)).toEqual(CONNECT_EXAMPLES.map((e) => e.key));
    const after = connectExamples(new Date(Math.max(...ends)));
    expect(after.map((e) => e.key)).toEqual(CONNECT_EXAMPLES.filter((e) => CARD_EXPIRES[e.key] === undefined).map((e) => e.key));
  });

  it("every card with an end is a card of the file", () => {
    for (const k of Object.keys(CARD_EXPIRES)) expect(LIVE_EXAMPLES.map((e) => e.key), k).toContain(k);
  });
});
