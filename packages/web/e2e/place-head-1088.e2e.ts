/**
 * #1088: the place choice, in a real browser against the REAL built shell and a stand-in digest (`stub-digest.ts`):
 * the headline "Live für [📍 X ▾] [🇩🇪 Ganz Deutschland]" in the first screen, the two-way switch (radio group
 * "Bereich") with and without JavaScript, and the search for an address, a postcode and a district in the headline —
 * with no address, postcode or typed text in any URL the page requests or shows (since #1112 the page's own address
 * carries a picked place's KEY, `?at=dst:…`, never a point or a word typed), and since #1113 the switch's clicks keep
 * the choice (one write path) while a load keeps nothing.
 *
 * Run in the pinned Linux image (laptop results are not evidence): `npx vitest run --config packages/web/vitest.e2e.config.ts place-head-1088`.
 */
import { execFileSync, type ChildProcess } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium, type Browser, type Page } from "playwright";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { startShell } from "./server.js";
import { startStubDigest } from "./stub-digest.js";
import { motorwayPath } from "../src/site/motorways.js";

const PORT = 8941;
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

/**
 * Every URL the page asked for, and the page's own addresses — none may carry what was typed or picked. #1112: the
 * one exception is the page's own address after a pick, which carries the place's shareable KEY (`?at=dst:…`,
 * `?at=plz:…`), never a point and never the words typed; `addresses` holds those for the caller to judge.
 */
function watch(page: Page): string[] & { addresses: string[] } {
  const urls = Object.assign([] as string[], { addresses: [] as string[] });
  page.on("request", (r) => urls.push(r.url()));
  page.on("framenavigated", (f) => {
    const u = f.url();
    if (/[?&]at=(?:ags|slug|dst|plz|poi):[\w-]+$/u.test(u)) urls.addresses.push(u);
    else urls.push(u);
  });
  return urls;
}
const radio = (page: Page, id: string): Promise<string | null> => page.getAttribute(`#${id}`, "aria-checked");
const label = async (page: Page): Promise<string> => ((await page.locator("#place-pill-label").textContent()) ?? "").trim();

async function home(page: Page, path = "/de"): Promise<void> {
  await page.goto(`${BASE}${path}`, { waitUntil: "networkidle" });
  await page.waitForSelector("#place-head:not([hidden])");
}

async function search(page: Page, q: string, option: string): Promise<void> {
  await page.fill("#place-hq", q);
  // #1153: the header's list also names the motorways, stations and pages a word matches; the place leads it
  const opt = page.locator("#place-hresults a.place-opt", { hasText: option }).first();
  await opt.waitFor({ timeout: 2000 });
  await opt.click();
}

describe("the headline in the first screen (#1088 AC 1)", () => {
  for (const viewport of [
    { width: 390, height: 844 },
    { width: 1280, height: 900 },
  ]) {
    it(`${String(viewport.width)}×${String(viewport.height)}: "Live für", the place and "Ganz Deutschland" are on screen before any scroll, with no horizontal scroll`, async () => {
      const ctx = await browser.newContext({ viewport });
      const page = await ctx.newPage();
      await home(page);
      for (const sel of ["#place-head-lead", "#place-pill", "#place-scope-de"]) {
        const box = await page.$eval(sel, (e) => e.getBoundingClientRect().toJSON() as DOMRect);
        expect(box.bottom, sel).toBeLessThanOrEqual(viewport.height);
        expect(box.right, sel).toBeLessThanOrEqual(viewport.width);
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(viewport.width);
      expect(await page.getAttribute("#place-scope", "role")).toBe("radiogroup");
      expect(await page.getAttribute("#place-scope", "aria-label")).toBe("Bereich");
      await ctx.close();
    });
  }
  // #1153 (owner 2026-11-03): the headline is the header's, on every page — no longer a sticky row of the place section
  it("the row is in the header, above the place section, and the place section carries none", async () => {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = await ctx.newPage();
    await home(page);
    await search(page, "Köln", "Köln");
    await page.waitForSelector("#place-slot .pcard");
    expect(await page.$eval(".placehead", (e) => e.closest("header") !== null)).toBe(true);
    expect(await page.locator("#place .placehead").count()).toBe(0);
    const row = await page.$eval(".placehead", (e) => e.getBoundingClientRect().bottom);
    const section = await page.$eval("#place", (e) => e.getBoundingClientRect().top);
    expect(row).toBeLessThanOrEqual(section);
    await ctx.close();
  });
});

describe("the two-way switch (#1088 AC 6)", () => {
  it("'Ganz Deutschland' and back: the radios follow, the change is marked, nothing is stored", async () => {
    const ctx = await browser.newContext({ viewport: { width: 1000, height: 900 } });
    const page = await ctx.newPage();
    await home(page);
    await search(page, "Köln", "Köln");
    await page.waitForFunction(() => document.getElementById("place-pill-label")?.textContent?.trim() === "Köln");
    await page.evaluate(() => window.localStorage.clear());
    // #1138: one "Ganz Deutschland" control on the live page, the headline's radio — the bar carries no chip of it
    const germany = (): Promise<string[]> =>
      page.$$eval("a, button", (els) => els.filter((e) => (e.textContent ?? "").replace("🇩🇪", "").trim() === "Ganz Deutschland").map((e) => e.id));
    expect(await germany()).toEqual(["place-scope-de"]);
    await page.click("#place-scope-de");
    expect(await germany()).toEqual(["place-scope-de"]);
    expect(await radio(page, "place-scope-de")).toBe("true");
    expect(await radio(page, "place-pill")).toBe("false");
    expect(await page.locator("#place-slot .pcard").count()).toBe(0);
    expect(await page.textContent("#place-upd")).toBe("aktualisiert für Ganz Deutschland");
    expect(await label(page)).toBe("Köln");
    await page.click("#place-pill");
    await page.waitForSelector("#place-slot .pcard");
    expect(await radio(page, "place-pill")).toBe("true");
    expect(await page.textContent("#place-upd")).toBe("aktualisiert für Köln");
    // #1113: both radios are a choice, kept on the click — going back keeps Köln, the place it went back to, and no
    // point; #1112: the address follows the choice with the place's key
    const kept = await page.evaluate(() => JSON.parse(window.localStorage.getItem("viafrei.place") ?? "null") as { at: string; label: string; how: string } | null);
    expect(kept).toMatchObject({ at: "ags:05315000", label: "Köln", how: "manual" });
    expect(new URL(page.url()).search).toBe("?at=ags:05315000");
    await ctx.close();
  });
  // #1153: the echo is retired — the header's own headline names the place, on a wide screen and on a phone
  it("the header names the shown place on a wide screen and on a phone, and follows the switch", async () => {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await ctx.newPage();
    await home(page);
    await search(page, "Köln", "Köln");
    await page.waitForFunction(() => document.querySelector("header #place-pill-label")?.textContent?.trim() === "Köln");
    expect(await page.locator("#site-place").count()).toBe(0);
    // the connect button stays exactly as it was (#1089)
    expect(await page.locator(".site-head__cta").count()).toBe(1);
    await page.click("#place-scope-de");
    expect(await radio(page, "place-scope-de")).toBe("true");
    await page.setViewportSize({ width: 390, height: 844 });
    // #1174 (owner 2026-11-05, decision 3): on a phone a bar that knows its place folds to the pill; one press opens it whole
    expect(await page.locator("header #place-pill").isVisible()).toBe(true);
    if ((await page.getAttribute("#place-pill", "aria-expanded")) === "false") await page.click("#place-pill");
    for (const sel of ["#place-head-lead", "#place-pill", "#place-scope-de", "#place-hq"]) expect(await page.locator(`header ${sel}`).isVisible(), sel).toBe(true);
    await ctx.close();
  });

  it("the arrow keys move between the two radios", async () => {
    const ctx = await browser.newContext({ viewport: { width: 1000, height: 900 } });
    const page = await ctx.newPage();
    await home(page);
    await search(page, "Köln", "Köln");
    await page.waitForSelector("#place-slot .pcard");
    await page.focus("#place-pill");
    await page.keyboard.press("ArrowRight");
    expect(await radio(page, "place-scope-de")).toBe("true");
    expect(await page.evaluate(() => document.activeElement?.id)).toBe("place-scope-de");
    await ctx.close();
  });
  it("without JavaScript both radios are links: ?scope=de is all of Germany, the place radio leads back", async () => {
    const ctx = await browser.newContext({ viewport: { width: 1000, height: 900 }, javaScriptEnabled: false });
    const page = await ctx.newPage();
    const before = digest.hits.length;
    await page.goto(`${BASE}/de?scope=de`, { waitUntil: "networkidle" });
    expect(await radio(page, "place-scope-de")).toBe("true");
    expect(await page.getAttribute("#place-pill", "href")).toBe("/de");
    expect(await page.getAttribute("#place-scope-de", "href")).toBe("/de?scope=de");
    // #1112: the bar's search is a plain GET form to the site search, so it works without script too
    expect(await page.locator("#place-head").isVisible()).toBe(true);
    expect(await page.getAttribute("#place-head", "method")).toBe("get");
    // no place's cards were asked for this render: "Ganz Deutschland" looks nothing up
    expect(digest.hits.slice(before).filter((h) => h.startsWith("/internal/place/cards"))).toEqual([]);
    await ctx.close();
  });
  it("on a motorway page too", async () => {
    const ctx = await browser.newContext({ viewport: { width: 1000, height: 900 } });
    const page = await ctx.newPage();
    const path = motorwayPath("de", "A7");
    await page.goto(`${BASE}${path}?scope=de`, { waitUntil: "networkidle" });
    expect(await radio(page, "place-scope-de")).toBe("true");
    expect(await page.getAttribute("#place-scope-de", "href")).toBe(`${path}?scope=de`);
    expect(await page.getAttribute("#place-pill", "href")).toBe(path);
    await ctx.close();
  });
});

describe("search in the headline: address, postcode, district, point of interest (#1088 AC 7, 8)", () => {
  it("a district: grouped with its kind and a map link; the place is named as picked", async () => {
    const ctx = await browser.newContext({ viewport: { width: 1000, height: 900 } });
    const page = await ctx.newPage();
    const urls = watch(page);
    await home(page);
    await page.fill("#place-hq", "Wehlheiden");
    const opt = page.locator("#place-hresults li.place-sug", { hasText: "Wehlheiden" });
    await opt.waitFor({ timeout: 2000 });
    expect(await opt.textContent()).toContain("Stadtteil");
    expect(await opt.locator(".place-sug__map a").textContent()).toBe("Karte");
    expect(await page.getAttribute("#place-hq", "aria-expanded")).toBe("true");
    await opt.locator("a.place-opt").click();
    await page.waitForFunction(() => document.getElementById("place-pill-label")?.textContent?.trim() === "Kassel-Wehlheiden");
    for (const u of urls) expect(u).not.toMatch(/Wehlheiden|dst%3A|dst:/iu);
    expect(urls.addresses.map((u) => new URL(u).search)).toEqual(["?at=dst:2891122"]);
    await ctx.close();
  });
  it("a postcode", async () => {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = await ctx.newPage();
    const urls = watch(page);
    await home(page);
    await search(page, "34121", "34121 Kassel");
    await page.waitForFunction(() => document.getElementById("place-pill-label")?.textContent?.trim() === "34121 Kassel");
    for (const u of urls) expect(u).not.toContain("34121");
    expect(urls.addresses.map((u) => new URL(u).search)).toEqual(["?at=plz:34121"]);
    await ctx.close();
  });
  it("an address whose house number is missing: the nearest is offered and said so; nothing of it in any URL", async () => {
    const ctx = await browser.newContext({ viewport: { width: 1000, height: 900 } });
    const page = await ctx.newPage();
    const urls = watch(page);
    await home(page);
    await page.fill("#place-hq", "Wilhelmshöher Allee 100, Kassel");
    const opt = page.locator("#place-hresults li.place-sug", { hasText: "Wilhelmshöher" });
    await opt.waitFor({ timeout: 2000 });
    expect(await opt.textContent()).toContain("Hausnummer 100 nicht gefunden – nächste: 99");
    await opt.locator("a.place-opt").click();
    await page.waitForFunction(() => document.getElementById("place-pill-label")?.textContent?.trim() === "Wilhelmshöher Allee 99, Kassel");
    for (const u of urls) expect(u).not.toMatch(/Wilhelm|Allee|pt%3A|pt:/iu);
    expect(new URL(page.url()).search).toBe("");
    await ctx.close();
  });
  // owner 2026-10-28: "Main search must also provide search by poi additionaly"
  it("a point of interest: typed, listed with its town and kind, picked — the headline names the POI", async () => {
    const ctx = await browser.newContext({ viewport: { width: 1000, height: 900 } });
    const page = await ctx.newPage();
    const urls = watch(page);
    await home(page);
    await page.fill("#place-hq", "Allianz Arena");
    const opt = page.locator("#place-hresults li.place-sug", { hasText: "Allianz Arena" });
    await opt.waitFor({ timeout: 2000 });
    expect(await opt.locator(".place-opt__where").textContent()).toBe("· München · Stadion");
    expect(await opt.locator(".place-sug__map a").textContent()).toBe("Karte");
    await opt.locator("a.place-opt").click();
    await page.waitForFunction(() => document.getElementById("place-pill-label")?.textContent?.trim() === "Allianz Arena, München");
    // the POI is the place: the digest was asked about its key, and what was typed is in no URL
    expect(digest.hits.some((h) => h.includes("poi%3A418230") || h.includes("poi:418230"))).toBe(true);
    for (const u of urls) expect(u).not.toMatch(/Allianz/iu);
    await ctx.close();
  });
  it("Escape clears the list and returns to the search; ArrowDown walks into it", async () => {
    const ctx = await browser.newContext({ viewport: { width: 1000, height: 900 } });
    const page = await ctx.newPage();
    await home(page);
    await page.fill("#place-hq", "Wehlheiden");
    await page.locator("#place-hresults a.place-opt").first().waitFor({ timeout: 2000 });
    await page.keyboard.press("ArrowDown");
    expect(await page.evaluate(() => document.activeElement?.classList.contains("place-opt"))).toBe(true);
    await page.keyboard.press("Escape");
    expect(await page.locator("#place-hresults a.place-opt").count()).toBe(0);
    expect(await page.evaluate(() => document.activeElement?.id)).toBe("place-hq");
    await ctx.close();
  });
});

/**
 * #1098: on the FIRST load the header's echo already names the headline's place, whatever chose it — an address
 * (`?at=`), the IP guess, a remembered place — and nothing appears on load that did not before ("aktualisiert für").
 * A second shell with a GeoIP file built from the test fixture (192.0.2.0/25 is Köln), so the IP rung answers.
 */
describe("#1098: the header echo on the first load", () => {
  const IP_PORT = 8942;
  const GEO_DIR = mkdtempSync(join(tmpdir(), "vf-head-geo-"));
  const GEO_FILE = join(GEO_DIR, "geoip.vfgeo");
  // a person's browser: the IP rung never answers a crawler, and headless Chromium names itself one (`CRAWLER_WORDS`)
  const PERSON_UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";
  let ipShell: ChildProcess | undefined;
  beforeAll(async () => {
    const here = dirname(fileURLToPath(import.meta.url));
    const csv = readFileSync(join(here, "..", "test", "fixtures", "geoip-fixture.csv"), "utf8");
    execFileSync(process.execPath, [join(here, "..", "..", "..", "scripts", "geoip-build.mjs"), "--release", "2026-10", "--out", GEO_FILE, "--min-de-ranges", "1"], { input: csv, encoding: "utf8" });
    ipShell = await startShell(IP_PORT, { DIGEST_URL: digest.url, WEB_TILE_TIMEOUT_MS: "2000", GEOIP_FILE: GEO_FILE });
  });
  afterAll(() => {
    ipShell?.kill();
    rmSync(GEO_DIR, { recursive: true, force: true });
  });
  /** #1153: the header's headline is on screen and names a place (the echo of #1098 is retired with it). */
  const echoNamesHeadline = async (page: Page): Promise<void> => {
    await page.waitForFunction(() => {
      const pill = (document.querySelector("header #place-pill-label")?.textContent ?? "").trim();
      return pill !== "" && pill !== "Ort wählen" && pill !== "Choose a place" && document.querySelector("#place-pill")?.getAttribute("aria-checked") === "true";
    });
    expect(await page.locator("header #place-pill").isVisible()).toBe(true);
  };
  for (const lang of ["de", "en"] as const) {
    it(`${lang}: ?at=, an IP guess and a remembered place — visible and named from the first render, no update line on load`, async () => {
      const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, userAgent: PERSON_UA, extraHTTPHeaders: { "X-Forwarded-For": "192.0.2.10" } });
      ctx.setDefaultTimeout(2000);
      const page = await ctx.newPage();
      await page.goto(`http://127.0.0.1:${String(IP_PORT)}/${lang}?at=dst:2891122`, { waitUntil: "networkidle" });
      await echoNamesHeadline(page);
      expect(await page.locator("#place-upd").isVisible()).toBe(false);
      // and the headline still FOLLOWS the scope switch both ways: "Ganz Deutschland", then back to the place
      const place = await label(page);
      await page.click("#place-scope-de");
      await page.waitForFunction(() => document.getElementById("place-scope-de")?.getAttribute("aria-checked") === "true");
      await page.click("#place-pill");
      await page.waitForFunction((was) => (document.getElementById("place-pill-label")?.textContent ?? "").trim() === was && document.getElementById("place-pill")?.getAttribute("aria-checked") === "true", place);
      // #1113: those two clicks kept the choice; the IP guess below is a load with nothing kept
      await page.evaluate(() => window.localStorage.clear());
      await page.goto(`http://127.0.0.1:${String(IP_PORT)}/${lang}`, { waitUntil: "networkidle" });
      await echoNamesHeadline(page);
      expect(await page.locator("#place-upd").isVisible()).toBe(false);
      // a remembered place: picked once, then a fresh load
      await page.waitForSelector("#place-head:not([hidden])");
      await search(page, "Köln", "Köln");
      await page.waitForFunction(() => (document.getElementById("place-pill-label")?.textContent ?? "").trim() === "Köln");
      await page.goto(`http://127.0.0.1:${String(IP_PORT)}/${lang}`, { waitUntil: "networkidle" });
      await echoNamesHeadline(page);
      await ctx.close();
    });
  }
});
