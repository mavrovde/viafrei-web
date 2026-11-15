/**
 * #1153: the header's ONE search suggests the places (#1112) and the site search's motorways, stations, junctions,
 * pages and News entries (#1111) in one list (`lib/header-suggest.ts`), ordered by the best match of each group: "A7"
 * leads with the motorway, "Köln Hbf" with the station, "Köln" with the place. No road is listed twice, and each
 * credit line is printed once.
 */
import { describe, expect, it } from "vitest";
import { HEADER_SITE_KINDS, HEADER_SUGGEST_TIMEOUT_MS, isPlaceLine, mergeSuggest, oneCreditEach, placeLinesOf } from "../src/lib/header-suggest.js";
import { suggestRoute } from "../src/lib/fragment-route.js";
import type { FetchLike } from "../src/lib/tiles.js";
import { t } from "../src/i18n/index.js";
import type { Group, Results } from "../src/lib/site-search.js";
import { all } from "@viafrei/design/testing";

const sug = (href: string, name: string, where: string): string =>
  `<li class="place-sug"><a class="place-opt" href="${href}"><span class="place-opt__name" translate="no">${name}</span> <span class="place-opt__where">· ${where}</span></a></li>`;
const GZ = `<p class="place-suggest__credit">Gemeinden: © BKG</p>`;
const STADA = `<p class="place-suggest__credit">Bahnhöfe: DB InfraGO (CC BY 4.0)</p>`;
const placeList = (items: readonly string[], credits = GZ): string => `<div class="place-suggest"><ul class="place-suggest__list" aria-label="Vorschläge">${items.join("")}</ul>${credits}</div>`;
const group = (kind: Group["kind"], best: number, items: readonly string[]): Group => ({ kind, best, total: items.length, items: items.join("") });
const site = (groups: readonly Group[], credits = "", partial: Results["partial"] = []): Results => ({ groups, partial, credits });

/** The groups of the merged list, in order, by their section class. */
const kinds = (html: string): string[] => [...html.matchAll(/<section class="ss-group ss-group--([a-z]+)"/g)].map((m) => m[1] ?? "");
/** The links of the merged list, in order. */
const hrefs = (html: string): string[] => all(html, "a.place-opt").map((a) => a.attrs.href ?? "");

describe("#1153 the header's merged suggestions", () => {
  it("'A7' leads with the motorway; the place list's own road line is dropped, so the road is listed once", () => {
    const places = placeList([sug("/de/autobahn/a7", "A7", "Autobahn"), sug("#ags:01001000", "Aabach", "Gemeinde")]);
    const html = mergeSuggest("de", "A7", places, site([group("motorway", 3, [sug("/de/autobahn/a7", "A7", "Flensburg – Füssen")]), group("exit", 2, [sug("/de/autobahn/a7#ak-kassel", "A7 Kassel-Nord", "Anschluss")])]));
    expect(html).not.toBeNull();
    expect(kinds(html)[0]).toBe("motorway");
    expect(hrefs(html)[0]).toBe("/de/autobahn/a7");
    expect(hrefs(html).filter((h) => h === "/de/autobahn/a7")).toHaveLength(1);
  });
  it("'Köln Hbf' leads with the station page", () => {
    const places = placeList([sug("#pt:50.94303,6.95871", "Köln Hbf, Köln", "Bahnhof")], STADA);
    const html = mergeSuggest("de", "Köln Hbf", places, site([group("station", 3, [sug("/de/station/koeln-hbf", "Köln Hbf", "Köln")])], STADA));
    expect(kinds(html)).toEqual(["station", "place"]);
    expect(hrefs(html)[0]).toBe("/de/station/koeln-hbf");
    // the station's credit is owed by both answers and printed once
    expect(html.split("DB InfraGO").length - 1).toBe(1);
  });
  it("'Köln' leads with the place, which the island takes as the site-wide place", () => {
    const places = placeList([sug("/de/place/koeln", "Köln", "Gemeinde"), sug("#dst:5315000001", "Köln-Ehrenfeld, Köln", "Stadtteil")]);
    const html = mergeSuggest("de", "Köln", places, site([group("station", 2, [sug("/de/station/koeln-hbf", "Köln Hbf", "Köln")]), group("page", 1, [sug("/de/news", "Neuigkeiten zu Köln", "Seite")])]));
    expect(kinds(html)).toEqual(["place", "station", "page"]);
    expect(hrefs(html)[0]).toBe("/de/place/koeln");
    expect(isPlaceLine(sug(hrefs(html)[0] ?? "", "Köln", "x"))).toBe(true);
  });
  it("lists only the site kinds that are no place (the places, areas and points of interest are the place list's)", () => {
    expect(HEADER_SITE_KINDS).toEqual(["motorway", "road", "station", "exit", "page", "news"]);
    const html = mergeSuggest("de", "Köln", placeList([sug("/de/place/koeln", "Köln", "Gemeinde")]), site([group("place", 3, [sug("/de/place/koeln", "Köln", "x")]), group("area", 2, [sug("#dst:1", "Köln-Mitte", "x")]), group("poi", 1, [sug("#poi:1", "Dom", "x")])], "", ["poi", "station"]));
    expect(kinds(html)).toEqual(["place"]);
    expect(hrefs(html)).toEqual(["/de/place/koeln"]);
    // a partial answer is said only for a kind the header lists
    expect(html).toContain("ss-partial");
  });
  it("no group at all is the place list's own 'no place' line, else the site's; no answer from either side says so in words (2.5.8)", () => {
    const neither = mergeSuggest("de", "zz", null, null);
    expect(neither).toMatch(/^<div class="place-suggest site-results ss-none"/);
    expect(neither).toContain(t("de", "search.partial"));
    const none = `<div class="place-suggest place-suggest--none"><p class="place-suggest__none">Kein Ort zu „zz“</p></div>`;
    expect(mergeSuggest("de", "zz", none, site([]))).toBe(none);
    expect(mergeSuggest("de", "zz", null, site([]))).toMatch(/^<div class="place-suggest site-results ss-none"/);
    // a 'no place' line from a place read cut at its deadline is no answer that nothing is there
    const lateNone = `<div class="place-suggest place-suggest--none place-suggest--partial"><p class="place-suggest__none">Kein Ort zu „zz“</p></div>`;
    const said = mergeSuggest("de", "zz", lateNone, site([]));
    expect(said).not.toBe(lateNone);
    expect(said).toContain(t("de", "search.partial"));
  });
  it("one answer missing leaves only its groups out, and says so (2.5.8)", () => {
    const noPlaces = mergeSuggest("de", "A7", null, site([group("motorway", 3, [sug("/de/autobahn/a7", "A7", "x")])]));
    expect(kinds(noPlaces)).toEqual(["motorway"]);
    expect(noPlaces).toContain(t("de", "search.partial"));
    const noSite = mergeSuggest("de", "Köln", placeList([sug("/de/place/koeln", "Köln", "Gemeinde")]), null);
    expect(kinds(noSite)).toEqual(["place"]);
    expect(noSite).toContain(t("de", "search.partial"));
    // a place list the digest marked partial: its towns shown, the gap said
    const late = placeList([sug("/de/place/koeln", "Köln", "Gemeinde")]).replace('<div class="place-suggest">', '<div class="place-suggest place-suggest--partial">');
    const partial = mergeSuggest("de", "Köln", late, site([]));
    expect(hrefs(partial)).toEqual(["/de/place/koeln"]);
    expect(partial).toContain(t("de", "search.partial"));
    expect(mergeSuggest("de", "Köln", placeList([sug("/de/place/koeln", "Köln", "Gemeinde")]), site([]))).not.toContain(t("de", "search.partial"));
  });
  it("2.5.8 (AC 7): a digest that hangs — the route answers 200 within the header's 300 ms, never a 502; a non-question is a 400", async () => {
    expect(HEADER_SUGGEST_TIMEOUT_MS).toBe(300);
    const asked: number[] = [];
    // a hanging digest that honours the abort signal, as fetch does; the tile default (2 s) must not be what it waits
    const hang: FetchLike = (_url, init) =>
      new Promise((_resolve, reject) => {
        const t0 = Date.now();
        init?.signal?.addEventListener("abort", () => {
          asked.push(Date.now() - t0);
          reject(Object.assign(new Error("aborted"), { name: "AbortError" }));
        });
      });
    const o = { baseUrl: "http://digest", timeoutMs: 2_000, fetchImpl: hang };
    const post = (q: string): Request => new Request("http://shell/fragment/suggest", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ q, lang: "de" }) });
    const t0 = Date.now();
    const res = await suggestRoute(post("Köln"), o);
    expect(Date.now() - t0).toBeLessThan(600);
    expect(res.status).toBe(200);
    expect(await res.text()).toContain(t("de", "search.partial"));
    expect(asked).toHaveLength(2);
    for (const ms of asked) expect(ms).toBeLessThan(450);
    expect((await suggestRoute(post("K"), o)).status).toBe(400);
  });
  it("reads the place list back: place keys and place pages are places, a road or a page link is not", () => {
    expect(isPlaceLine(sug("#ags:05315000", "Köln", "x"))).toBe(true);
    expect(isPlaceLine(sug("/en/place/koeln", "Köln", "x"))).toBe(true);
    expect(isPlaceLine(sug("/de/autobahn/a7", "A7", "x"))).toBe(false);
    expect(isPlaceLine(sug("/de/station/koeln-hbf", "Köln Hbf", "x"))).toBe(false);
    expect(placeLinesOf("<p>not a list</p>")).toBeNull();
    const back = placeLinesOf(placeList([sug("#ags:1", "A", "x"), sug("/de/autobahn/a1", "A1", "x")]));
    expect(back?.items).toHaveLength(1);
    expect(back?.credits).toBe(GZ);
  });
  it("prints each credit line once, in the order first met", () => {
    expect(oneCreditEach(`${GZ}${STADA}`, `${STADA}<p>OSM</p>`)).toBe(`${GZ}${STADA}<p>OSM</p>`);
    expect(oneCreditEach("", "")).toBe("");
  });
});
