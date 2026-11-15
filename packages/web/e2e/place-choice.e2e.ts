/**
 * #863: on a place page, choosing another place used to swap the cards alone — the H1, the title, the URL and the
 * place bar kept the old place, so the cards of B stood under a page headed A. Against the REAL built shell and a
 * stand-in digest answering every place with all its cards (each naming its place), in a real browser: a choice in
 * the sheet is that place's own page, an emulated position is the home showing it, and the back button returns to
 * the place before. On the home the in-place swap stays.
 */
import type { ChildProcess } from "node:child_process";
import { chromium, type Browser, type BrowserContext, type Page } from "playwright";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { startShell } from "./server.js";
import { startStubDigest } from "./stub-digest.js";

const PORT = 8834;
const BASE = `http://127.0.0.1:${String(PORT)}`;
let browser: Browser;
let shell: ChildProcess;
let digest: Awaited<ReturnType<typeof startStubDigest>>;

beforeAll(async () => {
  digest = await startStubDigest({}, 5000, { fullCards: true });
  shell = await startShell(PORT, { DIGEST_URL: digest.url, WEB_TILE_TIMEOUT_MS: "2000" });
  browser = await chromium.launch();
});
afterAll(async () => {
  await browser?.close();
  shell?.kill();
  await digest?.close();
});

/** What the reader sees of the place: the heading, the title, the address and every card's lead. */
async function seen(page: Page): Promise<{ h1: string; title: string; path: string; leads: string[] }> {
  return {
    h1: ((await page.locator("h1").first().textContent()) ?? "").trim(),
    title: await page.title(),
    path: new URL(page.url()).pathname,
    leads: await page.$$eval("#place-slot .pcard__lead", (ls) => ls.map((l) => (l.textContent ?? "").trim())),
  };
}

/** #1112: no sheet to open — the position bar is on the page; the place radio takes the focus to its box. */
async function openSheet(page: Page): Promise<void> {
  await page.click("#place-pill");
  await page.waitForSelector("#place-bar #place-hq:focus");
}

async function pageAt(ctx: BrowserContext, path: string): Promise<Page> {
  const page = await ctx.newPage();
  await page.goto(`${BASE}${path}`, { waitUntil: "networkidle" });
  await page.waitForSelector("#place-slot .pcard");
  return page;
}

describe("another place chosen on a place page is that place's page (#863)", () => {
  it("a sheet choice: H1, title, URL and every card name the new place, none the old; back returns", async () => {
    const ctx = await browser.newContext({ viewport: { width: 1000, height: 900 } });
    const page = await pageAt(ctx, "/de/place/berlin");
    expect((await seen(page)).h1).toBe("Berlin");
    await openSheet(page);
    await Promise.all([page.waitForURL(/\/de\/place\/muenchen$/u), page.click("#place-bar a.place-opt:has-text('München')")]);
    await page.waitForSelector("#place-slot .pcard");
    const after = await seen(page);
    expect(after.path).toBe("/de/place/muenchen");
    expect(after.h1).toBe("München");
    expect(after.title).toContain("München");
    expect(after.title).not.toContain("Berlin");
    expect(after.leads.length).toBeGreaterThan(0);
    for (const l of after.leads) {
      expect(l).toContain("München");
      expect(l).not.toContain("Berlin");
    }
    expect(await page.locator('link[rel="canonical"]').getAttribute("href")).toMatch(/\/de\/place\/muenchen$/u);
    await page.goBack({ waitUntil: "networkidle" });
    const back = await seen(page);
    expect(back.path).toBe("/de/place/berlin");
    expect(back.h1).toBe("Berlin");
    await ctx.close();
  });

  it("an emulated position: the home with the position's cards, none naming the old place; back returns", async () => {
    const ctx = await browser.newContext({ viewport: { width: 1000, height: 900 }, geolocation: { latitude: 52.0, longitude: 9.0, accuracy: 20 }, permissions: ["geolocation"] });
    const page = await pageAt(ctx, "/en/place/hamburg");
    expect((await seen(page)).h1).toBe("Hamburg");
    await openSheet(page);
    await Promise.all([page.waitForURL(`${BASE}/en`), page.click("#place-geo")]);
    await page.waitForFunction(() => Array.from(document.querySelectorAll("#place-slot .pcard__lead")).some((l) => (l.textContent ?? "").includes("Teststadt")));
    const after = await seen(page);
    expect(after.path).toBe("/en");
    expect(after.title).not.toContain("Hamburg");
    for (const l of after.leads) expect(l).not.toContain("Hamburg");
    expect(((await page.locator("#place-pill-label").textContent()) ?? "").trim()).toBe("Teststadt");
    await page.goBack({ waitUntil: "networkidle" });
    expect((await seen(page)).h1).toBe("Hamburg");
    await ctx.close();
  });

  it("on the home a choice swaps the cards in place, and the place bar follows", async () => {
    const ctx = await browser.newContext({ viewport: { width: 1000, height: 900 } });
    const page = await ctx.newPage();
    await page.goto(`${BASE}/de`, { waitUntil: "networkidle" });
    await openSheet(page);
    await page.locator("#place-hq").pressSequentially("wehl", { delay: 20 });
    await page.locator("#place-hresults a.place-opt", { hasText: "Wehlheiden" }).first().click({ timeout: 2000 });
    await page.waitForFunction(() => (document.getElementById("place-pill-label")?.textContent ?? "").includes("Wehlheiden"));
    expect(new URL(page.url()).pathname).toBe("/de");
    await ctx.close();
  });

  it("#1158: on the home a town's chip opens the town's page (a city opens its place page from every page)", async () => {
    const ctx = await browser.newContext({ viewport: { width: 1000, height: 900 } });
    const page = await ctx.newPage();
    await page.goto(`${BASE}/de`, { waitUntil: "networkidle" });
    await Promise.all([page.waitForURL(`${BASE}/de/place/koeln`, { timeout: 2000 }), page.click("#place-bar a.place-opt:has-text('Köln')")]);
    expect(((await page.locator("#place-pill-label").textContent()) ?? "").trim()).toBe("Köln");
    await ctx.close();
  });
});

describe("#1170 'use my location' is added to my places on the ★ click", () => {
  it("the ★ appears after the position's cards, its click adds the area as a chip, and the chip works after a reload", async () => {
    const ctx = await browser.newContext({ viewport: { width: 1000, height: 900 }, geolocation: { latitude: 52.0, longitude: 9.0, accuracy: 20 }, permissions: ["geolocation"] });
    const page = await ctx.newPage();
    await page.goto(`${BASE}/de`, { waitUntil: "networkidle" });
    // a granted permission loads the position on its own; the bar's button asks again either way
    await page.click("#place-geo");
    await page.waitForFunction(() => (document.getElementById("place-pill-label")?.textContent ?? "").includes("Teststadt"));
    await page.waitForSelector("#place-mine:visible", { timeout: 2000 });
    // nothing in my places before the click
    expect(await page.evaluate(() => localStorage.getItem("viafrei.place.recent"))).toBeNull();
    await page.click("#place-mine");
    await page.waitForSelector("#place-recent a.place-opt:has-text('Teststadt')", { timeout: 2000 });
    expect(await page.locator("#place-mine").isVisible()).toBe(false);
    const recent = JSON.parse((await page.evaluate(() => localStorage.getItem("viafrei.place.recent"))) ?? "[]") as { at: string; label: string }[];
    expect(recent.map((r) => r.label)).toEqual(["Teststadt"]);
    // the area key (the rounded cell), never the position
    expect(recent[0]?.at).toMatch(/^pt:/u);
    // the chip stays after a reload, and is pressed while its place is shown
    await page.reload({ waitUntil: "networkidle" });
    await page.waitForSelector("#place-recent a.place-opt:has-text('Teststadt')", { timeout: 2000 });
    expect(await page.locator("#place-mine").isVisible()).toBe(false);
    await ctx.close();
  });
});

describe("the pill's word for a browser position (2.3.8)", () => {
  it("says 'rounded, about 500 m' in every language — never 'exact' — and the pill fits a 390 px screen", async () => {
    const WORD: Record<string, string> = { de: "gerundet, ca. 500 m", en: "rounded, about 500 m", ru: "округлено, около 500 м", bg: "закръглено, около 500 м", uk: "округлено, близько 500 м", ro: "rotunjit, circa 500 m", tr: "yuvarlatılmış, yaklaşık 500 m" };
    for (const [lang, word] of Object.entries(WORD)) {
      const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, geolocation: { latitude: 52.0, longitude: 9.0, accuracy: 20 }, permissions: ["geolocation"] });
      const page = await ctx.newPage();
      await page.goto(`${BASE}/${lang}`, { waitUntil: "networkidle" });
      await page.waitForFunction((w) => document.getElementById("place-pill-how")?.textContent === w, word);
      const box = await page.$eval("#place-pill", (e) => e.getBoundingClientRect().toJSON() as DOMRect);
      expect(box.left, lang).toBeGreaterThanOrEqual(0);
      expect(box.right, lang).toBeLessThanOrEqual(390);
      expect(await page.evaluate(() => document.documentElement.scrollWidth), lang).toBeLessThanOrEqual(390);
      await ctx.close();
    }
  });
});
