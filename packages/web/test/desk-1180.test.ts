/**
 * #1180: the desktop dashboard's configurations and its script, judged without a browser (the layout itself is
 * `e2e/desktop-1180.e2e.ts` and `e2e/desktop-place-1180.e2e.ts`). What must be seen never folds: a road's closures, jams,
 * DWD warnings and fuel (#1173, FS-2026-11-06: fuel never folds); a place's roads, warnings and fuel.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { DESK_FROM_PX, DESK_JS, connectDesk, deskScript, homeDesk, placeDesk, roadDesk, stationDesk } from "../src/lib/desk.js";
import { INLINE_SCRIPTS } from "../src/lib/inline-scripts.js";
import { LIVE_LANGS } from "../src/site/pages.js";

const CSS = readFileSync(fileURLToPath(new URL("../src/styles/site.css", import.meta.url)), "utf8");

describe("#1180: what a desktop folds", () => {
  it("a road folds no closure, jam, DWD warning or fuel card", () => {
    const fold = roadDesk("de").fold;
    for (const id of ["mwk-closures", "mwk-jams", "mwk-weather", "mwk-fuel"]) expect(fold, id).toContain(`:not(#${id})`);
    // the reference row's fuel card too
    expect(fold).toMatch(/\.mwk-ref > \.mwk:not\(#mwk-fuel\)/u);
  });
  it("a place folds its cards by name, and never the roads, the DWD warnings or the fuel", () => {
    const ids = [...placeDesk("de").fold.matchAll(/#pcard-([a-z]+)/gu)].map((m) => m[1]);
    expect(ids.length).toBeGreaterThan(0);
    for (const never of ["roads", "warnings", "fuel"]) expect(ids, never).not.toContain(never);
    // every folded card is named by its id, never by a selector that could reach another card
    for (const part of placeDesk("de").fold.split(", ")) expect(part).toMatch(/^\.place__cards > #pcard-[a-z]+$/u);
  });
  it("the home folds the place's cards as a place page does, and never the roads, the DWD warnings or the fuel", () => {
    const fold = homeDesk("de").fold;
    const ids = [...fold.matchAll(/#pcard-([a-z]+)/gu)].map((m) => m[1]);
    expect(ids).toEqual([...placeDesk("de").fold.matchAll(/#pcard-([a-z]+)/gu)].map((m) => m[1]));
    for (const never of ["roads", "warnings", "fuel"]) expect(ids, never).not.toContain(never);
    // Germany now's panels and the day's moments only where they carry their own fold, whose summary names the publishers (FS3)
    for (const part of fold.split(", ").filter((p) => p.startsWith("#now") || p.startsWith("#day"))) expect(part, part).toMatch(/:has\(> details\.fold\)$/u);
    // the fuel tile is never named (FS5): it carries no fold of its own (`NationalBand`'s `folds`)
    expect(fold).not.toMatch(/fuel/u);
  });
  it("the home's heat strip is the two most-affected lists, moved into the strip; the star and then the ask box go under each map", () => {
    expect(homeDesk("de").move).toEqual([
      ["#now-roads > .now__widefold", "#desk-heat"],
      ["#now-rail > .now__widefold", "#desk-heat"],
    ]);
    expect(roadDesk("de").move).toEqual([["p.star", roadDesk("de").map], ["#desk-ask", roadDesk("de").map]]);
    expect(placeDesk("de").move).toEqual([["p.star", placeDesk("de").map], ["#desk-ask", placeDesk("de").map]]);
    expect(stationDesk("de").move).toEqual([["p.star", stationDesk("de").map], ["#desk-ask", stationDesk("de").map]]);
  });
  it("the connect page closes on a desktop the folds a phone closes, and caps the live answers to three", () => {
    expect(connectDesk("de").fold.split(", ")).toEqual(["#answers > .wrap", "#sources > .wrap", "#asks > .wrap"]);
    expect(connectDesk("de").cap).toEqual([["#answers .cards", 3]]);
  });
  it("the button's words are the page's language, with the count to fill", () => {
    for (const lang of LIVE_LANGS) {
      expect(roadDesk(lang).more, lang).toContain("{n}");
      expect(placeDesk(lang).more, lang).toBe(roadDesk(lang).more);
    }
  });
});

describe("#1180: the script", () => {
  it("is the minified function the page carries, called with its configuration, with no `</` that could end the script", () => {
    expect(INLINE_SCRIPTS.desk.length).toBeGreaterThan(200);
    const s = deskScript({ ...roadDesk("de"), more: "</script>{n}" });
    expect(s.startsWith(`(${INLINE_SCRIPTS.desk})(`)).toBe(true);
    expect(s).not.toContain("</");
  });
  it("runs from the stylesheet's own breakpoint, and a phone runs none of it", () => {
    expect(DESK_JS).toContain(`(min-width: ${String(DESK_FROM_PX)}px)`);
    expect(CSS).toContain(`@media (min-width: ${String(DESK_FROM_PX)}px)`);
    // the rows a desktop alone shows are hidden below the same breakpoint
    expect(CSS).toContain(`@media (max-width: ${String(DESK_FROM_PX - 0.02)}px) { .topitems__extra`);
  });
  it("stores nothing and asks nothing", () => {
    for (const s of [DESK_JS, INLINE_SCRIPTS.desk]) {
      expect(s).not.toMatch(/localStorage|sessionStorage|indexedDB|document\.cookie|fetch\(|XMLHttpRequest|sendBeacon/u);
    }
  });
});

describe("a star the desk moves under a map is hidden from the first paint (data-desk-move)", () => {
  const layout = (name: string): string => readFileSync(fileURLToPath(new URL(`../src/layouts/${name}.astro`, import.meta.url)), "utf8");
  // the markup the server's HTML carries for a desk selector: `.x` is `class="x`, `#x` is `id="x"`
  const marker = (sel: string): string => (sel.startsWith("#") ? `id="${sel.slice(1)}"` : `class="${sel.slice(1)}`);
  const cases = [
    ["MotorwayPage", roadDesk("de")],
    ["PlacePage", placeDesk("de")],
    ["StationPage", stationDesk("de")],
  ] as const;

  it.each(cases)("%s marks its star by the same selector its desk moves the star into", (name, desk) => {
    const into = desk.move?.find(([what]) => what === "p.star")?.[1];
    expect(into, `${name}: the desk moves p.star`).toBeDefined();
    const star = /<Star [^>]*moves=\{[^}]*?\.includes\('([^']*)'\)\}/u.exec(layout(name));
    expect(star, `${name}: <Star moves={….includes('…')}>`).not.toBeNull();
    expect(star![1], name).toContain(marker(into!));
  });

  it("site.css hides a marked star not yet moved, inside the 1024 px media block", () => {
    const rule = ".desk .star[data-desk-move]:not(:is(.motorway__map, #place-ampel, #pcard-station-nearby) > *)";
    const at = CSS.indexOf(rule);
    expect(at, "the rule").toBeGreaterThan(-1);
    const open = CSS.lastIndexOf("@media (min-width: 1024px) {", at);
    expect(open, "a 1024 px media block before it").toBeGreaterThan(-1);
    let depth = 0;
    for (let i = CSS.indexOf("{", open); i < at; i++) {
      if (CSS[i] === "{") depth++;
      else if (CSS[i] === "}") depth--;
      expect(depth, "the block is still open at the rule").toBeGreaterThan(0);
    }
    expect(depth, "the rule stands at the block's top level").toBe(1);
    expect(CSS.slice(at, CSS.indexOf("}", at)), "it hides the star").toMatch(/\{\s*display:\s*none;\s*$/u);
  });
});
