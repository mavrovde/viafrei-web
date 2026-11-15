/**
 * #1112 (the rest, 2.5.5): the position bar's chips in a real browser against the REAL built shell and a stand-in
 * digest (`stub-digest.ts`).
 *  - every chip is an ordinary link: without JavaScript the popular chips navigate, and a recent chip's link (the
 *    pill's rule, #1143: `?at=` for an addressable key, the page itself for a position) opens that place;
 *  - with JavaScript a chip changes the cards in place (the document is not replaced) and `place-live` announces the
 *    place alone ("Karten für …"), never the suggestion list, whose count has its own status line;
 *  - nothing is written to the device on load — the home, a place page and a motorway page, storage empty.
 *
 * Run in the pinned Linux image (laptop results are not evidence): `npx vitest run --config packages/web/vitest.e2e.config.ts place-chips-1112`.
 */
import { type ChildProcess } from "node:child_process";
import { chromium, type Browser, type BrowserContext, type Page } from "playwright";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { startShell } from "./server.js";
import { startStubDigest } from "./stub-digest.js";
import { motorwayPath } from "../src/site/motorways.js";
import { POPULAR_PLACES, placePath, popularSlug } from "../src/site/places.js";

const PORT = 8972;
const BASE = `http://127.0.0.1:${String(PORT)}`;
let browser: Browser;
let shell: ChildProcess;
let digest: Awaited<ReturnType<typeof startStubDigest>>;

beforeAll(async () => {
  digest = await startStubDigest({}, 5000, { fullCards: true });
  shell = await startShell(PORT, { DIGEST_URL: digest.url, WEB_TILE_TIMEOUT_MS: "2000", VF_MOTORWAY_AROUND: "1" });
  browser = await chromium.launch();
});
afterAll(async () => {
  await browser?.close();
  shell?.kill();
  await digest?.close();
});

/** A context whose every wait gives up after 2 s (owner 2026-10-26: no test timeout above 2 s). */
async function context(opts: Parameters<Browser["newContext"]>[0]): Promise<BrowserContext> {
  const ctx = await browser.newContext(opts);
  ctx.setDefaultTimeout(2000);
  ctx.setDefaultNavigationTimeout(2000);
  return ctx;
}

/** Every write to localStorage the page makes, from its first script on (recorded in the page, read back by the test). */
async function recordWrites(ctx: BrowserContext): Promise<void> {
  await ctx.addInitScript(() => {
    const w = window as unknown as { __vfWrites: string[] };
    w.__vfWrites = [];
    const own = Object.getOwnPropertyDescriptors(Storage.prototype);
    const set = own.setItem?.value as (this: Storage, k: string, v: string) => void;
    const del = own.removeItem?.value as (this: Storage, k: string) => void;
    const clr = own.clear?.value as (this: Storage) => void;
    Storage.prototype.setItem = function (k: string, v: string) {
      w.__vfWrites.push(`set ${k}`);
      return set.call(this, k, v);
    };
    Storage.prototype.removeItem = function (k: string) {
      w.__vfWrites.push(`del ${k}`);
      return del.call(this, k);
    };
    Storage.prototype.clear = function () {
      w.__vfWrites.push("clear");
      return clr.call(this);
    };
  });
}
const writes = (page: Page): Promise<string[]> => page.evaluate(() => (window as unknown as { __vfWrites: string[] }).__vfWrites);

async function home(page: Page, path = "/de"): Promise<void> {
  await page.goto(`${BASE}${path}`, { waitUntil: "networkidle" });
  await page.waitForSelector("#place-head:not([hidden])");
}
async function pick(page: Page, q: string, option: string): Promise<void> {
  await page.fill("#place-hq", q);
  const opt = page.locator("#place-hresults a.place-opt", { hasText: option });
  await opt.waitFor({ timeout: 2000 });
  await opt.click();
}
const live = async (page: Page): Promise<string> => ((await page.textContent("#place-live")) ?? "").trim();
const pillLabel = async (page: Page): Promise<string> => ((await page.locator("#place-pill-label").textContent()) ?? "").trim();

describe("#1112 nothing is written on load, storage empty", () => {
  for (const [kind, path] of [
    ["the home", "/de"],
    ["a place page", placePath("de", "koeln")],
    ["a motorway page", motorwayPath("de", "A7")],
  ] as const) {
    it(kind, async () => {
      const ctx = await context({ viewport: { width: 1000, height: 900 } });
      await recordWrites(ctx);
      const page = await ctx.newPage();
      await page.goto(`${BASE}${path}`, { waitUntil: "networkidle" });
      expect(await page.locator("#place-bar").count()).toBe(1);
      expect(await writes(page)).toEqual([]);
      expect(await page.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith("viafrei.place")))).toEqual([]);
      await ctx.close();
    });
  }
});

describe("#1112 chips are links: they work without JavaScript", () => {
  it("the popular chips are links that open their place's page", async () => {
    const ctx = await context({ viewport: { width: 1000, height: 900 }, javaScriptEnabled: false });
    const page = await ctx.newPage();
    await page.goto(`${BASE}/de`, { waitUntil: "networkidle" });
    expect(await page.locator("#place-recent button").count()).toBe(0);
    const hrefs = await page.$$eval("#place-recent a.place-opt", (as) => as.map((a) => a.getAttribute("href")));
    expect(hrefs).toEqual(POPULAR_PLACES.map((p) => placePath("de", popularSlug(p))));
    await page.click(`#place-recent a.place-opt[href="${placePath("de", "koeln")}"]`);
    await page.waitForURL(`${BASE}${placePath("de", "koeln")}`, { timeout: 2000 });
    await ctx.close();
  });

  it("a recent chip's link, opened without JavaScript, shows that place; a position's link is the page itself", async () => {
    // the recent chips are the island's: made with JavaScript, then followed by a browser without it
    const js = await context({ viewport: { width: 1000, height: 900 } });
    const page = await js.newPage();
    await home(page);
    await pick(page, "wehl", "Wehlheiden");
    await page.waitForFunction(() => (document.getElementById("place-live")?.textContent ?? "").includes("Kassel-Wehlheiden"));
    await pick(page, "wilhelmsh", "Wilhelmshöher Allee 99");
    await page.waitForFunction(() => document.querySelectorAll("#place-recent a.place-opt[data-at]").length === 2);
    const chips = await page.$$eval("#place-recent li > .place-opt", (as) => as.map((a) => [a.tagName, a.getAttribute("href"), a.getAttribute("data-at")]));
    expect(chips).toEqual([
      ["A", "/de", "pt:51.3115,9.4575"],
      ["A", "/de?at=dst:2891122", "dst:2891122"],
    ]);
    await js.close();

    const nojs = await context({ viewport: { width: 1000, height: 900 }, javaScriptEnabled: false });
    const plain = await nojs.newPage();
    const before = digest.hits.length;
    await plain.goto(`${BASE}/de?at=dst:2891122`, { waitUntil: "networkidle" });
    expect(await pillLabel(plain)).toBe("Kassel-Wehlheiden");
    expect(digest.hits.slice(before).some((h) => h.startsWith("/internal/place/cards") && h.includes("at=dst%3A2891122"))).toBe(true);
    // the position's link: the page itself — it answers, and no point stands in its address
    const res = await plain.goto(`${BASE}/de`, { waitUntil: "networkidle" });
    expect(res?.status()).toBe(200);
    await nojs.close();
  });
});

describe("#1112 with JavaScript a chip changes the cards in place; place-live speaks the place alone", () => {
  it("a recent chip's click swaps the cards in the same document, and the announcement is only 'Karten für …'", async () => {
    const ctx = await context({ viewport: { width: 1000, height: 900 } });
    await recordWrites(ctx);
    const page = await ctx.newPage();
    await home(page);
    expect(await writes(page)).toEqual([]);
    expect(await page.getAttribute("#place-hresults", "aria-live")).toBeNull();
    expect(await page.getAttribute("#place-hstatus", "role")).toBe("status");
    await pick(page, "wehl", "Wehlheiden");
    await page.waitForFunction(() => (document.getElementById("place-live")?.textContent ?? "").includes("Kassel-Wehlheiden"));
    await pick(page, "34121", "34121 Kassel");
    await page.waitForFunction(() => (document.getElementById("place-live")?.textContent ?? "").includes("34121 Kassel"));
    expect(await live(page)).toBe("Karten für 34121 Kassel geladen");
    // the suggestions: listed and counted on their own line — place-live still names the place alone
    await page.fill("#place-hq", "wehl");
    await page.locator("#place-hresults a.place-opt", { hasText: "Wehlheiden" }).waitFor({ timeout: 2000 });
    await page.waitForFunction(() => document.getElementById("place-hstatus")?.textContent === "Vorschläge: 1");
    expect(await live(page)).toBe("Karten für 34121 Kassel geladen");
    expect(await page.$eval("#place-live", (e) => e.contains(document.getElementById("place-hresults")))).toBe(false);
    await page.fill("#place-hq", "");
    // the chip click: the same document (a mark set on it survives), the cards and the pill follow, the address is replaced
    await page.evaluate(() => ((window as unknown as { __vfDoc: number }).__vfDoc = 1));
    const navigations = await page.evaluate(() => performance.getEntriesByType("navigation").length);
    const w0 = (await writes(page)).length;
    await page.click('#place-recent a.place-opt[data-at="dst:2891122"]');
    await page.waitForFunction(() => (document.getElementById("place-live")?.textContent ?? "") === "Karten für Kassel-Wehlheiden geladen");
    expect(await page.evaluate(() => (window as unknown as { __vfDoc?: number }).__vfDoc)).toBe(1);
    expect(await page.evaluate(() => performance.getEntriesByType("navigation").length)).toBe(navigations);
    expect(await pillLabel(page)).toBe("Kassel-Wehlheiden");
    expect(new URL(page.url()).search).toBe("?at=dst:2891122");
    expect(await live(page)).toBe("Karten für Kassel-Wehlheiden geladen");
    // one choice, the two existing keys, written on the click
    expect((await writes(page)).slice(w0)).toEqual(["set viafrei.place", "set viafrei.place.recent"]);
    // the pill and the chip link the same address (one rule)
    expect(await page.getAttribute("#place-pill", "href")).toBe(await page.getAttribute('#place-recent a.place-opt[data-at="dst:2891122"]', "href"));
    await ctx.close();
  });

  it("a position chip (a link to the page itself) is taken by the island: the cards change, the page is not reloaded", async () => {
    const ctx = await context({ viewport: { width: 1000, height: 900 } });
    const page = await ctx.newPage();
    await home(page);
    await pick(page, "wilhelmsh", "Wilhelmshöher Allee 99");
    await page.waitForFunction(() => (document.getElementById("place-live")?.textContent ?? "").includes("Wilhelmshöher"));
    await pick(page, "34121", "34121 Kassel");
    await page.waitForFunction(() => (document.getElementById("place-live")?.textContent ?? "").includes("34121 Kassel"));
    await page.evaluate(() => ((window as unknown as { __vfDoc: number }).__vfDoc = 1));
    const chip = '#place-recent a.place-opt[data-at="pt:51.3115,9.4575"]';
    expect(await page.getAttribute(chip, "href")).toBe("/de");
    await page.click(chip);
    await page.waitForFunction(() => (document.getElementById("place-live")?.textContent ?? "") === "Karten für Wilhelmshöher Allee 99, Kassel geladen");
    expect(await page.evaluate(() => (window as unknown as { __vfDoc?: number }).__vfDoc)).toBe(1);
    // a point never enters the address
    expect(new URL(page.url()).search).toBe("");
    await ctx.close();
  });
});
