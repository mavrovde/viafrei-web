/**
 * #996 (2.3.23): the motorway page's search in a real browser, against the BUILT shell and the REAL digest.
 *
 *  - typing shows the results without a reload (the page's own script asks the page with `?find=` and swaps in its
 *    search section; the box keeps focus), the count is announced through the one status region, the first result
 *    links to its row and the row scrolls into view;
 *  - with JavaScript off, the same results through the form;
 *  - axe finds no serious or critical violation on the page with results.
 *
 * The fixture's A7 (`real-digest.ts`) names its junctions "Musterstadt-<side> <n>".
 */
import type { ChildProcess } from "node:child_process";
import { AxeBuilder } from "@axe-core/playwright";
import { chromium, type Browser } from "playwright";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { motorwayPath } from "../src/site/motorways.js";
import { startRealDigest } from "./real-digest.js";
import { startShell } from "./server.js";

const PORT = 8818;
const BASE = `http://127.0.0.1:${PORT}`;
const QUERY = "Musterstadt-Ost 3";
let browser: Browser;
let shell: ChildProcess;
let digest: Awaited<ReturnType<typeof startRealDigest>>;

beforeAll(async () => {
  digest = await startRealDigest();
  shell = await startShell(PORT, { DIGEST_URL: digest.url, IMPRESSUM_NAME: "Site Probe", IMPRESSUM_STREET: "Probeweg 3", IMPRESSUM_CITY: "00000 Probe", IMPRESSUM_EMAIL: "site@example.invalid" });
  browser = await chromium.launch();
});
afterAll(async () => {
  await browser?.close();
  shell?.kill();
  await digest?.close();
});

describe("#996: search as you type on /de/autobahn/a7", () => {
  it("results appear without a reload, the box keeps focus, the count is announced, the first result's row scrolls into view", async () => {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const page = await ctx.newPage();
    try {
      await page.goto(`${BASE}${motorwayPath("de", "A7")}`, { waitUntil: "load" });
      // a marker the page keeps only while it is not reloaded
      await page.evaluate(() => ((window as unknown as { vfMark: number }).vfMark = 1));
      await page.locator("#mws-q").pressSequentially(QUERY, { delay: 20 });
      await page.waitForSelector("#mw-search .mws__hit");
      expect(await page.evaluate(() => (window as unknown as { vfMark?: number }).vfMark)).toBe(1);
      expect(await page.evaluate(() => document.activeElement?.id)).toBe("mws-q");
      expect(await page.inputValue("#mws-q")).toBe(QUERY);
      // the address follows the query, so the result can be shared
      expect(new URL(page.url()).searchParams.get("find")).toBe(QUERY);
      // grouped: a list under a heading per panel; the count said once, politely, by the region the script keeps
      expect(await page.locator("#mw-search h3.mws__g").count()).toBeGreaterThan(0);
      expect(await page.locator("#mw-search ol.mws__list").count()).toBeGreaterThan(0);
      await expect.poll(() => page.textContent("#mw-search .mws__live")).toMatch(/Treffer/);
      expect(await page.locator('#mw-search [aria-live="polite"]').count()).toBe(1);
      // the first result links to its row on the page; following it brings the row into view
      const first = page.locator("#mw-search .mws__hit").first().locator('a[href^="#"]').first();
      const id = (await first.getAttribute("href"))!.slice(1);
      expect(await page.locator(`[id="${id}"]`).count()).toBe(1);
      await first.focus();
      await page.keyboard.press("Enter");
      // In view = its box meets the viewport. Not `top >= 0`: a row scrolled to the top
      // sits at a sub-pixel offset (-0.39 px measured once the 2.4.1 map thumbnail gave
      // the page fractional heights), and the strict check failed 2 runs in 3. The jump is
      // instant on a motorway page (motorway-page.css); the poll allows the owner's 2 s and no more.
      await expect.poll(() => page.evaluate((x) => { const r = document.getElementById(x)!.getBoundingClientRect(); return r.bottom > 0 && r.top < window.innerHeight && r.height > 0; }, id), { timeout: 2_000 }).toBe(true);
      // keyboard: the results are reachable by Tab from the box
      await page.locator("#mws-q").focus();
      for (let k = 0; k < 6; k++) await page.keyboard.press("Tab");
      expect(await page.evaluate(() => document.activeElement?.closest("#mw-search") !== null)).toBe(true);
      // and axe is clean with the results shown
      const r = await new AxeBuilder({ page }).include("#mw-search").withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
      expect(r.violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => v.id)).toEqual([]);
    } finally {
      await ctx.close();
    }
  });

  it("with JavaScript off, the form answers the same results", async () => {
    const live = await browser.newContext();
    const off = await browser.newContext({ javaScriptEnabled: false });
    try {
      const a = await live.newPage();
      await a.goto(`${BASE}${motorwayPath("de", "A7")}`, { waitUntil: "load" });
      await a.locator("#mws-q").pressSequentially(QUERY, { delay: 20 });
      await a.waitForSelector("#mw-search .mws__hit");
      const typed = await a.$$eval("#mw-search .mws__hit a[href^='#']", (xs) => xs.map((x) => x.getAttribute("href")));
      const b = await off.newPage();
      await b.goto(`${BASE}${motorwayPath("de", "A7")}`, { waitUntil: "load" });
      await b.fill("#mws-q", QUERY);
      await Promise.all([b.waitForURL(/find=/), b.press("#mws-q", "Enter")]);
      const formed = await b.$$eval("#mw-search .mws__hit a[href^='#']", (xs) => xs.map((x) => x.getAttribute("href")));
      expect(formed.length).toBeGreaterThan(0);
      expect(typed).toEqual(formed);
    } finally {
      await live.close();
      await off.close();
    }
  });
});
