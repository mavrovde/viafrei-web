/**
 * #1050: the topic filter of the place cards on the home and the place pages — the same control as the motorway
 * pages' layer filter (#983): one box per card labelled with the card's own heading, "Alle" / "Keine" named in full,
 * a GET form whose choice is the address, a sent form with nothing ticked says so with its way back, a hidden card
 * that needs attention stays named, and nothing is stored before the "merken" click. The browser half is
 * `e2e/topic-filter-1050.e2e.ts`.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { all, text as nodeText } from "@viafrei/design/testing";
import { describe, expect, it } from "vitest";
import { PLACE_CARD_IDS as DIGEST_IDS } from "../../digest/src/analysis/place.js";
import { PLACE_CARD_IDS, RETIRED_BOARD_KEY, TOPICS_JS, TOPICS_STORE, applyTopics, barAfterFirst, isFilteredView, topicBarHtml, topicCardsOf, topicSumHtml, topicsOf, topicsQuery, topicsScript } from "../src/lib/topic-filter.js";
import { filterCopy } from "../src/lib/motorway-filter.js";
import { LIVE_LANGS } from "../src/site/pages.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const src = (...p: string[]): string => readFileSync(join(HERE, "..", "src", ...p), "utf8");

/** A fragment in the digest's card shape (`packages/digest/src/presentation/place-tiles.ts` line of `<article class="pcard`). */
const card = (id: string, title: string, verdict = "info"): string =>
  `<article class="pcard pcard--${verdict}" id="pcard-${id}" aria-labelledby="pcard-${id}-t"><header class="pcard__head"><h3 class="pcard__title" id="pcard-${id}-t"><span class="pcard__icon" aria-hidden="true">⚠️</span> ${title}</h3></header><p>…</p></article>`;
const FRAG = `<section class="place" id="place-cards"><div class="place__cards">${card("warnings", "Warnungen", "attention")}${card("roads", "Straßen &amp; Baustellen")}${card("fuel", "Tanken")}${card("parking", "Parken")}</div></section>`;
const PATH = "/de/place/kehl";
const q = (s: string): URLSearchParams => new URLSearchParams(s);

describe("the topics are the digest's cards", () => {
  it("the ids are the digest's PLACE_CARD_IDS, in its order (this package imports no database package, so the list is restated and pinned)", () => {
    expect([...PLACE_CARD_IDS]).toEqual([...DIGEST_IDS]);
  });
  it("the digest still prints the shape the filter reads: the article's class and id, the h3 title and its icon span", () => {
    const tiles = readFileSync(join(HERE, "..", "..", "digest", "src", "presentation", "place-tiles.ts"), "utf8");
    expect(tiles).toContain('`<article class="pcard pcard--${c.verdict}" id="pcard-${c.id}"');
    expect(tiles).toContain('<h3 class="pcard__title" id="pcard-${c.id}-t"><span class="pcard__icon" aria-hidden="true">');
  });
  it("each box is labelled with the card's OWN heading, the icon left out and entities read back", () => {
    expect(topicCardsOf(FRAG)).toEqual([
      { id: "warnings", title: "Warnungen", attention: true },
      { id: "roads", title: "Straßen & Baustellen", attention: false },
      { id: "fuel", title: "Tanken", attention: false },
      { id: "parking", title: "Parken", attention: false },
    ]);
    const bar = topicBarHtml("de", topicCardsOf(FRAG), null, PATH);
    expect(all(bar, "span.tpf__name").map(nodeText)).toContain("Straßen & Baustellen");
    expect(bar).not.toContain("⚠️");
  });
});

describe("the choice is the address", () => {
  it("no parameter is every topic; a list keeps the known ids in card order; a sent form with nothing ticked is none", () => {
    expect(topicsOf(q(""))).toBeNull();
    expect(topicsOf(q("topics=parking,roads,bogus"))).toEqual(["parking", "roads"]);
    expect(topicsOf(q("topics=fuel&topics=roads&f=1"))).toEqual(["fuel", "roads"]);
    expect(topicsOf(q("f=1"))).toEqual([]);
    expect(topicsOf(q("topics=bogus"))).toBeNull();
  });
  it("the query of a choice round-trips, and every topic is the bare address", () => {
    for (const c of [[], ["roads"], ["fuel", "parking"]] as const) expect(topicsOf(q(topicsQuery(c).slice(1)))).toEqual(c);
    expect(topicsQuery(null)).toBe("");
    expect(topicsQuery(PLACE_CARD_IDS)).toBe("");
  });
  it("a filtered view is noindex: the home and the place page say so, their canonical is the unfiltered page's", () => {
    expect(isFilteredView(q("topics=roads"))).toBe(true);
    expect(isFilteredView(q("f=1"))).toBe(true);
    expect(isFilteredView(q("r=auto"))).toBe(false);
    const home = src("layouts", "Home.astro");
    expect(home).toContain('robots={filtered ? "noindex, follow" : undefined}');
    const place = src("layouts", "PlacePage.astro");
    expect(place).toContain('robots={opened || filtered ? "noindex, noarchive" : "noarchive"}');
    // the canonical is `dynamic.path`, the page's own path, never the filtered address
    expect(place).toContain("path: placePath(lang, slug)");
    // #1081 D2: a charging filter (`ev_*`) is a filtered view too
    expect(src("pages", "[lang]", "place", "[slug].astro")).toContain("filtered={isFilteredView(Astro.url.searchParams) || hasChargingFilter(Astro.url.searchParams)}");
  });
});

describe("the control, the same as the motorway pages' (#983)", () => {
  const bar = topicBarHtml("de", topicCardsOf(FRAG), ["fuel"], PATH);
  it("a GET form to the page itself, one checkbox per card named `topics`, a fieldset with its legend", () => {
    expect(bar).toMatch(/^<form class="tpf" id="tpf" method="get" action="\/de\/place\/kehl">/);
    expect(all(bar, 'fieldset.tpf__set legend.tpf__legend[id="tpf-l"]').map(nodeText)).toEqual(["Themen"]);
    expect([...bar.matchAll(/<input type="checkbox" name="topics" value="([a-z]+)"( checked)?>/g)].map((m) => `${m[1] ?? ""}${m[2] ?? ""}`)).toEqual(["warnings", "roads", "fuel checked", "parking"]);
    expect(all(bar, 'input[type="hidden"][name="f"][value="1"]')).toHaveLength(1);
  });
  it('"Alle" and "Keine" are links with #983\'s full names for a screen reader, "merken" is hidden until the script runs', () => {
    const f = filterCopy("de");
    expect(new Set(all(bar, `a.tpf__all[href="${PATH}"][aria-label="${f.allLabel}"]`).map(nodeText))).toEqual(new Set([f.all]));
    expect(all(bar, `a.tpf__none[href="${PATH}?f=1"][aria-label="${f.noneLabel}"]`).map(nodeText)).toEqual([f.none]);
    expect(bar).toMatch(/<button type="button" class="btn btn--sm tpf__save" hidden>/);
  });
  it("the cards the choice leaves out are hidden in the no-script render, and the count is told", () => {
    const html = applyTopics(FRAG, ["fuel"]);
    expect([...html.matchAll(/id="pcard-([a-z]+)"( aria-labelledby="[^"]*")?( hidden)?/g)].length).toBe(4);
    expect(html).toContain('id="pcard-roads" hidden');
    expect(html).not.toContain('id="pcard-fuel" hidden');
    expect(applyTopics(FRAG, null)).toBe(FRAG);
    expect(topicSumHtml("de", topicCardsOf(FRAG), ["fuel"])).toBe('<p class="tpf__sum visually-hidden" id="tpf-sum" aria-live="polite">1 von 4 Themen angezeigt</p>');
  });
  it("nothing ticked is one sentence with its way back, never an empty page", () => {
    const none = topicBarHtml("de", topicCardsOf(FRAG), [], PATH);
    expect(none).toMatch(/<p class="tpf__nothing" id="tpf-nothing">Keine Themen gewählt\. <span class="all-none"><a class="all-none__opt tpf__all" href="\/de\/place\/kehl"/);
    expect(bar).toMatch(/<p class="tpf__nothing" id="tpf-nothing" hidden>/);
  });
  it("a hidden card that needs attention now stays named in a chip that shows it — and only that one", () => {
    expect(bar).toMatch(/<p class="tpf__alerts" id="tpf-alerts">/);
    expect([...bar.matchAll(/class="chip tpf__alert" href="([^"]+)" data-topic="([a-z]+)">([^<]+)</g)].map((m) => [m[1], m[2], m[3]])).toEqual([
      ["/de/place/kehl?topics=fuel,warnings", "warnings", "Ausgeblendet, aber jetzt wichtig: Warnungen – anzeigen"],
    ]);
    // the mutant: an attention card that is chosen is no chip, and a card without attention never is
    expect(topicBarHtml("de", topicCardsOf(FRAG), ["warnings"], PATH)).toMatch(/<p class="tpf__alerts" id="tpf-alerts" hidden><\/p>/);
    expect(topicBarHtml("de", topicCardsOf(FRAG.replace("pcard--attention", "pcard--info")), ["fuel"], PATH)).not.toContain("tpf__alert\"");
  });
  it("a page without cards prints the form hidden, and the count empty", () => {
    expect(topicBarHtml("de", [], null, PATH)).toMatch(/^<form class="tpf" id="tpf" method="get" action="[^"]+" hidden>/);
    expect(topicSumHtml("de", [], null)).toBe('<p class="tpf__sum visually-hidden" id="tpf-sum" aria-live="polite"></p>');
  });
  it("PlaceBlock prints the bar after the fragment's first block when it carries one (#1194), else before the slot; the hidden cards in the slot and the count right after it", () => {
    const block = src("components", "PlaceBlock.astro").replace(/\s+/g, " ");
    expect(block).toContain("const bar = topicBarHtml(lang, cards, topics, path);");
    expect(block).toContain("const cardsHtml = place === null ? \"\" : keepChoicesInChargingForm(applyTopics(place.html, topics), Astro.url.searchParams);");
    expect(block).toContain("const firstBar = place === null ? null : barAfterFirst(cardsHtml, bar);");
    expect(block).toMatch(/\{firstBar === null && <Fragment set:html=\{bar\} \/>\} <div class="place-slot" id="place-slot"[^>]*>\{place !== null \? <Fragment set:html=\{firstBar \?\? cardsHtml\} \/>/);
    expect(block).toMatch(/<\/div> <Fragment set:html=\{topicSumHtml\(lang, cards, topics\)\} \/>/);
    expect(block).not.toMatch(/mday|Mein Tag/);
  });
});

describe("the copy, in every language", () => {
  it("each language names the legend, the button, nothing chosen, the count and the attention chip", () => {
    for (const lang of LIVE_LANGS) {
      const bar = topicBarHtml(lang, topicCardsOf(FRAG), [], PATH);
      expect(bar, lang).not.toMatch(/place\.topics\./);
      expect(topicSumHtml(lang, topicCardsOf(FRAG), ["fuel"]), lang).toMatch(/1.*4|4.*1/);
      expect(topicsScript(lang), lang).not.toMatch(/place\.topics\./);
    }
  });
});

describe("the script stores nothing before the click", () => {
  it("its only storage write is inside the 'merken' handler; it removes the retired Mein Tag key; it never sends the choice", () => {
    const writes = [...TOPICS_JS.matchAll(/localStorage\.setItem\(/g)];
    expect(writes.length).toBe(1);
    const saveHandler = /save\.addEventListener\("click", function \(\) \{[^\n]*localStorage\.setItem\(C\.store/.exec(TOPICS_JS);
    expect(saveHandler).not.toBeNull();
    expect(TOPICS_JS).toContain("window.localStorage.removeItem(C.retired)");
    expect(TOPICS_JS).not.toMatch(/fetch\(|sendBeacon|XMLHttpRequest/);
    // no address in the script's text: a crawler reads `href="` anywhere in the page as a link (#1026 crawl, measured: two 404s)
    expect(TOPICS_JS).not.toContain('href="');
    expect(TOPICS_STORE).toBe("viafrei.topics");
    expect(RETIRED_BOARD_KEY).toBe("viafrei.board");
    const cfg = JSON.parse(/\)\((\{.*\})\);$/.exec(topicsScript("de"))?.[1] ?? "null") as { ids: string[]; store: string };
    expect(cfg.ids).toEqual([...PLACE_CARD_IDS]);
    expect(cfg.store).toBe(TOPICS_STORE);
  });
  it("the address follows the choice with pushState, and the back button applies the one before (popstate)", () => {
    expect(TOPICS_JS).toContain("window.history.pushState({ topics: chosen }");
    expect(TOPICS_JS).toContain('window.addEventListener("popstate"');
  });
});

describe("the retired topic 'pois' (#1117): read through, never rewritten", () => {
  const SEVEN = ["groceries", "health", "money", "food", "lodging", "garage", "police", "toilets"];
  it("an address naming it opens the seven need cards; one without it leaves them off", () => {
    expect(topicsOf(q("topics=pois,roads"))).toEqual(["roads", ...SEVEN]);
    expect(topicsOf(q("topics=pois"))).toEqual(SEVEN);
    expect(topicsOf(q("topics=roads"))).toEqual(["roads"]);
  });
  it("the browser half reads a stored or linked 'pois' the same way, from the map the server ships", () => {
    const cfg = JSON.parse(/\)\((\{.*\})\);$/.exec(topicsScript("de"))?.[1] ?? "null") as { ids: string[]; retiredTopics: Record<string, string[]> };
    expect(cfg.retiredTopics).toEqual({ pois: SEVEN, safety: ["police", "toilets"] });
    const line = /var known = (function \(a\) \{.*\});$/mu.exec(TOPICS_JS)?.[1] ?? "";
    // eslint-disable-next-line @typescript-eslint/no-implied-eval, @typescript-eslint/no-unsafe-call -- running the shipped script is the point
    const known = new Function("ids", "retired", `return ${line};`)(cfg.ids, cfg.retiredTopics) as (a: string[]) => string[];
    expect(known(["pois", "roads", "bogus"])).toEqual([...SEVEN, "roads"]);
    expect(known(["roads"])).toEqual(["roads"]);
    // owner 2026-11-02: a choice saved with the one "Polizei & WC" card opens both of its successors
    expect(known(["safety"])).toEqual(["police", "toilets"]);
  });
  it("a linked 'safety' (the one police-and-toilets card, split 2026-11-02) opens the police and the toilets cards", () => {
    expect(topicsOf(q("topics=safety,roads"))).toEqual(["roads", "police", "toilets"]);
  });
});

describe("#1194: the topics come after the status and the first item", () => {
  const FIRST = '<div class="pagefirst" id="page-first"><p class="statusline" id="place-status">…</p><div class="pagefirst__now"><p>first</p></div></div><!--/page-first-->';
  const HOME = `<section class="place" id="place-cards"><h2 class="place__title">Für Köln</h2>${FIRST}<div class="place__cards">${card("fuel", "Tanken")}</div></section>`;
  it("puts the bar right after the first block's end mark, its nested boxes and all", () => {
    const out = barAfterFirst(HOME, "<form id=\"tpf\"></form>");
    expect(out).toBe(HOME.replace("<!--/page-first-->", '<!--/page-first--><form id="tpf"></form>'));
    expect(out!.indexOf('id="place-status"')).toBeLessThan(out!.indexOf('id="tpf"'));
    expect(out!.indexOf('id="tpf"')).toBeLessThan(out!.indexOf('id="pcard-fuel"'));
  });
  it("a fragment without the block (a place page, a station, the placeholder) is null: the bar stays before the slot", () => {
    expect(barAfterFirst(FRAG, "<form></form>")).toBeNull();
    expect(barAfterFirst('<div class="place-fill place-fill--loading"></div>', "<form></form>")).toBeNull();
  });
  it("the script keeps that place when the island swaps the cards, and stands before the slot without the block", () => {
    expect(TOPICS_JS).toContain('var f = slot.querySelector("#page-first"); if (f) { if (f.nextElementSibling !== form) f.after(form); } else if (!form.isConnected) slot.before(form);');
    expect(TOPICS_JS).toMatch(/var apply = function \(\) \{\n {4}at\(\);/);
  });
});
