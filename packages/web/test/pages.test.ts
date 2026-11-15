import { describe, expect, it } from "vitest";
import {
  ANALYTICS_PAGES, MEASURED_DYNAMIC_PAGES,
  HOME_ANCHORS,
  HOME_BLOCKS,
  LIVE_LANGS,
  PAGES,
  PAGE_IDS,
  REDIRECTS,
  allPaths,
  pageAt,
  pathFor,
} from "../src/site/pages.js";

/** #376: the seven ids, both paths per id, no collision, the nine blocks in order. */
describe("the page map (src/site/pages.ts)", () => {
  it("lists exactly the seven ids #376 names, the fuel page (owner 2026-10-06), the News page (#588), the motorway index (#715), the station catalogue (#1041), the examples page (#747), the terms of use (#707) and the index of the sixteen Länder (#1074), once each", () => {
    const ids = PAGES.map((p) => p.id).sort();
    expect(ids).toEqual(["404", "business", "connect", "datenschutz", "developers", "examples", "fuel", "impressum", "motorways", "news", "start", "states", "stations", "terms"]);
    expect([...PAGE_IDS].sort()).toEqual(ids);
  });

  it("is live in exactly the twenty-two languages of #753, in the site's order", () => {
    expect([...LIVE_LANGS]).toEqual(["de", "en", "ru", "bg", "uk", "ro", "tr", "fr", "es", "nl", "pl", "it", "lt", "cs", "hu", "sk", "da", "pt", "hr", "sr", "el", "lv"]);
  });

  it("gives every id a path in every live language, all absolute and all different", () => {
    for (const p of PAGES) {
      const paths = LIVE_LANGS.map((l) => pathFor(p.id, l));
      for (const x of paths) expect(x, p.id).toMatch(/^\/[a-z0-9/-]*$/);
      expect(new Set(paths).size, p.id).toBe(LIVE_LANGS.length);
    }
  });

  it("lets no two paths collide, across languages and redirects", () => {
    const paths = [...allPaths(), ...REDIRECTS.map((r) => r.from)];
    expect(new Set(paths).size).toBe(paths.length);
  });

  it("puts every non-German page under its language prefix and the legal German pages at the root (A4)", () => {
    for (const p of PAGES) for (const l of LIVE_LANGS.filter((x) => x !== "de")) expect(pathFor(p.id, l), p.id).toMatch(new RegExp(`^/${l}(/|$)`));
    expect(pathFor("impressum", "de")).toBe("/impressum");
    expect(pathFor("datenschutz", "de")).toBe("/datenschutz");
    expect(pathFor("start", "de")).toBe("/de");
  });

  it("names a real owner issue for every page", () => {
    for (const p of PAGES) expect(p.issue, p.id).toBeGreaterThan(100);
  });

  it("has four pages in the header, in order 1..4, and the rest out of it", () => {
    const nav = PAGES.filter((p) => p.nav !== null).map((p) => p.nav).sort((a, b) => (a ?? 0) - (b ?? 0));
    expect(nav).toEqual([1, 2, 3, 4]);
    expect(PAGES.filter((p) => p.nav === null).map((p) => p.id).sort()).toEqual(["404", "datenschutz", "examples", "fuel", "impressum", "motorways", "news", "states", "stations", "terms"]);
    // the fuel page is reached from the home's fuel tile, never from the header
    expect(pathFor("fuel", "de")).toBe("/de/fuel");
    expect(pathFor("fuel", "tr")).toBe("/tr/fuel");
  });

  it("lists the ten home blocks in order — #990: the h1 first, the place, every national figure in 'now', the questions, the news, 'Loslegen' (start, tools, audience), the sources", () => {
    expect(HOME_BLOCKS).toEqual(["header", "hero", "place", "now", "start", "day", "news", "tools", "audience", "sources"]);
    expect(HOME_BLOCKS).toHaveLength(10);
    // the four header anchors are blocks of the home, and "connect" is the filled one
    for (const a of HOME_ANCHORS) expect(HOME_BLOCKS).toContain(a);
    expect(HOME_ANCHORS).toHaveLength(3);
  });

  it("measures the four content pages and the motorway pages (G1, #716) — never the fuel page, the legal pages or the 404 (GA rule 6, review S4)", () => {
    expect([...ANALYTICS_PAGES]).toEqual(["start", "connect", "developers", "business", "motorways"]);
    expect([...MEASURED_DYNAMIC_PAGES]).toEqual(["motorways"]);
    expect(ANALYTICS_PAGES).not.toContain("fuel");
    for (const p of ["impressum", "datenschutz", "404", "news"] as const) expect(ANALYTICS_PAGES).not.toContain(p);
  });

  it("knows which page and language every path is, and nothing else", () => {
    for (const p of PAGES) for (const l of LIVE_LANGS) expect(pageAt(pathFor(p.id, l))).toEqual({ id: p.id, lang: l });
    expect(pageAt("/nowhere")).toBeNull();
  });

  it("serves the seven languages of #235 (owner 2026-10-03), German first, then those of #753 in the umbrella's order", () => {
    const NEW = ["fr", "es", "nl", "pl", "it", "lt", "cs", "hu", "sk", "da", "pt", "hr", "sr", "el", "lv"];
    expect(LIVE_LANGS.slice(0, 7)).toEqual(["de", "en", "ru", "bg", "uk", "ro", "tr"]);
    expect(LIVE_LANGS.slice(7)).toEqual(NEW.filter((l) => (LIVE_LANGS as readonly string[]).includes(l)));
  });

  it("carries the two A4 redirects, /en/home and every language prefix with a slash (#382, #235) as 301s", () => {
    expect(REDIRECTS).toEqual([
      { from: "/home", to: "/", status: 301 },
      { from: "/connect", to: "/de/connect", status: 301 },
      { from: "/en/home", to: "/en", status: 301 },
      ...LIVE_LANGS.map((l) => ({ from: `/${l}/`, to: `/${l}`, status: 301 })),
    ]);
  });
});
