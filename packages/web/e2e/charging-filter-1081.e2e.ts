/**
 * #1081 (2.5.8), the browser layer of the charging filter, against the BUILT shell and the REAL digest renderer over
 * the fixture (`real-digest.ts`, whose charging reads are functions of their parameters and apply ingest's own rule,
 * `siteUnderFilter`) — no database, no network. Every wait is bounded at 2 s.
 *
 *  - D1/D9, JavaScript off: the bar is a GET form; its submit puts the choice in the address (`ev_kw`), the page says
 *    what the filter kept, is `noindex, noarchive` and its canonical is the unfiltered page;
 *  - D1, JavaScript on: a change re-fetches the card alone — no navigation, the address follows, the focus stays on the
 *    box, and the count is in a polite live region ("N von M");
 *  - C2: a filter nothing in the circle matches names the filters and offers the way back, which leads to the
 *    unfiltered card;
 *  - C7: the pager continues the FILTERED list to its end, never an unfiltered row (a digest page size of 1);
 *  - the station page's charging card carries the same bar, and a filtered station page is `noindex, follow, noarchive`.
 */
import type { ChildProcess } from "node:child_process";
import { chromium, type Browser, type Page } from "playwright";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { placePath } from "../src/site/places.js";
import { stationPath } from "../src/site/stations.js";
import { startRealDigest } from "./real-digest.js";
import { startShell } from "./server.js";

/** #1176: on a phone a place's cards after the first (a station's area: every card) are folded; a person opens a card's fold first. */
async function unfold(page: Page): Promise<void> {
  // opened as a person's click does, without one: a desktop or print shows no summary to click (it is open there by CSS)
  await page.$$eval("details.pcard__fold:not([open])", (ds) => ds.forEach((d) => d.setAttribute("open", "")));
}

const PORT = 8987;
const PAGED_PORT = 8988;
const BASE = `http://127.0.0.1:${String(PORT)}`;
const PAGED = `http://127.0.0.1:${String(PAGED_PORT)}`;
const PHONE = { width: 375, height: 812 };
const PLACE = placePath("de", "koeln");
const STATION = stationPath("de", "koeln-hbf");
/** The fixture's three sites inside the first ring: "fast" (50–150 kW) keeps the first and the third, never TankE's 22 kW. */
const FAST = ["Ladepark Köln-Deutz", "Ladesäule Ehrenfeld"];
const NOT_FAST = "Parkhaus Cäcilienstraße";

let browser: Browser;
let shell: ChildProcess | undefined;
let paged: ChildProcess | undefined;
let digest: Awaited<ReturnType<typeof startRealDigest>>;
let pagedDigest: Awaited<ReturnType<typeof startRealDigest>>;

beforeAll(async () => {
  [digest, pagedDigest] = await Promise.all([startRealDigest(), startRealDigest({ pageSize: 1 })]);
  [shell, paged] = await Promise.all([
    startShell(PORT, { DIGEST_URL: digest.url, WEB_TILE_TIMEOUT_MS: "2000" }),
    startShell(PAGED_PORT, { DIGEST_URL: pagedDigest.url, WEB_TILE_TIMEOUT_MS: "2000" }),
  ]);
  browser = await chromium.launch();
  // a first render warms the shell and the digest's caches, so no test meets a card still loading (and swapped in place)
  await Promise.all([fetch(`${BASE}${PLACE}`), fetch(`${PAGED}${PLACE}`), fetch(`${BASE}${STATION}`)].map((p) => p.then((r) => r.text())));
}, 120_000);
afterAll(async () => {
  await browser?.close();
  shell?.kill();
  paged?.kill();
  await Promise.all([digest?.close(), pagedDigest?.close()]);
});

const card = "#pcard-charging";
const names = (page: Page): Promise<string[]> =>
  page.locator(`${card} li:has(> [id]) .evst__head strong`).evaluateAll((xs) => xs.map((x) => (x.textContent ?? "").trim()));
const robots = (page: Page): Promise<string | null> => page.locator('meta[name="robots"]').getAttribute("content");
const canonical = (page: Page): Promise<string | null> => page.locator('link[rel="canonical"]').getAttribute("href");

describe("#1081 the charging filter in a browser", () => {
  it("D1/D9, JavaScript off: the GET form puts the choice in the address; the page is noindex, noarchive, canonical unfiltered", async () => {
    const ctx = await browser.newContext({ viewport: PHONE, javaScriptEnabled: false });
    ctx.setDefaultTimeout(2_000);
    const page = await ctx.newPage();
    await page.goto(`${BASE}${PLACE}`);
    await unfold(page);
    const form = page.locator(`${card} form.evf`);
    expect(await form.count()).toBe(1);
    expect(await form.getAttribute("method")).toBe("get");
    expect(await names(page)).toEqual([...FAST.slice(0, 1), NOT_FAST, FAST[1]]);
    expect(await robots(page)).not.toContain("noindex");
    await form.locator('input[name="ev_kw"][value="fast"]').check();
    await Promise.all([page.waitForURL((u) => u.searchParams.get("ev_kw") === "fast", { timeout: 2_000 }), form.locator("button.evf__apply").click()]);
    expect(await page.locator(`${card} input[name="ev_kw"][value="fast"]`).isChecked()).toBe(true);
    expect(await names(page)).toEqual(FAST);
    expect((await page.locator(`${card} .evf__count`).textContent()) ?? "").toMatch(/^2 von 3 Ladestandorten im Umkreis von 5,0 km passen/u);
    expect(await robots(page)).toBe("noindex, noarchive");
    expect(await canonical(page)).toMatch(new RegExp(`${PLACE.replace(/\//gu, "\\/")}$`, "u"));
    await ctx.close();
  });

  it("D1, JavaScript on: a change re-fetches the card alone — no navigation, the address follows, focus kept, the count read out", async () => {
    const ctx = await browser.newContext({ viewport: PHONE, javaScriptEnabled: true });
    ctx.setDefaultTimeout(2_000);
    const page = await ctx.newPage();
    await page.goto(`${BASE}${PLACE}`);
    await unfold(page);
    await page.evaluate(() => {
      (window as unknown as { vf1081?: number }).vf1081 = 1;
    });
    const box = page.locator(`${card} form.evf input[name="ev_kw"][value="fast"]`);
    await box.focus();
    // by the keyboard, on the focused box: with every fold just opened the page is still settling, and a pointer's
    // stability wait spent the whole 2 s budget on a loaded runner (the change event is the same)
    await page.keyboard.press("Space");
    expect(await box.isChecked()).toBe(true);
    await page.waitForFunction((sel) => document.querySelector(sel) !== null, `${card} .evf__count`, { timeout: 2_000 });
    await page.waitForFunction(() => new URLSearchParams(location.search).get("ev_kw") === "fast", undefined, { timeout: 2_000 });
    // no document load: the marker set on the first document survives (a replaceState is a same-document navigation)
    expect(await page.evaluate(() => (window as unknown as { vf1081?: number }).vf1081)).toBe(1);
    const live = page.locator(`${card} .evf__count`);
    expect(await live.getAttribute("aria-live")).toBe("polite");
    expect((await live.textContent()) ?? "").toMatch(/^2 von 3 /u);
    expect(await names(page)).toEqual(FAST);
    await page.waitForFunction(() => {
      const a = document.activeElement;
      return a instanceof HTMLInputElement && a.name === "ev_kw" && a.value === "fast";
    }, undefined, { timeout: 2_000 });
    await ctx.close();
  });

  it("C2: nothing matches — the filters are named, and the way back leads to the unfiltered card", async () => {
    const ctx = await browser.newContext({ viewport: PHONE, javaScriptEnabled: false });
    ctx.setDefaultTimeout(2_000);
    const page = await ctx.newPage();
    await page.goto(`${BASE}${PLACE}?ev_op=tanke&ev_kw=hpc`);
    await unfold(page);
    const none = page.locator(`${card} .evf__none`);
    expect(await none.count()).toBe(1);
    expect((await none.textContent()) ?? "").toContain("passt kein Ladestandort zur Auswahl: TankE, HPC ab 150 kW.");
    expect(await names(page)).toEqual([]);
    const back = none.locator("a.evf__reset");
    expect(await back.getAttribute("rel")).toBe("nofollow");
    await Promise.all([page.waitForURL((u) => !u.search.includes("ev_"), { timeout: 2_000 }), back.click()]);
    expect(await page.locator(`${card} .evf__none`).count()).toBe(0);
    expect(await names(page)).toEqual([FAST[0], NOT_FAST, FAST[1]]);
    await ctx.close();
  });

  for (const js of [true, false]) {
    it(`C7, JavaScript ${js ? "on" : "off"}: the pager continues the filtered list to its end and shows no unfiltered row`, async () => {
      const ctx = await browser.newContext({ viewport: PHONE, javaScriptEnabled: js });
      ctx.setDefaultTimeout(2_000);
      const page = await ctx.newPage();
      await page.goto(`${PAGED}${PLACE}?ev_kw=fast`);
      await unfold(page);
      expect(await names(page)).toEqual(FAST.slice(0, 1));
      for (let i = 0; i < 4 && (await page.locator(`${card} .pager__end`).count()) === 0; i++) {
        const before = (await names(page)).length;
        const fold = page.locator(`${card} details.pager:not([open]) > summary`).last();
        if (js) {
          await fold.click();
          await page.waitForFunction(([sel, n]) => document.querySelectorAll(sel).length > n, [`${card} li:has(> [id])`, before] as const, { timeout: 2_000 });
        } else {
          const link = page.locator(`${card} details.pager a[rel="nofollow"]`).last();
          await fold.click();
          await Promise.all([page.waitForURL(() => true, { timeout: 2_000, waitUntil: "domcontentloaded" }), link.click()]);
          expect(new URL(page.url()).searchParams.get("ev_kw")).toBe("fast");
        }
      }
      expect(await page.locator(`${card} .pager__end`).count()).toBe(1);
      expect(await names(page)).toEqual(FAST);
      await ctx.close();
    });
  }

  it("the station page: the same bar on its charging card, and a filtered station page is noindex, follow, noarchive", async () => {
    const ctx = await browser.newContext({ viewport: PHONE, javaScriptEnabled: false });
    ctx.setDefaultTimeout(2_000);
    const page = await ctx.newPage();
    await page.goto(`${BASE}${STATION}`);
    await unfold(page);
    const form = page.locator(`${card} form.evf`);
    expect(await form.count()).toBe(1);
    expect(await robots(page)).not.toContain("noindex");
    await form.locator('input[name="ev_kw"][value="fast"]').check();
    await Promise.all([page.waitForURL((u) => u.searchParams.get("ev_kw") === "fast", { timeout: 2_000 }), form.locator("button.evf__apply").click()]);
    expect(await page.locator(`${card} input[name="ev_kw"][value="fast"]`).isChecked()).toBe(true);
    expect(await names(page)).toEqual(FAST);
    expect(await robots(page)).toBe("noindex, follow, noarchive");
    await ctx.close();
  });
});
