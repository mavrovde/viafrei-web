/**
 * #1147 against the REAL built shell and the REAL digest renderer over the fixture (no database, no network): the
 * transit card's mode chips filter its departures with no script at all (CSS only), its stop's facts are one closed
 * disclosure, and the station board's "Abfahrten | Ankünfte" tabs follow the WAI-ARIA tabs pattern with a script and
 * leave both tables standing, each under its heading, without one.
 */
import type { ChildProcess } from "node:child_process";
import { AxeBuilder } from "@axe-core/playwright";
import { chromium, type Browser, type Page } from "playwright";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { stationPath } from "../src/site/stations.js";
import { startRealDigest } from "./real-digest.js";
import { startShell } from "./server.js";

/** #1176: on a phone a place's cards after the first (a station's area: every card) are folded; a person opens a card's fold first. */
async function unfold(page: Page): Promise<void> {
  // opened as a person's click does, without one: a desktop or print shows no summary to click (it is open there by CSS)
  await page.$$eval("details.pcard__fold:not([open])", (ds) => ds.forEach((d) => d.setAttribute("open", "")));
}

const PORT = 8877;
const BASE = `http://127.0.0.1:${String(PORT)}`;
const PHONE = { width: 390, height: 844 };

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

const CARD = "#pcard-stations";
/** The modes of the departure rows a reader can see. */
const shownModes = (page: Page): Promise<string[]> =>
  page.$$eval(`${CARD} tr[data-mode]`, (rows) => rows.filter((r) => (r as HTMLElement).offsetParent !== null).map((r) => r.getAttribute("data-mode") ?? ""));
/** How many stop entries a reader can see, and how many of them show no row at all. */
const stops = (page: Page): Promise<{ shown: number; empty: number }> =>
  page.$$eval(`${CARD} li:has(> .pcard__stop)`, (lis) => {
    const shown = lis.filter((l) => (l as HTMLElement).offsetParent !== null);
    return { shown: shown.length, empty: shown.filter((l) => ![...l.querySelectorAll("tr[data-mode]")].some((r) => (r as HTMLElement).offsetParent !== null)).length };
  });

describe("#1147: the transit card on Köln's place page (a phone's browser)", () => {
  for (const js of [true, false]) {
    it(`JavaScript ${js ? "on" : "off"}: everything shows; the bus chip leaves the bus rows and the stops that have one; 'alle' restores`, async () => {
      const ctx = await browser.newContext({ javaScriptEnabled: js, viewport: PHONE });
      ctx.setDefaultTimeout(2000);
      const page = await ctx.newPage();
      await page.goto(`${BASE}/de/place/koeln`, { waitUntil: "domcontentloaded" });
      await unfold(page);
      await page.locator(`${CARD} fieldset.tmchips`).waitFor();
      expect((await page.textContent(`${CARD} fieldset.tmchips legend`))?.trim()).toBe("Verkehrsmittel");
      const all = await shownModes(page);
      expect(new Set(all).size).toBeGreaterThan(1);
      const before = await stops(page);
      await page.click(`${CARD} fieldset.tmchips label.chip:has(input[value="bus"])`);
      const bus = await shownModes(page);
      expect(bus.length).toBeGreaterThan(0);
      expect(bus.every((m) => m === "bus")).toBe(true);
      const after = await stops(page);
      expect(after.empty).toBe(0);
      expect(after.shown).toBeLessThanOrEqual(before.shown);
      await page.click(`${CARD} fieldset.tmchips label.chip:has(input[value=""])`);
      expect(await shownModes(page)).toEqual(all);
      await ctx.close();
    });
  }

  it("the chosen chip survives the card's refresh in place", async () => {
    const ctx = await browser.newContext({ viewport: PHONE });
    ctx.setDefaultTimeout(2000);
    const page = await ctx.newPage();
    await page.goto(`${BASE}/de/place/koeln`, { waitUntil: "networkidle" });
    await unfold(page);
    await page.click(`${CARD} fieldset.tmchips label.chip:has(input[value="bus"])`);
    // a marker the fresh card does not carry, so the swap is observable even when the answer is the same card
    await page.evaluate((c) => document.querySelector(c)?.insertAdjacentHTML("beforeend", '<i id="vf-1147-old" hidden></i>'), CARD);
    await Promise.all([page.waitForResponse((r) => r.url().includes("/fragment/card")), page.click(`${CARD} .pcard__refresh`)]);
    await page.waitForFunction(() => document.getElementById("vf-1147-old") === null);
    expect(await page.isChecked(`${CARD} fieldset.tmchips input[value="bus"]`)).toBe(true);
    expect((await shownModes(page)).every((m) => m === "bus")).toBe(true);
    await ctx.close();
  });

  it("a stop's facts are one closed disclosure after its departures, its summary naming what is out of service", async () => {
    const ctx = await browser.newContext({ viewport: PHONE });
    ctx.setDefaultTimeout(2000);
    const page = await ctx.newPage();
    await page.goto(`${BASE}/de/place/koeln`, { waitUntil: "domcontentloaded" });
    await unfold(page);
    const facts = page.locator(`${CARD} li:has(> .pcard__stop) details.pcard__more:has(.pcard__fac)`).first();
    await facts.waitFor();
    expect(await facts.evaluate((d) => (d as HTMLDetailsElement).open)).toBe(false);
    expect((await facts.locator("summary").textContent())?.trim()).toMatch(/^Ausstattung · Aufzüge: 1 außer Betrieb$/);
    expect(await facts.locator(".pcard__fac").isVisible()).toBe(false);
    // the departures come first: the table precedes the disclosure in its stop's entry
    expect(await facts.evaluate((d) => { const t = d.parentElement?.querySelector("table"); return t !== null && t !== undefined && (t.compareDocumentPosition(d) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0; })).toBe(true);
    await facts.locator("summary").click();
    expect(await facts.locator(".pcard__fac").isVisible()).toBe(true);
    const axe = await new AxeBuilder({ page }).include(CARD).analyze();
    expect(axe.violations.map((v) => v.id)).toEqual([]);
    await ctx.close();
  });
});

describe("#1147: the station board's departures and arrivals tabs", () => {
  const BOARD = "#pcard-station-board";

  it("JavaScript on: a tab list over one shown panel; the arrow key chooses Ankünfte in place and keeps the focus on it", async () => {
    const ctx = await browser.newContext({ viewport: PHONE });
    ctx.setDefaultTimeout(2000);
    const page = await ctx.newPage();
    await page.goto(`${BASE}${stationPath("de", "koeln-hbf")}`, { waitUntil: "networkidle" });
    await unfold(page);
    expect(await page.isVisible(`${BOARD} [role="tablist"]`)).toBe(true);
    expect(await page.getAttribute(`${BOARD} [role="tablist"]`, "aria-label")).toBeTruthy();
    expect(await page.$$eval(`${BOARD} [role="tab"]`, (ts) => ts.map((t) => `${t.textContent?.trim() ?? ""}|${t.getAttribute("aria-selected") ?? ""}|${t.getAttribute("tabindex") ?? ""}`))).toEqual(["Abfahrt|true|0", "Ankunft|false|-1"]);
    expect(await page.isVisible(`${BOARD} #pcard-station-board-dep table.stlive__board`)).toBe(true);
    expect(await page.isHidden(`${BOARD} #pcard-station-board-arr`)).toBe(true);
    // the panel heading repeats the tab's word, so it is not shown while the tabs are
    expect(await page.isHidden(`${BOARD} #pcard-station-board-dep h3.stlive__panelh`)).toBe(true);
    await page.focus(`${BOARD} #pcard-station-board-tab-dep`);
    await Promise.all([page.waitForURL(/side=arr/), page.keyboard.press("ArrowRight")]);
    await page.waitForFunction(() => document.querySelector("#pcard-station-board")?.getAttribute("aria-busy") !== "true");
    await page.waitForFunction(() => document.activeElement?.id === "pcard-station-board-tab-arr");
    expect(await page.getAttribute(`${BOARD} #pcard-station-board-tab-arr`, "aria-selected")).toBe("true");
    expect(await page.isVisible(`${BOARD} #pcard-station-board-arr table.stlive__board`)).toBe(true);
    expect(await page.isHidden(`${BOARD} #pcard-station-board-dep`)).toBe(true);
    await Promise.all([page.waitForURL((u) => !u.search.includes("side=arr")), page.keyboard.press("Home")]);
    await page.waitForFunction(() => document.activeElement?.id === "pcard-station-board-tab-dep");
    const axe = await new AxeBuilder({ page }).include(BOARD).analyze();
    expect(axe.violations.map((v) => v.id)).toEqual([]);
    await ctx.close();
  });

  it("JavaScript off: no tab list; both tables stand, each under its own heading", async () => {
    const ctx = await browser.newContext({ javaScriptEnabled: false, viewport: PHONE });
    ctx.setDefaultTimeout(2000);
    const page = await ctx.newPage();
    await page.goto(`${BASE}${stationPath("de", "koeln-hbf")}`, { waitUntil: "domcontentloaded" });
    await unfold(page);
    expect(await page.isHidden(`${BOARD} [role="tablist"]`)).toBe(true);
    expect(await page.$$eval(`${BOARD} h3.stlive__panelh`, (hs) => hs.filter((h) => (h as HTMLElement).offsetParent !== null).map((h) => h.textContent?.trim() ?? ""))).toEqual(["Abfahrt", "Ankunft"]);
    expect(await page.isVisible(`${BOARD} #pcard-station-board-dep table.stlive__board`)).toBe(true);
    expect(await page.isVisible(`${BOARD} #pcard-station-board-arr table.stlive__board`)).toBe(true);
    await ctx.close();
  });
});
