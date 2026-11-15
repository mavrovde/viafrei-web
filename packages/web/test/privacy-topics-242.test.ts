/**
 * Review A of the 2.4.2 cut: the Datenschutz statements about the topic filter
 * (#1050), the two card events (#938, #939) and the station pages (#1041),
 * each pinned to the code that makes it true. The privacy notice is German
 * only (it is the binding text every language's Datenschutz page renders), so
 * there is one copy to pin.
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { ANALYTICS_PAGES, MEASURED_DYNAMIC_PAGES } from "../src/site/pages.js";
import { filterCopy } from "../src/lib/motorway-filter.js";
import { RETIRED_BOARD_KEY, TOPICS_STORE, topicBarHtml, topicsScript, type TopicCard } from "../src/lib/topic-filter.js";

const CARDS: readonly TopicCard[] = [
  { id: "roads", title: "Straßen", attention: false },
  { id: "fuel", title: "Tanken", attention: false },
];
import { EVENTS, REFRESH_HOWS, REFRESH_RESULTS } from "../src/analytics/events.js";

const REPO = new URL("../../../", import.meta.url);
const read = (rel: string): string => readFileSync(new URL(rel, REPO), "utf8");
const flat = (s: string): string => s.replace(/<[^>]+>/gu, "").replace(/\s+/gu, " ");
const src = read("packages/web/src/components/LegalPrivacy.astro");
const themen = flat(src.slice(src.indexOf('<h3 id="themen">'), src.indexOf('<h3 id="ort">')));
const s5 = src.slice(src.indexOf("<h2>5. Google Analytics — nur mit Ihrer Einwilligung</h2>"), src.indexOf('<p id="ga-ereignisse">'));

describe("Themenauswahl (#1050): the buttons it names exist", () => {
  it("names „Auswahl merken“ and „Nicht mehr merken“, the de copy of the real buttons, and no „vergessen“ button", () => {
    const c = filterCopy("de");
    expect(c.save).toBe("Auswahl merken");
    expect(c.forget).toBe("Nicht mehr merken");
    expect(themen).toContain(`Nur wenn Sie „${c.save}“ anklicken, speichert Ihr Browser die Auswahl zusätzlich`);
    expect(themen).toContain(`Er bleibt, bis Sie „${c.forget}“ anklicken`);
    expect(themen).not.toContain("„vergessen“");
    expect(themen).not.toContain("„merken“");
    // the bar renders exactly these two labels as buttons
    const bar = topicBarHtml("de", CARDS, null, "/");
    expect(bar).toContain(`>${c.save}</button>`);
    expect(bar).toContain(`>${c.forget}</button>`);
    expect(TOPICS_STORE).toBe("viafrei.topics");
  });
});

describe("Themenauswahl: what reaches whom", () => {
  it("(b) with JavaScript a choice is a pushState: the server sees it only when a page with that address is loaded", () => {
    expect(themen).toContain("Sie erreicht unseren Server, wenn eine Seite mit dieser Adresse geladen wird");
    expect(themen).not.toContain("Sie erreicht damit unseren Server");
    expect(topicsScript("de")).toContain("pushState");
  });

  it("(a) Google never gets the topics: page views carry no query, history changes are not measured (G5.7), place pages are unmeasured", () => {
    expect(themen).toContain("Google erreicht sie auch dann nicht, wenn Sie Google Analytics zugestimmt haben");
    expect(themen).toContain("Gemessen wird nur die Startseite, nie eine Ortsseite");
    // the facts behind it
    const consent = read("packages/web/src/components/Consent.svelte");
    expect(consent).toMatch(/gtag\("config", tag, \{ send_page_view: false, page_location: cleanLocation\(window\.location\.href\)/);
    expect(ANALYTICS_PAGES).toContain("start");
    expect(MEASURED_DYNAMIC_PAGES).not.toContain("start");
    expect(read("packages/web/src/layouts/PlacePage.astro")).not.toMatch(/measure=\{true\}/);
    // the form names the page's own address only, never the chosen topics
    expect(topicBarHtml("de", CARDS, ["roads"], "/")).toMatch(/<form class="tpf" id="tpf" method="get" action="\/"/);
    // § 5 says the same in its list of processed data, modelled on the motorway item
    expect(flat(s5)).toContain(
      "auf der Startseite die Seitenadresse ohne die gewählten Themen der Themenauswahl — weder beim Laden der Seite noch wenn Sie die Auswahl danach ändern, und auf den Ortsseiten, wo dieselbe Auswahl steht, wird nicht gemessen (siehe „Themenauswahl“),",
    );
  });

  it("(c) the retired key goes on the next load of the home or a place page — the two pages that run the topics script", () => {
    expect(themen).toContain(`Ein älterer Eintrag der früheren Auswahl „Mein Tag“ (Schlüssel ${RETIRED_BOARD_KEY}) wird beim nächsten Aufruf der Startseite oder einer Ortsseite gelöscht.`);
    expect(themen).not.toContain("wird beim nächsten Besuch gelöscht");
    expect(topicsScript("de")).toContain(JSON.stringify(RETIRED_BOARD_KEY));
    expect(read("packages/web/src/layouts/Home.astro")).toContain("PlaceBlock");
    expect(read("packages/web/src/layouts/PlacePage.astro")).toContain("PlaceBlock");
  });
});

describe("§ 5: the card events (#938, #939) are declared", () => {
  it("one item names card_more's and card_refresh's parameters and what they never carry", () => {
    expect(EVENTS).toContain("card_more");
    expect(EVENTS).toContain("card_refresh");
    expect([...REFRESH_HOWS]).toEqual(["manual", "auto"]);
    expect([...REFRESH_RESULTS]).toEqual(["changed", "unchanged"]);
    expect(flat(s5)).toContain(
      "wenn Sie bei einer Karte weitere Einträge laden oder sie aktualisieren: welche Art von Karte, der wievielte Schritt, von Hand oder automatisch (Stichprobe) und ob sich der Inhalt geändert hat — nie, was die Karte zeigt, und nie Ihr Ort,",
    );
  });
});

describe("§ 5: the business and developer page events (#992) are declared", () => {
  it("one item per event names its parameters and what it never carries", () => {
    expect(EVENTS).toContain("cta_business_click");
    expect(EVENTS).toContain("dev_copy");
    expect(flat(s5)).toContain(
      "auf der Seite für Unternehmen, welchen der Knöpfe Sie anklicken (Pilotprojekt, Kontakt oder Live-Antwort) — nie die E-Mail-Adresse, und ob Sie danach eine Nachricht schreiben, erfährt die Seite nicht,",
    );
    expect(flat(s5)).toContain("auf der Seite für Entwickler, dass Sie eine Konfiguration oder einen curl-Befehl kopiert haben und aus welchem Reiter — nie, was kopiert wurde,");
  });
});

describe("§ 5: the station pages (#1041) are named among the unmeasured", () => {
  it("names them, and the code agrees: no map row measured, the layout passes no measure flag", () => {
    expect(flat(src)).toContain(
      "Das Impressum, diese Erklärung, die Fehlerseite, die Ortsseiten, die Kraftstoffseite, die Übersicht der Bahnhöfe und die Seite jedes Bahnhofs enthalten keine Analyse.",
    );
    expect(ANALYTICS_PAGES).not.toContain("stations");
    expect(MEASURED_DYNAMIC_PAGES).not.toContain("stations");
    expect(read("packages/web/src/layouts/StationPage.astro")).not.toMatch(/measure=\{true\}/);
  });
});
