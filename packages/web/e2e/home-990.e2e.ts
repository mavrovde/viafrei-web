/**
 * #990 against the REAL built shell, a stand-in digest answering every tile, fact and the motorway panel, and the
 * assistant-answers stub: the h1 is the first heading of <main>; every national figure is inside "Deutschland jetzt"
 * and nowhere else; each domain is ONE group there and the moments carry no tile; the blocks stand in HOME_BLOCKS
 * order; at 375, 768, 1280 and 1600 px no grid of the band has an empty cell or an empty column; the render-then-fill
 * script still runs without the PanelFill component — in de, en and tr.
 */
import type { ChildProcess } from "node:child_process";
import { chromium, type Browser } from "playwright";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { startShell } from "./server.js";
import { startStubDigest } from "./stub-digest.js";
import { startAsksStub } from "./asks-stub.js";
import { EMBEDDED_TILES, FACTS } from "../src/lib/tiles.js";
import { HOME_BLOCKS } from "../src/site/pages.js";

const PORT = 8903;
const BASE = `http://127.0.0.1:${String(PORT)}`;
let browser: Browser;
let shell: ChildProcess;
let stub: Awaited<ReturnType<typeof startStubDigest>>;
let asks: Awaited<ReturnType<typeof startAsksStub>>;

beforeAll(async () => {
  stub = await startStubDigest();
  asks = await startAsksStub();
  shell = await startShell(PORT, { DIGEST_URL: stub.url, MCP_INTERNAL_URL: asks.url, WEB_TILE_TIMEOUT_MS: "2000" });
  browser = await chromium.launch();
});
afterAll(async () => {
  await browser?.close();
  shell?.kill();
  await stub?.close();
  await asks?.close();
});

/** The domain each national panel belongs to — the band's group it must sit in, and the only one. */
const DOMAIN: Readonly<Record<string, string>> = {
  "fact-roads": "roads", "tile-reports": "roads", "tile-jams": "roads", "motorway-top": "roads",
  "fact-punctuality": "rail", "tile-punctuality": "rail", "tile-station": "rail", "tile-lifts": "rail",
  "fact-charging": "energy", "tile-charging": "energy", "tile-fuel": "energy",
  "fact-lorry": "parking", "tile-lorry": "parking", "tile-carparks": "parking",
};

describe("#990: the home, one topic in one place", () => {
  it("the domain map covers every embedded tile and fact the shell asks the digest for", () => {
    expect(Object.keys(DOMAIN).sort()).toEqual([...EMBEDDED_TILES.map((id) => `tile-${id}`), ...FACTS.map((id) => `fact-${id}`), "motorway-top"].sort());
  });

  for (const lang of ["de", "en", "tr"] as const) {
    it(`${lang}: the h1 first, the blocks in order, every national figure in its one group of "Deutschland jetzt" and nowhere else`, async () => {
      const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
      await page.goto(`${BASE}/${lang}`, { waitUntil: "networkidle" });
      // network idle is the network's state, not the parser's: a 200 KB home can still be "loading" then (measured
      // under the container's emulation, the DOM ending after #place), so the DOM is read once the document has loaded.
      await page.waitForLoadState("load");
      const r = await page.evaluate(() => {
        const main = document.querySelector("main");
        const headings = Array.from(main?.querySelectorAll("h1, h2, h3, h4, h5, h6") ?? []).filter((h) => (h as HTMLElement).offsetParent !== null || h.closest("details") !== null);
        const panels = Array.from(document.querySelectorAll('section[id^="tile-"], section[id^="fact-"], #motorway-top')).map((e) => ({
          id: e.id,
          group: e.closest(".now__group")?.id ?? null,
          inDay: e.closest("#day") !== null,
        }));
        const ids = ["hero", "place", "now", "start", "day", "news", "tools", "audience", "sources"].map((id) => {
          const e = document.getElementById(id);
          return e === null ? -1 : Array.from(document.querySelectorAll("[id]")).indexOf(e);
        });
        return { first: headings[0]?.tagName ?? "", panels, ids, dayTiles: document.querySelectorAll("#day .moment__tiles, #day .tile").length, groups: Array.from(document.querySelectorAll("#now .now__group")).map((g) => g.id) };
      });
      await page.close();
      expect(r.first).toBe("H1");
      // the blocks of HOME_BLOCKS after the header, in that order
      expect(HOME_BLOCKS.slice(1)).toEqual(["hero", "place", "now", "start", "day", "news", "tools", "audience", "sources"]);
      for (const [i, at] of r.ids.entries()) {
        expect(at, HOME_BLOCKS[i + 1]).toBeGreaterThanOrEqual(0);
        if (i > 0) expect(at, HOME_BLOCKS[i + 1]).toBeGreaterThan(r.ids[i - 1] ?? -1);
      }
      expect(r.dayTiles).toBe(0);
      expect(r.groups).toEqual(["now-roads", "now-rail", "now-energy", "now-parking"]);
      // the stand-in digest serves every tile and fact; the motorway panel is the real digest's (`motorway-2116.e2e.ts` places it in the roads group)
      expect(Object.keys(DOMAIN).filter((id) => id !== "motorway-top" && !r.panels.some((p) => p.id === id))).toEqual([]);
      for (const p of r.panels) {
        expect(p.inDay, p.id).toBe(false);
        expect(p.group, p.id).toBe(`now-${DOMAIN[p.id] ?? "?"}`);
      }
      // each national panel once
      expect(new Set(r.panels.map((p) => p.id)).size).toBe(r.panels.length);
    });
  }

  for (const width of [375, 768, 1280, 1600]) {
    it(`${String(width)} px: no grid of the band has an empty cell, and no column is left empty`, async () => {
      const page = await browser.newPage({ viewport: { width, height: 900 } });
      await page.goto(`${BASE}/de`, { waitUntil: "networkidle" });
      const grids = await page.$$eval("#now .now__grid", (gs) =>
        gs.map((g) => {
          const cells = Array.from(g.children).map((c) => c.getBoundingClientRect());
          const cols = getComputedStyle(g).gridTemplateColumns.split(" ").filter((x) => x !== "").length;
          const box = g.getBoundingClientRect();
          // the columns the cells occupy: a column with no cell is the "empty space" of #990
          const used = new Set(cells.map((c) => Math.round(c.left - box.left)));
          return { cells: cells.map((c) => c.height), cols, used: used.size };
        }),
      );
      await page.close();
      expect(grids.length).toBeGreaterThan(0);
      for (const g of grids) {
        for (const h of g.cells) expect(h).toBeGreaterThan(20);
        expect(g.cols).toBeLessThanOrEqual(g.cells.length);
        expect(g.used).toBe(Math.min(g.cols, g.cells.length));
      }
    });
  }

  it("the panels that miss the deadline are still filled: the fill script is on the home and on a place page, and PanelFill is gone", async () => {
    for (const path of ["/de", "/de/place/berlin"]) {
      const r = await fetch(`${BASE}${path}`);
      const html = await r.text();
      expect(html, path).toContain("function panelFill(w, askAgain, waits, showByMs)");
    }
  });
});
