/**
 * #1091 against the REAL built shell and the REAL digest (Köln Hbf's fixture board carries more rows than the board
 * shows): the folded rows open INSIDE the board's one table, so every column of the rest starts at the x position of
 * the same column above the fold — departures and arrivals, at 390 and 1280 px — and the fold opens and closes with
 * JavaScript off as well as on. The source half is `packages/digest/src/presentation/station-board-fold-1091.test.ts`.
 * Measured in the Linux image only.
 */
import type { ChildProcess } from "node:child_process";
import { chromium, type Browser, type Page } from "playwright";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { stationPath } from "../src/site/stations.js";
import { startRealDigest } from "./real-digest.js";
import { startShell } from "./server.js";
import { gotoSettled } from "./settle.js";

const PORT = 8932;
const BASE = `http://127.0.0.1:${String(PORT)}`;
let browser: Browser;
let shell: ChildProcess;
let digest: Awaited<ReturnType<typeof startRealDigest>>;

beforeAll(async () => {
  digest = await startRealDigest();
  shell = await startShell(PORT, { DIGEST_URL: digest.url, WEB_TILE_TIMEOUT_MS: "2000" });
  browser = await chromium.launch();
});
afterAll(async () => {
  await browser?.close();
  shell?.kill();
  await digest?.close();
});

/**
 * The left edge of each cell of the first row above the fold and of the first row of the rest — in the panel shown
 * (#1147: the board carries a departures and an arrivals panel; with a script one is hidden, without both stand).
 */
const columns = (page: Page, card: string) =>
  page.evaluate((id) => {
    const t = document.querySelector(`#${id} .stlive__panel:not([hidden]) table.stlive__board`) as HTMLTableElement;
    const [shown, rest] = [...t.tBodies];
    const xs = (r: HTMLTableRowElement | undefined | null): number[] => [...(r?.cells ?? [])].map((c) => Math.round(c.getBoundingClientRect().left));
    return { tables: document.querySelectorAll(`#${id} .stlive__panel:not([hidden]) table`).length, heads: t.tHead?.rows.length ?? 0, above: xs(shown?.rows[0]), below: xs(rest?.rows[0]), restShown: rest !== undefined && getComputedStyle(rest).display !== "none" };
  }, card);

const CARDS = [
  { card: "pcard-station-board", query: "" },
  { card: "pcard-station-board", query: "?side=arr" },
] as const;

describe("#1091: the folded rows line up with the board", () => {
  for (const width of [390, 1280] as const) {
    for (const { card, query } of CARDS) {
      it(`${String(width)} px${query === "" ? " departures" : " arrivals"}: one table, one header, each column at the same x above and below the fold`, async () => {
        const ctx = await browser.newContext({ viewport: { width, height: 900 } });
        ctx.setDefaultTimeout(2000);
        const page = await ctx.newPage();
        // parsed and quiet, not `networkidle`: that fired before DOMContentLoaded here, while the tabs script at the end of
        // the body had not yet hidden the arrivals panel (two tables "shown") or the board was not yet parsed (e2e/settle.ts)
        await gotoSettled(page, `${BASE}${stationPath("de", "koeln-hbf")}${query}`, { timeout: 2000 });
        const before = await columns(page, card);
        expect(before.tables).toBe(1);
        expect(before.heads).toBe(1);
        expect(before.restShown).toBe(false);
        await page.click(`#${card} .stlive__panel:not([hidden]) details.pcard__more--rows > summary`);
        const after = await columns(page, card);
        expect(after.restShown).toBe(true);
        expect(after.below.length).toBe(after.above.length);
        expect(after.below).toEqual(after.above);
        expect(await page.getAttribute(`#${card} .stlive__panel:not([hidden]) details.pcard__more--rows > summary`, "aria-controls")).toBe(`${query === "" ? card : "pcard-station-arrivals"}-rest`);
        await ctx.close();
      });
    }
  }

  it("JavaScript off: the fold opens and closes, and the rest stays in the one table", async () => {
    const ctx = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 1280, height: 900 } });
    ctx.setDefaultTimeout(2000);
    const page = await ctx.newPage();
    await page.goto(`${BASE}${stationPath("de", "koeln-hbf")}`, { waitUntil: "domcontentloaded" });
    const card = "pcard-station-board";
    expect((await columns(page, card)).restShown).toBe(false);
    await page.click(`#${card} .stlive__panel:not([hidden]) details.pcard__more--rows > summary`);
    const open = await columns(page, card);
    expect(open.restShown).toBe(true);
    expect(open.below).toEqual(open.above);
    await page.click(`#${card} .stlive__panel:not([hidden]) details.pcard__more--rows > summary`);
    expect((await columns(page, card)).restShown).toBe(false);
    await ctx.close();
  });
});
