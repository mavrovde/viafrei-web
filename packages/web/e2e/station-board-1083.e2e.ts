/**
 * #1083 against the REAL built shell and the REAL digest (Köln Hbf's fixture board), the browser half of the issue's
 * test list:
 *  - at 320, 360, 375, 390, 412, 430 and 460 px (460 is just above the narrow layout of the cards, which ends at about 450 px), in every live language, the station page scrolls sideways nowhere: the board's wide
 *    table scrolls inside its own named box, never the page;
 *  - the board is read as a table: a table named by its head line (the side word, the station's name and its Stand),
 *    five column headers, and each departure a row of five cells;
 *  - at 320 and 360 px, in every live language, a stop's own page (Breslauer Platz/Hbf, no card around its board) scrolls
 *    sideways nowhere either;
 *  - axe reports no violation inside the board, light and dark, at the narrowest phone.
 * The "more" fold appending rows inside the board is `station-fold-1091.e2e.ts`; the markup half of every case is
 * `packages/digest/src/presentation/station-board-display-1083.test.ts` and `station-board-edges-1083.test.ts`.
 */
import type { ChildProcess } from "node:child_process";
import { AxeBuilder } from "@axe-core/playwright";
import { chromium, type Browser } from "playwright";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { LIVE_LANGS } from "../src/site/pages.js";
import { stationPath } from "../src/site/stations.js";
import { startRealDigest } from "./real-digest.js";
import { startShell } from "./server.js";

const PORT = 8962;
const BASE = `http://127.0.0.1:${String(PORT)}`;
const BOARD = "#pcard-station-board";
let browser: Browser;
let shell: ChildProcess;
let digest: Awaited<ReturnType<typeof startRealDigest>>;

beforeAll(async () => {
  digest = await startRealDigest();
  shell = await startShell(PORT, { DIGEST_URL: digest.url, WEB_TILE_TIMEOUT_MS: "2000" });
  browser = await chromium.launch();
}, 120_000);
afterAll(async () => {
  await browser?.close();
  shell?.kill();
  await digest?.close();
});

describe("#1083 AC 8: no horizontal scroll at phone widths either side of the narrow layout, in every language", () => {
  for (const lang of LIVE_LANGS) {
    it(`${stationPath(lang, "koeln-hbf")}`, async () => {
      for (const width of [320, 360, 375, 390, 412, 430, 460] as const) {
        const ctx = await browser.newContext({ javaScriptEnabled: false, viewport: { width, height: 800 } });
        ctx.setDefaultTimeout(2000);
        const page = await ctx.newPage();
        await page.goto(`${BASE}${stationPath(lang, "koeln-hbf")}`, { waitUntil: "domcontentloaded" });
        // the precondition: the board rendered (not its error sentence), so the measure is about a page carrying it
        expect(await page.locator(`${BOARD} .stlive__display table.stlive__board tbody tr`).count(), `${lang} ${String(width)}`).toBeGreaterThan(0);
        const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
        expect(over, `${lang} at ${String(width)} px scrolls sideways by ${String(over)} px`).toBeLessThanOrEqual(0);
        // the board's own box stays inside the viewport: a wide table scrolls in it, never past the page's edge
        const right = await page.$$eval(`${BOARD} .stlive__display`, (ds) => Math.max(...ds.filter((d) => (d as HTMLElement).offsetParent !== null).map((d) => d.getBoundingClientRect().right)));
        expect(right, `${lang} ${String(width)}`).toBeLessThanOrEqual(width);
        await ctx.close();
      }
    });
  }
});

describe("#1190: on the narrowest phones the board's state column keeps its word whole", () => {
  for (const width of [320, 360] as const) {
    it(`${String(width)} px: no state cell runs past two lines`, async () => {
      const ctx = await browser.newContext({ javaScriptEnabled: false, viewport: { width, height: 800 } });
      ctx.setDefaultTimeout(2000);
      const page = await ctx.newPage();
      await page.goto(`${BASE}${stationPath("de", "koeln-hbf")}`, { waitUntil: "domcontentloaded" });
      // Lines counted from the text's own boxes: a cell's height is its row's, which the destination and the countdown set too.
      const lines = await page.$$eval(`${BOARD} .stlive__display td.pcard__st`, (cells) =>
        cells.filter((c) => (c as HTMLElement).offsetParent !== null).map((c) => {
          const range = document.createRange();
          range.selectNodeContents(c);
          return new Set([...range.getClientRects()].filter((r) => r.width > 0).map((r) => Math.round(r.bottom))).size;
        }),
      );
      expect(lines.length, "the board rendered no state cell: this would read nothing").toBeGreaterThan(2);
      expect(Math.max(...lines), `state cells' lines at ${String(width)} px: ${lines.join(",")}`).toBeLessThanOrEqual(2);
      await ctx.close();
    });

    // A stop's own page holds the same board in no card at all, so `.stlive--stop` is its container (station-page.css).
    // Every language, because the table's least width is the copy's: without that container the German page still fits
    // at 320 px (measured), while /ru, /uk, /pl, /pt, /el, /it, /lt, /hu, /es, /nl and /sr scroll sideways by 2-57 px.
    for (const lang of LIVE_LANGS) {
      const path = `/${lang}/station/koeln-hbf/stop/de-05315-12001`;
      it(`${String(width)} px: ${path} scrolls sideways nowhere`, async () => {
        const ctx = await browser.newContext({ javaScriptEnabled: false, viewport: { width, height: 800 } });
        ctx.setDefaultTimeout(2000);
        const page = await ctx.newPage();
        await page.goto(`${BASE}${path}`, { waitUntil: "domcontentloaded" });
        // the precondition: the stop's board rendered inside the container this measures
        expect(await page.locator(".stlive--stop table.pcard__board tbody tr").count(), `${path} at ${String(width)} px: no board`).toBeGreaterThan(0);
        const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
        expect(over, `${path} at ${String(width)} px scrolls sideways by ${String(over)} px`).toBeLessThanOrEqual(0);
        await ctx.close();
      });
    }
  }
});

describe("#1083 AC 4: the board is read as a table, row by row", () => {
  for (const lang of ["de", "en"] as const) {
    it(`${lang}: a table named by its head line, five column headers, each departure a row of five cells`, async () => {
      const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
      ctx.setDefaultTimeout(2000);
      const page = await ctx.newPage();
      await page.goto(`${BASE}${stationPath(lang, "koeln-hbf")}`, { waitUntil: "networkidle" });
      const word = lang === "de" ? "Abfahrt" : "Departures";
      const table = page.locator(BOARD).getByRole("table", { name: new RegExp(`^${word} Köln Hbf `, "u") });
      expect(await table.count()).toBe(1);
      expect(await table.getByRole("columnheader").count()).toBe(5);
      const rows = table.locator("tbody tr:visible");
      const n = await rows.count();
      expect(n).toBeGreaterThan(2);
      for (let i = 0; i < n; i++) expect(await rows.nth(i).getByRole("cell").count(), `row ${String(i)}`).toBe(5);
      await ctx.close();
    });
  }
});

describe("#1083 AC 4: axe reports no violation inside the board", () => {
  for (const scheme of ["light", "dark"] as const) {
    it(`320 px, ${scheme}`, async () => {
      const ctx = await browser.newContext({ viewport: { width: 320, height: 800 }, colorScheme: scheme, reducedMotion: "reduce" });
      ctx.setDefaultTimeout(2000);
      const page = await ctx.newPage();
      await page.goto(`${BASE}${stationPath("de", "koeln-hbf")}`, { waitUntil: "networkidle" });
      expect(await page.locator(`${BOARD} table.stlive__board`).count()).toBeGreaterThan(0);
      const axe = await new AxeBuilder({ page }).include(BOARD).analyze();
      expect(axe.violations.map((v) => `${v.id}: ${v.nodes.map((x) => x.target.join(" ")).slice(0, 2).join(" | ")}`)).toEqual([]);
      await ctx.close();
    });
  }
});
