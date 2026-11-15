/**
 * Data-steward ruling FS-2026-11-06, addendum FS11: on the place page the shell lifts the digest's first block under the
 * `<h1>` (`liftPlaceFirst`), and its credits go WITH it — the names line and an `ALWAYS_SHOWN` source's full line stay
 * inside what is lifted (FS11a, FS11b); and the head reads no "now" from a statement on such a source (FS11d).
 */
import { readFileSync } from "node:fs";
import { all, text } from "@viafrei/design/testing";
import { describe, expect, it, vi } from "vitest";
import { buildPlaceCards } from "../../digest/src/analysis/place-cards.js";
import { fromGoldenText } from "../../digest/src/cards/golden.test.support.js";
import { renderPlace } from "../../digest/src/presentation/place-tiles.js";
import type { PlaceAmpel } from "../../digest/src/analysis/place-ampel.js";
import { DWD_SUMMARY_LINE } from "../../digest/src/cards/warnings/html.js";
import { placeFirstHtml } from "../../digest/src/presentation/place-first-html.js";
import { stationFirstHtml } from "../../digest/src/presentation/station-first-html.js";
import { liftPlaceFirst, placeNowOf, stationNowOf } from "../src/lib/place-head.js";

const AT = new Date("2026-11-05T20:59:00Z");
const amp = (o: Partial<PlaceAmpel>): PlaceAmpel => ({ lamp: "red", reasons: [], radiusM: 5000, asOf: AT, sight: [], rows: [], motorwayInRadius: true, ...o });
const dwd = { lamp: "yellow", signal: { kind: "dwd", level: 2, event: "STURMBÖEN", ref: { kind: "dwd", item: { event: "STURMBÖEN", level: 2 }, anchor: "pcard-warnings" } } };
const row = (licenceId: string): unknown => ({ kind: "closure", road: "A4", what: null, metres: 1000, delaySeconds: null, section: "S1", direction: null, licenceId });
/** Each card's footer as `cardFootHtml` writes it: with its FS11a anchor. */
const CREDITS: Readonly<Record<string, string>> = {
  warnings: `<footer class="pcard__foot" id="pcard-warnings-sources"><p class="credit">${DWD_SUMMARY_LINE}</p></footer>`,
  motorways: `<footer class="pcard__foot" id="pcard-motorways-sources"><p class="credit">Verkehrsdaten: Autobahn GmbH des Bundes</p></footer>`,
};
/** A home fragment as the digest writes it: the place's heading, its first block, its cards. */
const fragment = (a: PlaceAmpel): string =>
  fragmentOf(a, ["warnings", "motorways"]);
const fragmentOf = (a: PlaceAmpel, ids: readonly string[]): string =>
  `<section class="place" id="place-cards"><h2 class="place__title" id="place-title">Für Testort</h2>${placeFirstHtml("de", a, ids.map((id) => ({ id, items: [1] })) as never, (id) => String(id), () => true, (id) => CREDITS[id] ?? "")}<div class="place__cards">${ids.map((id) => `<article id="pcard-${id}">${CREDITS[id] ?? ""}</article>`).join("")}</div></section>`;

describe("FS11 on the place page: the block's credits are lifted with it", () => {
  it("the home fragment carries the names line inside the block; the place page's lifted block carries it too, and the rest none", () => {
    const html = fragment(amp({ lamp: "yellow", reasons: [dwd] as never }));
    const { html: rest, first } = liftPlaceFirst(html);
    expect(first).not.toBeNull();
    const names = all(first!, '.pagefirst__sources span[translate="no"]').map((e) => text(e));
    expect(names).toEqual(["Deutscher Wetterdienst", "Autobahn GmbH des Bundes"]);
    expect(new Set(names).size).toBe(names.length);
    expect(all(first!, ".pagefirst__lines .ampel__src").map((e) => text(e))).toEqual([DWD_SUMMARY_LINE]);
    expect(rest).not.toContain("pagefirst__sources");
    expect(rest).not.toContain("pagefirst__lines");
    // FS11a: every link of the names line lands on the footer that credits it, which the page holds
    const targets = [...first!.matchAll(/class="pagefirst__src" href="#([^"]+)"/gu)].map((m) => m[1]!);
    expect(targets).toEqual(["pcard-warnings-sources", "pcard-motorways-sources"]);
    for (const id of targets) expect(rest).toContain(`id="${id}"`);
  });
  it("FS11d on a green place: \"nothing reported\" read from the DWD's card is guarded, and the head takes no \"now\" from it", () => {
    const green = amp({ lamp: "green" });
    const { first } = liftPlaceFirst(fragmentOf(green, ["warnings", "motorways"]));
    expect(all(first!, ".pagefirst__now[data-nosnippet] .statusline")).toHaveLength(1);
    expect(placeNowOf(first)).toBeNull();
    // with only the Autobahn GmbH's card read, the zero is no ALWAYS_SHOWN statement: unguarded, the head reads it
    const plain = liftPlaceFirst(fragmentOf(green, ["motorways"])).first;
    expect(all(plain!, "[data-nosnippet]")).toHaveLength(0);
    expect(placeNowOf(plain)?.kind).toBe("nothing");
  });
  it("FS11d: a statement on DWD or GeoNutzV data gives the head no \"now\"; one on the Autobahn GmbH's does", () => {
    expect(placeNowOf(liftPlaceFirst(fragment(amp({ lamp: "yellow", reasons: [dwd] as never }))).first)).toBeNull();
    expect(placeNowOf(liftPlaceFirst(fragment(amp({ rows: [row("mobilithek_roadworks_bayern")] as never }))).first)).toBeNull();
    const ab = placeNowOf(liftPlaceFirst(fragment(amp({ rows: [row("autobahn")] as never }))).first);
    expect(ab?.kind).toBe("closure");
    expect(ab?.status).not.toMatch(/Quellen|Autobahn GmbH/u);
  });
  it("a station's head reads its status as before (FS11c: no guarded box today; #988: three quiet trains are green, none is grey)", () => {
    const live = { at: AT, lifts: { state: "ok", units: [], credits: [] }, alerts: { state: "ok", items: [], stand: AT }, board: { state: "ok", rows: [0, 1, 2].map((i) => ({ planned: new Date(AT.getTime() + (i + 1) * 60_000), line: `RE ${String(i + 1)}`, destination: "Bonn Hbf", delayMin: 0, cancelled: false, movedFrom: null, travel: "regional" })), feeds: [], at: AT, credits: [] }, arrivals: { state: "ok", rows: [], feeds: [], at: AT, credits: [] }, checks: [] } as never;
    const now = stationNowOf(liftPlaceFirst(stationFirstHtml("de", live, (id) => `pcard-station-${id}`, false)).first);
    expect(now?.kind).toBe("nothing");
    expect(stationNowOf(`<div class="pagefirst__now" data-nosnippet><p class="statusline statusline--amber">x</p></div>`)).toBeNull();
  });
});

describe("FS11d on a recorded green place: the lamp's cards judged clear stand in the ✓ list, and still guard the block", () => {
  it("nuernberg-full: the warnings and roads cards are clear; the block is guarded, names their publishers, and the head reads no now", () => {
    const input = fromGoldenText(readFileSync(new URL("../../digest/src/cards/__golden__/nuernberg-full.input.json", import.meta.url), "utf8")) as Parameters<typeof buildPlaceCards>[0];
    vi.useFakeTimers({ toFake: ["Date"], now: new Date("2026-10-23T10:00:00Z") });
    let html: string;
    try {
      html = renderPlace({ cards: buildPlaceCards(input), report: input.report, lang: "de" });
    } finally {
      vi.useRealTimers();
    }
    // the precondition: green, and the two lamp cards in the ✓ list, not among the cards
    const clear = all(html, ".place__clearlist footer").map((e) => e.attrs.id);
    expect(clear).toEqual(expect.arrayContaining(["pcard-warnings-sources", "pcard-roads-sources"]));
    expect(all(html, "article#pcard-warnings")).toHaveLength(0);
    const { first, html: rest } = liftPlaceFirst(html);
    expect(first).not.toBeNull();
    expect(all(first!, ".statusline--green")).toHaveLength(1);
    expect(all(first!, ".pagefirst__now[data-nosnippet] .statusline")).toHaveLength(1);
    expect(placeNowOf(first)).toBeNull();
    const names = all(first!, '.pagefirst__sources span[translate="no"]').map((e) => text(e));
    expect(names).toEqual(expect.arrayContaining(["Deutscher Wetterdienst", "Autobahn GmbH des Bundes"]));
    // every name links to the footer of the ✓ row or the card that credits it, on the page
    for (const m of first!.matchAll(/class="pagefirst__src" href="#([^"]+)"/gu)) expect(rest).toContain(`id="${m[1]!}"`);
  });
});
