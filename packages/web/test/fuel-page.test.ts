/**
 * The fuel page's words, as the data steward ruled on 2026-10-06 (C1–C3, C5):
 * the title names the stations and the selection, not "prices by Land"; the
 * lead says before the board how the selection is made; the home's link
 * states the bound instead of promising "all"; nothing calls a price
 * "current"; and only the fuel page asks search engines not to archive it.
 * Pinned verbatim in all seven languages, so a reworded line is a decision
 * someone takes on purpose.
 */
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { FUEL_BOARD_PER_LAND } from "@viafrei/digest";
import { webPinned } from "./lang-pins.js";
import { describe, expect, it } from "vitest";
import { t } from "../src/i18n/index.js";
import { LIVE_LANGS, type Lang } from "../src/site/pages.js";

const OLD_CURRENT = /aktuell|current|текущ|актуал|поточн|actual|güncel/i;
const OLD_ALL = /^(Alle|All|Все|Всички|Усі|Toate|Tüm)\b/;
const escapeRe = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
/** A language's own "current" and "all" (#753, test/lang-pins.ts); the seven of #235 by the old two patterns. */
const NEW_WORDS = webPinned((p) => ({ current: new RegExp(escapeRe(p.current), "iu"), all: new RegExp(`^${escapeRe(p.all)}`, "iu") }));
const wordsOf = (lang: Lang): { current: RegExp; all: RegExp } => (NEW_WORDS as Readonly<Record<string, { current: RegExp; all: RegExp }>>)[lang] ?? { current: OLD_CURRENT, all: OLD_ALL };

const TITLES: Readonly<Record<Lang, string>> = {
  de: "Tankstellen je Bundesland – eine Auswahl mit Preisen",
  en: "Filling stations by state – a selection with prices",
  ru: "АЗС по федеральным землям — выборка с ценами",
  bg: "Бензиностанции по провинции – подбор с цени",
  uk: "АЗС за федеральними землями — добірка з цінами",
  ro: "Benzinării pe landuri – o selecție cu prețuri",
  tr: "Eyaletlere göre akaryakıt istasyonları – fiyatlı bir seçki",
  ...webPinned((p) => p.fuelTitle),
};

/** Four things, before the board: up to three per Land; cheapest E10 first; chosen from the stations we observe, so not necessarily a Land's cheapest; every price with its time. */
const LEADS: Readonly<Record<Lang, string>> = {
  de: "Je Bundesland bis zu drei Tankstellen, das günstigste Super E10 zuerst. Ausgewählt aus den Tankstellen, die wir beobachten – also nicht unbedingt die günstigsten im Land. Jeder Preis steht mit der Uhrzeit, zu der wir ihn beobachtet haben. Eine Information für Verbraucherinnen und Verbraucher, keine Liste aller Tankstellen.",
  en: "Up to three filling stations per state, cheapest Super E10 first. Chosen from the stations we observe – so not necessarily the cheapest in the state. Every price is shown with the time we observed it. Information for consumers, not a list of every filling station.",
  ru: "До трёх АЗС в каждой федеральной земле, сначала самый дешёвый бензин E10. Они выбраны из АЗС, за которыми мы наблюдаем, — поэтому это не обязательно самые дешёвые в земле. Каждая цена указана со временем, когда мы её наблюдали. Информация для потребителей, а не список всех АЗС.",
  bg: "До три бензиностанции във всяка провинция, първо най-евтиният бензин E10. Избрани са от бензиностанциите, които наблюдаваме – затова не непременно най-евтините в провинцията. Всяка цена е показана с часа, в който сме я наблюдавали. Информация за потребителите, а не списък на всички бензиностанции.",
  uk: "До трьох АЗС у кожній федеральній землі, спершу найдешевший бензин E10. Їх обрано з АЗС, за якими ми спостерігаємо, — тож це не обов’язково найдешевші в землі. Кожну ціну наведено з часом, коли ми її спостерігали. Інформація для споживачів, а не перелік усіх АЗС.",
  ro: "Până la trei benzinării în fiecare land, întâi cea mai ieftină benzină E10. Alese dintre benzinăriile pe care le observăm – deci nu neapărat cele mai ieftine din land. Fiecare preț apare cu ora la care l-am observat. Informare pentru consumatori, nu o listă a tuturor benzinăriilor.",
  tr: "Her eyalette en fazla üç istasyon, en ucuz Süper E10 önce. Gözlediğimiz istasyonlar arasından seçilmiştir – yani eyaletin en ucuzları olmayabilir. Her fiyat, gözlediğimiz saatle birlikte gösterilir. Tüketicilere yönelik bir bilgi, tüm istasyonların listesi değildir.",
  ...webPinned((p) => p.fuelLead),
};

describe("the fuel page's words (data-steward ruling 2026-10-06)", () => {
  it("C1: the title names the stations and the selection, verbatim in all seven languages, never 'current'", () => {
    for (const lang of LIVE_LANGS) {
      expect(t(lang, "fuelPage.title"), lang).toBe(TITLES[lang]);
      expect(TITLES[lang], lang).not.toMatch(wordsOf(lang).current);
    }
  });

  it("the 'three' the seven leads and links promise is the board's constant (review S3)", () => {
    expect(
      FUEL_BOARD_PER_LAND,
      "FUEL_BOARD_PER_LAND changed: fuelPage.lead and day.fuelAll say 'three' in seven languages — change the disclosure with it, and ask the data steward first (condition 1 of the 2026-10-05 ruling)",
    ).toBe(3);
    expect(t("de", "fuelPage.lead")).toContain("bis zu drei");
    expect(t("de", "day.fuelAll")).toContain("bis zu drei");
    expect(t("en", "fuelPage.lead")).toContain("Up to three");
  });

  it("#1182 ruling 2026-11-08 B2: the board's visible heading states the bound in every language — the lead's own opening words — never 'current' or 'all'", () => {
    expect(t("de", "fuelPage.boardHead")).toBe("Je Bundesland bis zu drei Tankstellen");
    expect(t("en", "fuelPage.boardHead")).toBe("Up to three filling stations per state");
    for (const lang of LIVE_LANGS) {
      const v = t(lang, "fuelPage.boardHead");
      expect(v.length, lang).toBeGreaterThan(10);
      expect(v, lang).not.toBe(t(lang, "fuelPage.title"));
      expect(LEADS[lang].startsWith(v), `${lang}: the heading is the lead's first words`).toBe(true);
      expect(v, lang).not.toMatch(wordsOf(lang).current);
      expect(v, lang).not.toMatch(wordsOf(lang).all);
    }
  });

  it("N3/N5: the back link and the not-available line are the page's own words, in all seven languages, never 'current'", () => {
    for (const lang of LIVE_LANGS) {
      for (const key of ["fuelPage.back", "fuelPage.unavailable"] as const) {
        const v = t(lang, key);
        expect(v.length, `${lang} ${key}`).toBeGreaterThan(5);
        expect(v, `${lang} ${key}`).not.toMatch(wordsOf(lang).current);
      }
    }
    expect(t("de", "fuelPage.unavailable")).toBe("Die Liste der Tankstellen je Bundesland ist gerade nicht verfügbar.");
  });

  it("C2: the lead states the selection rule before the board, verbatim in all seven languages, never 'current'", () => {
    for (const lang of LIVE_LANGS) {
      expect(t(lang, "fuelPage.lead"), lang).toBe(LEADS[lang]);
      expect(LEADS[lang], lang).not.toMatch(wordsOf(lang).current);
      // the bound and the grade are in it, in every language
      expect(LEADS[lang], lang).toMatch(/E10/);
    }
  });

  it("C3: the home's link and the page's words state the bound and never promise 'all'", () => {
    for (const lang of LIVE_LANGS) {
      for (const key of ["day.fuelAll", "fuelPage.title", "fuelPage.lead"] as const) {
        const v = t(lang, key);
        expect(v, `${lang} ${key}`).not.toMatch(wordsOf(lang).all);
        expect(v, `${lang} ${key}`).not.toMatch(wordsOf(lang).current);
      }
    }
    expect(t("de", "day.fuelAll")).toBe("Je Bundesland bis zu drei Tankstellen mit Adresse und Preis");
  });

  it("C5: only the fuel page and the place pages pass noarchive; a motorway VARIANT passes noindex (#716) and the bare motorway page nothing (M28)", () => {
    const src = join(dirname(fileURLToPath(import.meta.url)), "..", "src");
    const astro = (dir: string): string[] =>
      readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? astro(join(dir, e.name)) : e.name.endsWith(".astro") ? [join(dir, e.name)] : []));
    const users = astro(src).filter((f) => /<Base\b[^>]*\brobots=/.test(readFileSync(f, "utf8")));
    expect(users.map((f) => f.slice(src.length + 1)).sort()).toEqual(["layouts/ConnectPage.astro", "layouts/FuelPage.astro", "layouts/Home.astro", "layouts/MotorwayPage.astro", "layouts/MotorwaysPage.astro", "layouts/PlacePage.astro", "layouts/RoadPage.astro", "layouts/SearchPage.astro", "layouts/StationPage.astro", "layouts/StationsPage.astro", "pages/[lang]/station/[slug]/stop/[stop].astro"]);
    // #1043 (c): a stop around a station is a view of the station page, `noindex, follow` (no Tankerkönig datum, so no noarchive)
    expect(readFileSync(join(src, "pages", "[lang]", "station", "[slug]", "stop", "[stop].astro"), "utf8")).toContain('robots="noindex, follow"');
    // #1111: the site search's result page is never indexed (it holds no Tankerkönig datum, so no noarchive)
    expect(readFileSync(join(src, "layouts", "SearchPage.astro"), "utf8")).toContain('robots="noindex, follow"');
    // #1050: a home filtered by topic (`?topics=`, `?f=1`) is a variant, `noindex, follow` with the bare home canonical; the bare home carries no directive.
    expect(readFileSync(join(src, "layouts", "Home.astro"), "utf8")).toContain('robots={filtered ? "noindex, follow" : undefined}');
    // #716: a stretch/direction/layer variant is `noindex, follow` with the bare page canonical; the bare page carries no directive (open to every crawler, no noarchive — M28).
    // #1025: an exit page (a bare `exit-…` segment, no query) takes the digest's exit rule — `index` only over live content.
    const mw = readFileSync(join(src, "layouts", "MotorwayPage.astro"), "utf8");
    // #1188: an exit page's junction block carrying the fuel frame (or still loading) adds noarchive, as a station page's
    expect(mw).toContain('const indexable = exitPage ? head.robots === "index, follow" : !variant;');
    expect(mw).toContain('const robots = indexable ? (archive ? "noarchive" : undefined) : archive ? "noindex, follow, noarchive" : "noindex, follow";');
    expect(mw).toContain('const archive = aroundArea !== undefined && ((aroundArea.kind === "ok" && aroundArea.html.includes(\'id="pcard-fuel"\')) || aroundArea.kind === "loading");');
    expect(mw).toContain("robots={robots}");
    // #1110 item 3: the connect page carrying a subject (`?about=`, `?road=`) is a variant; the bare page carries no directive.
    expect(readFileSync(join(src, "layouts", "ConnectPage.astro"), "utf8")).toContain('robots={asksAbout(params) ? "noindex, follow" : undefined}');
    // #716 C1: the index searched or re-ordered is a variant too; the bare index carries no directive.
    expect(readFileSync(join(src, "layouts", "MotorwaysPage.astro"), "utf8")).toContain('robots={variant ? "noindex, follow" : undefined}');
    // #1027: a road page takes the digest's rule — `index` only while something is in force or ended within seven days; it holds no Tankerkönig datum, so no noarchive.
    expect(readFileSync(join(src, "layouts", "RoadPage.astro"), "utf8")).toContain('const robots = head.robots === "noindex, follow" ? "noindex, follow" : undefined;');
    // #1041: the station catalogue searched or one Land's list is a variant too; the bare catalogue carries no directive (and no noarchive).
    expect(readFileSync(join(src, "layouts", "StationsPage.astro"), "utf8")).toContain('robots={variant ? "noindex, follow" : undefined}');
    // #1042: one station's page filtered (a platform, a mode) is a variant as well; the bare page carries no directive — it holds no Tankerkönig datum.
    // #1081 D2: a station page whose charging list is filtered (`ev_*`) is a variant kept out of every archive too.
    // #1084: a station page whose place cards carry the fuel card (the Tankerkönig board, deferred) is kept out of every
    // archive like a place page; the station page without one carries no directive.
    const st = readFileSync(join(src, "layouts", "StationPage.astro"), "utf8");
    // 2.4.6: a page whose static part is its loading frame is `noindex, follow` like a variant (the next crawl sees the
    // page), and cards still loading may bring the fuel card in place, so they are kept out of every archive as well.
    expect(st).toContain('robots={variant || loading.static ? (archive ? "noindex, follow, noarchive" : "noindex, follow") : archive ? "noarchive" : undefined}');
    expect(st).toContain(`const archive = noarchive || (area.kind === "ok" && area.html.includes('id="pcard-fuel"')) || area.kind === "loading";`);
    expect(readFileSync(join(src, "pages", "[lang]", "station", "[slug].astro"), "utf8")).toContain("noarchive={hasChargingFilter(Astro.url.searchParams)}");
    expect(readFileSync(join(src, "layouts", "FuelPage.astro"), "utf8")).toContain('robots="noarchive"');
    // A place page carries the Tankerkönig board as a card (#564): the same condition 4, the same directive.
    // #1061: a no-script page with a card's next pages opened in place (`?open=`) is a variant, noindex as well
    expect(readFileSync(join(src, "layouts", "PlacePage.astro"), "utf8")).toContain('robots={opened || filtered ? "noindex, noarchive" : "noarchive"}');
  });
});
