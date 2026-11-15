import { describe, expect, it } from "vitest";
import { FUEL_BOARD_PER_LAND } from "@viafrei/digest";
import { readFileSync } from "node:fs";
import { AROUND_BLOCK, BOARD_STATIONS, ENERGY_PAGES, EXIT_PAGE, ENERGY_RAW_MAX, LIMITS, MOTORWAY_PROFILE, MOTORWAY_ROADS, PLACE_FILTER_QUERY, PLACE_PAGE, PLACE_PAGE_FILTERED, RUNGS, STATION_PAGE, crossingsOffProfile, crossingsShape, inspect, judge, lighterThanProfile, motorwayCards, motorwayPlan, subresources, type Measured } from "../scripts/budget.js";
import { LIVE_LANGS } from "../src/site/pages.js";
import { AUTOHOF_POINTS, autohofChargingPage, autohofFuelPage } from "../e2e/energy-autohof.js";
import { ENERGY_POINTS_SHOWN, renderChargingPage, renderFuelPage } from "../../../.pinned/app/packages/digest/dist/src/presentation/energy-page-html.js";
import { chargingFilterBarHtml, chargingFilterSummaryHtml, chargingNoMatchHtml } from "../../../.pinned/app/packages/digest/dist/src/cards/charging/filter-html.js";
import { chargingCard } from "../../../.pinned/app/packages/digest/dist/src/cards/charging/judge.js";
import { chargingFilterOf, type ChargingFacetRow } from "@viafrei/ingest";
import { all } from "@viafrei/design/testing";

const ok: Measured = { path: "/de", status: 200, rawHtml: 30_000, gzipTotal: 13_000, requests: 2, thirdParty: [], page: "start", errorTiles: 0, boardStations: 0, scripts: 1, analytics: 0, island: true };
const fuel: Measured = { ...ok, path: "/de/fuel", page: "fuel", boardStations: BOARD_STATIONS, scripts: 5, analytics: 0, island: false };

describe("page-weight gate (#381 item 2) — planted failures", () => {
  it("passes a page inside every limit", () => {
    expect(judge([ok]).code).toBe(0);
  });
  // #1064: the gzip budget is 200 KB since the owner decision of 2026-10-25 ("Increase the budget to 200"; 80 KB since #891).
  it("the gzip budget is 200 KB: a 210 KB gzip page is red and named, a 190 KB one is within it", () => {
    expect(LIMITS.gzipTotal).toBe(200 * 1024);
    const v = judge([ok, { ...ok, path: "/en", gzipTotal: 210 * 1024 }]);
    expect(v.code).toBe(1);
    expect(v.lines.join("\n")).toMatch(/\/en: gzip total 215040 B/);
    expect(judge([{ ...ok, gzipTotal: 190 * 1024 }]).code).toBe(0);
    expect(judge([{ ...ok, gzipTotal: LIMITS.gzipTotal }]).code).toBe(1);
    expect(judge([ok]).lines.join("\n")).toContain("gzip < 200 KB");
  });
  it("raw HTML over the limit (700 KB since 2.4.3) is red", () => {
    expect(judge([{ ...ok, rawHtml: LIMITS.rawHtml + 1 }]).code).toBe(1);
  });
  it("a third request is red", () => {
    expect(judge([{ ...ok, requests: 3 }]).code).toBe(1);
  });
  it("a third-party request is red", () => {
    const v = judge([{ ...ok, thirdParty: ["https://fonts.example/x.css"] }]);
    expect(v.code).toBe(1);
    expect(v.lines[0]).toMatch(/third-party/);
  });
  it("no page measured is exit 2, never a pass (§5b)", () => {
    expect(judge([]).code).toBe(2);
  });
  it("a page that did not answer is exit 2", () => {
    expect(judge([ok, { ...ok, status: 502 }]).code).toBe(2);
  });
  // v1.8.18 (review S1): three ways a page weighs LESS than production's, each "could not check"
  it("a content page with an error tile is exit 2 and named — a tile that did not render is not weighed", () => {
    const v = judge([ok, { ...ok, path: "/ru", errorTiles: 1 }]);
    expect(v.code).toBe(2);
    expect(v.lines.join("\n")).toMatch(/\/ru carries 1 error tile/);
    expect(judge([{ ...ok, path: "/de/404", page: "404", status: 404, errorTiles: 0 }]).code).toBe(0);
  });
  it("a fuel page without every Land at the board's bound is exit 2 — 16 × FUEL_BOARD_PER_LAND, never fewer or more", () => {
    expect(BOARD_STATIONS).toBe(16 * FUEL_BOARD_PER_LAND);
    expect(judge([ok, fuel]).code).toBe(0);
    for (const n of [0, 6, BOARD_STATIONS - 1, BOARD_STATIONS + 1]) {
      const v = judge([ok, { ...fuel, boardStations: n }]);
      expect(v.code, String(n)).toBe(2);
      expect(v.lines.join("\n")).toMatch(new RegExp(`/de/fuel carries ${String(n)} board stations`));
    }
  });
  it("a 404 from any page but the 404 page is exit 2; the 404 page's own 404 is not", () => {
    expect(judge([ok, { ...fuel, status: 404 }]).code).toBe(2);
    expect(judge([{ ...ok, status: 404 }]).code).toBe(2);
    expect(judge([ok, { ...ok, path: "/en/404", page: "404", status: 404 }]).code).toBe(0);
  });
  it("a fuel page carrying an analytics script or the consent island is red (review S4: the page is not measured); the header's scripts are not analytics (#1198)", () => {
    expect(judge([{ ...fuel, analytics: 1 }]).code).toBe(1);
    expect(judge([{ ...fuel, scripts: 5 }]).code).toBe(0);
    const v = judge([{ ...fuel, island: true, analytics: 2 }]);
    expect(v.code).toBe(1);
    expect(v.lines[0]).toMatch(/analytics on the fuel page: 2 script\(s\), the consent island/);
    // the home may carry both: it is one of the four measured pages
    expect(judge([ok]).code).toBe(0);
  });
  it("reads the error tiles, the board stations, the scripts and the island off the HTML", () => {
    const html = '<section class="tile is-error" id="tile-x"></section><ul><li class="fuel-board__station"></li><li class="fuel-board__station fuel-board__station--older"></li></ul><astro-island uid="1"></astro-island><script nonce="n">1</script>';
    expect(inspect(html)).toEqual({ errorTiles: 1, boardStations: 2, scripts: 1, analytics: 0, island: true });
    expect(inspect('<p class="fuel-board__stations"></p>')).toEqual({ errorTiles: 0, boardStations: 0, scripts: 0, analytics: 0, island: false });
    // #1198: a script that loads or calls analytics is counted; a class name "vf-noclarity" is not
    expect(inspect('<div class="vf-noclarity"></div><script nonce="n">gtag("config","G-1")</script><script async src="https://www.googletagmanager.com/gtag/js?id=G-1"></script><script src="https://www.clarity.ms/tag/x"></script><script nonce="n">var a=1</script>').analytics).toBe(3);
    // #564: a panel that missed the deadline weighs nothing in the first HTML either — the gate cannot judge that page
    expect(inspect('<section class="tile is-loading" id="tile-fuel"></section><div class="place-fill place-fill--loading is-loading"></div>').errorTiles).toBe(2);
    // the JSON-LD data block of every page (#531) runs nothing: it is not a script the fuel rule counts
    expect(inspect('<script type="application/ld+json" nonce="n">{}</script>').scripts).toBe(0);
    expect(inspect('<script type="application/ld+json" nonce="n">{}</script><script nonce="n">1</script>').scripts).toBe(1);
  });
  it("finds stylesheets and scripts, including protocol-relative third parties", () => {
    const r = subresources('<link rel="stylesheet" href="/_a/site.1.css"><script type="module" src="//cdn.example/x.js"></script>');
    expect(r).toEqual({ css: ["/_a/site.1.css"], js: ["//cdn.example/x.js"] });
  });
});

/** #1064: a motorway card's header as the digest renders it (the h3 carries an id with the card's prefix). */
const card = (kind: string, n: number): string =>
  `<section class="pcard mwk" id="mwk-${kind}" aria-labelledby="mwk-${kind}-t"><header class="pcard__head mwk__head"><h3 class="pcard__title mwk__t" id="mwk-${kind}-t">x</h3><data class="mwk__n" value="${String(n)}">${String(n)} Einträge</data></header><ul><li>…</li></ul></section>`;
/** A motorway page whose every card is at production's profile, plus one card that carries no count (the fuel fragment). */
const atProfile = (): string => `<main id="motorway">${Object.entries(MOTORWAY_PROFILE.cards).map(([k, n]) => card(k, n)).join("")}<section class="pcard mwk" id="mwk-fuel"><p>Preise auf Klick</p></section></main>`;
const motorwayRow = (html: string, over: Partial<Measured> = {}): Measured => ({ ...ok, path: "/de/autobahn/a1 [A1] [ip]", page: "motorways", cards: motorwayCards(html), ...over });

describe("#1064: the motorway pages are measured at production's size", () => {
  it("the profile is production's, dated, with no card at zero", () => {
    expect(MOTORWAY_PROFILE.measured).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(MOTORWAY_PROFILE.pages).toEqual(["/de/autobahn/a1", "/de/autobahn/a3", "/de/autobahn/a7"]);
    const counts = Object.values(MOTORWAY_PROFILE.cards);
    expect(counts.length).toBeGreaterThanOrEqual(10);
    for (const n of counts) expect(n).toBeGreaterThan(0);
    // the three cards the fixture had no production-sized rows for (the root cause) are held
    for (const k of ["cities", "weather", "messages"]) expect(MOTORWAY_PROFILE.cards[k], k).toBeGreaterThan(0);
  });

  it("reads each card's count off its header — the h3's own id never cuts a card short; a card with no count is absent", () => {
    expect(motorwayCards(card("cities", 160) + card("jams", 3))).toEqual({ cities: 160, jams: 3 });
    // a card without a count does not borrow the next card's
    expect(motorwayCards(`<section id="mwk-fuel"><p>x</p></section>${card("jams", 3)}`)).toEqual({ jams: 3 });
    expect(motorwayCards("<main>no cards</main>")).toEqual({});
  });

  it("a page at production's profile is judged; one card below it is exit 2, named with both counts (M2: the floor)", () => {
    expect(lighterThanProfile(motorwayCards(atProfile()))).toEqual([]);
    expect(judge([motorwayRow(atProfile())]).code).toBe(0);
    const light = atProfile().replace(card("cities", MOTORWAY_PROFILE.cards["cities"]!), card("cities", 0));
    const v = judge([motorwayRow(light)]);
    expect(v.code).toBe(2);
    expect(v.lines.join("\n")).toContain(`/de/autobahn/a1 [A1] [ip] is lighter than production (${MOTORWAY_PROFILE.measured}): cities 0 < ${String(MOTORWAY_PROFILE.cards["cities"])}`);
    // a heavier fixture is never refused
    expect(judge([motorwayRow(atProfile().replace(card("jams", MOTORWAY_PROFILE.cards["jams"]!), card("jams", 99)))]).code).toBe(0);
  });

  it("a page that is the shell alone — no motorway fragment, no card — is exit 2, never a pass (M1: measuring only the shell)", () => {
    const shellOnly = motorwayRow('<main><p class="motorway__error">Die Autobahn konnte nicht geladen werden.</p></main>');
    const v = judge([shellOnly]);
    expect(v.code).toBe(2);
    for (const k of Object.keys(MOTORWAY_PROFILE.cards)) expect(v.lines.join("\n")).toContain(`${k} 0 < `);
  });

  it("measures the A1 and the A7 in every language, without a location and at the IP rung (M3)", () => {
    expect(MOTORWAY_ROADS).toEqual(["A1", "A7"]);
    const plan = motorwayPlan(LIVE_LANGS);
    expect(plan).toHaveLength(LIVE_LANGS.length * 4);
    for (const lang of LIVE_LANGS)
      for (const road of MOTORWAY_ROADS) {
        expect(plan.filter((m) => m.lang === lang && m.road === road).map((m) => m.ip), `${lang} ${road}`).toEqual([null, RUNGS[0].ip]);
      }
  });

  it("today's production A3, planted, is green under the 700 KB raw limit (2.4.3); 100 KB more raw is red; a page over the gzip limit too", () => {
    const a3 = motorwayRow(atProfile(), { path: "/de/autobahn/a3 [planted 2026-10-25]", rawHtml: 612_417, gzipTotal: 100_649 + 15_342 });
    expect(judge([a3]).code).toBe(0);
    const v = judge([{ ...a3, rawHtml: 612_417 + 110_000 }]);
    expect(v.code).toBe(1);
    expect(v.lines.join("\n")).toMatch(/a3 \[planted 2026-10-25\]: raw HTML 722417 B > 716800/);
    // under the raw limit and over the 200 KB gzip limit: red on gzip alone
    expect(judge([motorwayRow(atProfile(), { rawHtml: 480_000, gzipTotal: 200 * 1024 + 1 })]).code).toBe(1);
  });

  // cross-repo(viafrei-infra): production's compose file is viafrei-infra's
  it.skip("the measured shell carries production's own switches of the web service (the production compose file)", () => {});
});

describe("#1061: the crossings card is measured at production's shape — one or two motorways a crossing", () => {
  /** A crossings card of `per.length` rows, row i meeting `per[i]` motorways (the digest's markup: li#mwc-…, span.mwc__other). */
  const crossings = (per: readonly number[]): string =>
    `<section class="pcard mwk" id="mwk-crossings"><ul class="pcard__list mwc__list">${per.map((n, i) => `<li id="mwc-${String(i)}">AD ${"<span class=\"mwc__other\">A2</span>".repeat(n)}</li>`).join("")}</ul></section>`;

  it("the profile is production's A1: 29 rows, 31 links, at most 3 a row", () => {
    expect(MOTORWAY_PROFILE.crossings).toMatchObject({ rows: 29, links: 31, maxPerRow: 3 });
  });

  it("reads the shown rows and each row's links; no card is null", () => {
    expect(crossingsShape(crossings([1, 2, 1]))).toEqual({ rows: 3, links: [1, 2, 1] });
    expect(crossingsShape("<main></main>")).toBeNull();
    // #1032: the related motorways after the rows carry `.mwc__other` too and are no crossing's links
    const related = `<h4 class="mwrel__h">Verwandt</h4><ul class="mwrel__list">${'<li class="mwrel__row"><span class="mwc__other">A20</span></li>'.repeat(7)}</ul>`;
    expect(crossingsShape(crossings([1, 2, 1]).replace("</ul></section>", `</ul>${related}</section>`))).toEqual({ rows: 3, links: [1, 2, 1] });
  });

  it("12 rows of one or two is production's shape; fewer links than its rate, a row over 3, or no row is off — and the judge refuses it as 'could not check'", () => {
    expect(crossingsOffProfile(crossingsShape(crossings(Array.from({ length: 12 }, () => 1))))).toEqual([]);
    expect(crossingsOffProfile(crossingsShape(crossings([2, 1, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1])))).toEqual([]);
    expect(crossingsOffProfile(crossingsShape(crossings([0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1])))[0]).toContain("crossings links 11 < 12");
    // the #1048 fixture's shape: every crossing meeting ~15 motorways
    expect(crossingsOffProfile(crossingsShape(crossings(Array.from({ length: 12 }, () => 15))))).toEqual(["crossings row with 15 motorways > 3"]);
    expect(crossingsOffProfile(null)).toEqual(["crossings: no row shown"]);
    const heavy = crossings(Array.from({ length: 12 }, () => 15));
    const v = judge([motorwayRow(atProfile() + heavy, { crossings: crossingsShape(heavy) })]);
    expect(v.code).toBe(2);
    expect(v.lines.join("\n")).toContain("crossings row with 15 motorways > 3");
    expect(judge([motorwayRow(atProfile(), { crossings: crossingsShape(crossings(Array.from({ length: 12 }, () => 1))) })]).code).toBe(0);
  });
});

describe("#1083 AC 9: the station page is measured with its departure board", () => {
  it("refuses a station page whose board did not render, and a board that is not a table", () => {
    expect(STATION_PAGE.label).toBe(" [station page]");
    const nearby = '<section id="pcard-station-nearby"><svg class="stmap" viewBox="0 0 240 240"></svg><ol><li class="stlive__stop" id="stop-a"></li></ol><section class="stlive__roads"><h4>x</h4><ul class="stlive__roadlist"><li>y</li></ul></section></section>';
    expect(STATION_PAGE.expect.test('<section class="stlive" id="station-live"><div><table class="stpage__table pcard__board stlive__board"><tbody>' + nearby)).toBe(true);
    // #1043 (c): the page is measured with the stops around it; the card's empty state, or no road list, is refused
    expect(STATION_PAGE.expect.test('<section class="stlive" id="station-live"><div><table class="stpage__table pcard__board stlive__board"><tbody>')).toBe(false);
    expect(STATION_PAGE.expect.test('<section class="stlive" id="station-live"><table class="stlive__board">' + nearby.replace('<svg class="stmap"', "<svg"))).toBe(false);
    expect(STATION_PAGE.expect.test('<section class="stlive" id="station-live"><table class="stlive__board">' + nearby.replace('<ul class="stlive__roadlist">', ""))).toBe(false);
    expect(STATION_PAGE.expect.test('<section class="stlive" id="station-live"><p class="stlive__err">x</p></section>')).toBe(false);
    expect(STATION_PAGE.expect.test('<table class="stlive__board">')).toBe(false);
    expect(STATION_PAGE.expect.test('<section id="station-live"><table class="stlive__boardx">')).toBe(false);
  });
  it("the budget run measures one station page per language", () => {
    const src = readFileSync(new URL("../scripts/budget.ts", import.meta.url), "utf8");
    expect(src).toMatch(/for \(const lang of LIVE_LANGS\) rows\.push\(await measure\([^)]*"stations", stationPath\(lang, "koeln-hbf"\), cache, \{ \.\.\.STATION_PAGE, around: true \}\)\)/);
  });
  // #1188 AC 5: every object page is weighed WITH its around block — the station page, both energy pages and the exit page
  it("an object page without its around block is refused, never weighed lighter", () => {
    const src = readFileSync(new URL("../scripts/budget.ts", import.meta.url), "utf8");
    expect(src).toMatch(/energyPath\(e\.kind, lang, e\.slug\), cache, \{ label: e\.label, expect: e\.expect, rawMax: ENERGY_RAW_MAX, around: true \}/);
    // and the exit page, its junction's two directions first (the planted A4's AS Köln-Lövenich)
    expect(src).toMatch(/for \(const lang of LIVE_LANGS\) rows\.push\(await measure\([^)]*"motorways", `\$\{motorwayPath\(lang, EXIT_PAGE\.road\)\}\/\$\{EXIT_PAGE\.segment\}`, cache, \{ label: EXIT_PAGE\.label, expect: EXIT_PAGE\.expect, around: true \}\)\)/);
    expect(EXIT_PAGE.segment).toBe("exit-8-koeln-loevenich");
    const block = '<div class="placebar vf-noclarity" data-vf-around><div class="wrap"><div class="place-slot" id="place-slot"><section class="place" id="place-cards" aria-labelledby="place-title"><h2 class="place__title" id="place-title">In der Nähe</h2><article class="pcard pcard--info" id="pcard-roads"></article></section></div></div></div>';
    expect(AROUND_BLOCK.test(`<main><section id="energypage"></section>${block}</main>`)).toBe(true);
    expect(AROUND_BLOCK.test('<main><section id="energypage"></section></main>')).toBe(false);
    // the loading state (no card yet) weighs less than production's: not a block
    expect(AROUND_BLOCK.test(block.replace(/<article[^>]*><\/article>/, ""))).toBe(false);
  });
});

describe("#1081 D6: the place page is measured with the charging filter bar, and once more under a filter", () => {
  const BAR = '<div id="place-cards"><section class="pcard"><form class="tpf evf" method="get" action="#pcard-charging">';
  it("refuses a place page without the bar, and a filtered page whose match line did not render", () => {
    expect(PLACE_PAGE.label).toBe(" [place page]");
    expect(PLACE_PAGE.expect.test(BAR)).toBe(true);
    expect(PLACE_PAGE.expect.test('<div id="place-cards"><section class="pcard"><ul>')).toBe(false);
    expect(PLACE_PAGE.expect.test('<form class="tpf evf"><div id="place-cards">')).toBe(false);
    expect(PLACE_PAGE_FILTERED.label.startsWith(PLACE_PAGE.label)).toBe(true);
    expect(PLACE_PAGE_FILTERED.expect.test(`${BAR}<p class="pcard__note evf__count" role="status">`)).toBe(true);
    expect(PLACE_PAGE_FILTERED.expect.test(`${BAR}<p class="pcard__note evf__none">`)).toBe(true);
    expect(PLACE_PAGE_FILTERED.expect.test(BAR)).toBe(false);
    expect(new URLSearchParams(PLACE_FILTER_QUERY).get("ev_kw")).toBe("fast");
  });
  it("the markers match the digest's own rendered bar, count line and no-match line, not a copy that could drift", () => {
    // The digest's real render of a filtered place card (#1081): the bar, the "N von M" line, the no-match sentence.
    const NOW = new Date("2026-10-03T08:00:00Z");
    const filter = chargingFilterOf(new URLSearchParams(PLACE_FILTER_QUERY));
    const site = { source_feed: "afir_chargecloud_stat", site_id: "a", name: "Ladepunkt a", operator: "IONITY GmbH", street: null, house_number: null, city: null, metres: 100, points: 1, max_kw: 150, lat: 50.94, lon: 6.96, point_status: [], also_feeds: [] };
    const rows: ChargingFacetRow[] = [
      { kind: "total", key: null, label: null, n: 3 },
      { kind: "match", key: null, label: null, n: 1 },
      { kind: "nopower", key: null, label: null, n: 0 },
      { kind: "op", key: "ionity", label: "IONITY GmbH", n: 3 },
      { kind: "band", key: "fast", label: null, n: 3 },
      { kind: "plug", key: "ccs2", label: null, n: 3 },
    ];
    const card = chargingCard({ takenAt: NOW, charging: { ok: true, value: [site] }, filter, facets: { ok: true, value: { radiusM: 2_000, rows } } });
    if (card.filter === undefined) throw new Error("the digest rendered no filter bar");
    const bar = chargingFilterBarHtml("de", card.filter, { anchor: "pcard-charging", fragment: null });
    const count = chargingFilterSummaryHtml("de", card.filter, NOW);
    const none = chargingNoMatchHtml("de", card.filter, "pcard-charging");
    // each marker is the element the digest renders, read as structure
    expect(all(bar, "form.tpf.evf").map((e) => e.attrs.action)).toEqual(["#pcard-charging"]);
    expect(all(count, "p.pcard__note.evf__count").map((e) => e.attrs.role)).toEqual(["status"]);
    expect(all(none, "p.pcard__note.evf__none")).toHaveLength(1);
    // and the budget's own markers recognise the real render: the place page with the bar, and the filtered one with either line
    const page = (...parts: string[]): string => `<div id="place-cards"><section class="pcard">${parts.join("")}</section></div>`;
    expect(PLACE_PAGE.expect.test(page(bar))).toBe(true);
    expect(PLACE_PAGE_FILTERED.expect.test(page(bar, count))).toBe(true);
    expect(PLACE_PAGE_FILTERED.expect.test(page(bar, none))).toBe(true);
    expect(PLACE_PAGE_FILTERED.expect.test(page(bar))).toBe(false);
  });
  it("the budget run measures the place page with the bar and the filtered place page, in every language", () => {
    const src = readFileSync(new URL("../scripts/budget.ts", import.meta.url), "utf8");
    expect(src).toMatch(/for \(const lang of LIVE_LANGS\) rows\.push\(await measure\([^)]*"start", placePath\(lang, "koeln"\), cache, PLACE_PAGE\)\)/);
    expect(src).toMatch(/for \(const lang of LIVE_LANGS\) rows\.push\(await measure\([^)]*"start", placePath\(lang, "koeln"\) \+ PLACE_FILTER_QUERY, cache, PLACE_PAGE_FILTERED\)\)/);
  });
});

describe("#1076 AC 6: the biggest station pages are measured under the issue's 500 KB raw and the site's 200 KB gzip", () => {
  const NOW = new Date("2026-10-03T08:00:00Z");
  const charging = ENERGY_PAGES.find((e) => e.kind === "charging")!;
  const fuelPage = ENERGY_PAGES.find((e) => e.kind === "fuel")!;
  it("the Autohof is a hub of 20+ charge points, more than the page lists one by one", () => {
    expect(AUTOHOF_POINTS).toBeGreaterThanOrEqual(20);
    expect(AUTOHOF_POINTS).toBeGreaterThan(ENERGY_POINTS_SHOWN);
    expect(autohofChargingPage(NOW).site.point_status).toHaveLength(AUTOHOF_POINTS);
  });
  it("a station page's own 500 KB raw limit: 500 KB + 1 is red and named, 500 KB is within it; the site's limit is untouched for other pages", () => {
    expect(ENERGY_RAW_MAX).toBe(500 * 1024);
    const station: Measured = { ...ok, path: "/de/charging/x", page: "stations", rawMax: ENERGY_RAW_MAX };
    const v = judge([ok, { ...station, rawHtml: ENERGY_RAW_MAX + 1 }]);
    expect(v.code).toBe(1);
    expect(v.lines.join("\n")).toMatch(/\/de\/charging\/x: raw HTML 512001 B > 512000/);
    expect(judge([{ ...station, rawHtml: ENERGY_RAW_MAX }]).code).toBe(0);
    // a page without its own limit keeps the site's 700 KB, and an own limit can never loosen it
    expect(judge([{ ...ok, rawHtml: ENERGY_RAW_MAX + 1 }]).code).toBe(0);
    expect(judge([{ ...ok, rawMax: LIMITS.rawHtml * 2, rawHtml: LIMITS.rawHtml + 1 }]).code).toBe(1);
  });
  it("refuses a charging page whose point table did not render at its longest, and a fuel page without its prices slot", () => {
    for (const lang of LIVE_LANGS) {
      expect(charging.expect.test(renderChargingPage(lang, autohofChargingPage(NOW), NOW)), lang).toBe(true);
      expect(fuelPage.expect.test(renderFuelPage(lang, autohofFuelPage(), NOW)), lang).toBe(true);
    }
    const short = autohofChargingPage(NOW);
    const site = short.site;
    const fewer = { ...short, site: { ...site, points: ENERGY_POINTS_SHOWN - 1, point_status: (site.point_status ?? []).slice(0, ENERGY_POINTS_SHOWN - 1) } };
    expect(charging.expect.test(renderChargingPage("de", fewer, NOW))).toBe(false);
    expect(charging.expect.test(renderChargingPage("de", { ...short, site: { ...site, points: 0, point_status: [] } }, NOW))).toBe(false);
    expect(fuelPage.expect.test(renderFuelPage("de", { ...autohofFuelPage(), near: [] }, NOW))).toBe(false);
    // the row count itself: a table one state cell short of the page's list fails even with the "+N" line beside it
    const cellsOf = (n: number) => `<table class="evpts"><tbody>${'<tr><td class="evpt evpt--available">x</td><td>150 kW</td></tr>'.repeat(n)}</tbody></table><p>+${String(AUTOHOF_POINTS - ENERGY_POINTS_SHOWN)}</p>`;
    expect(charging.expect.test(cellsOf(ENERGY_POINTS_SHOWN))).toBe(true);
    expect(charging.expect.test(cellsOf(ENERGY_POINTS_SHOWN - 1))).toBe(false);
  });
  it("the budget run measures both Autohof pages in every language with the 500 KB limit", () => {
    const src = readFileSync(new URL("../scripts/budget.ts", import.meta.url), "utf8");
    expect(src).toMatch(/for \(const lang of LIVE_LANGS\) for \(const e of ENERGY_PAGES\) rows\.push\(await measure\([^)]*"stations", energyPath\(e\.kind, lang, e\.slug\), cache, \{ label: e\.label, expect: e\.expect, rawMax: ENERGY_RAW_MAX, around: true \}\)\)/);
    expect(src).toMatch(/startRealDigest\(\{ scale: "production", energy: "autohof" \}\)/);
    // the row carries its own limit into the judge (measure → Measured.rawMax)
    expect(src).toContain("...(as.rawMax === undefined ? {} : { rawMax: as.rawMax })");
  });
});
