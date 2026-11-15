/**
 * #1061 against the REAL built shell and the REAL digest renderer over the production-scale fixture (no database,
 * no network), at 390 px in de, en and tr:
 *
 *  - JavaScript on: a long card (the towns along the A1) shows 12 entries and the "›" fold; opening each fold loads
 *    the next 12 in place, moves the focus to the first new entry and says so in a polite live region, until "the end
 *    of the list" — every entry once, the count the first fold named;
 *  - JavaScript off: the fold's link (rel=nofollow) opens the same page with the card's first two pages in place,
 *    noindex, its canonical the page's own;
 *  - the page-wide sweep (`entry-sweep.ts`): every entry says where, a placed entry carries its map links — over the
 *    motorway pages and the Köln place page, and over a planted page with one where line removed, which it refuses.
 */
import { type ChildProcess } from "node:child_process";
import { chromium, type Browser } from "playwright";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { startRealDigest } from "./real-digest.js";
import { startShell } from "./server.js";
import { sweepEntries } from "./entry-sweep.js";

const PORT = 8857;
const BASE = `http://127.0.0.1:${String(PORT)}`;
const PHONE = { width: 390, height: 844 };

let browser: Browser;
let shell: ChildProcess;
let digest: Awaited<ReturnType<typeof startRealDigest>>;

beforeAll(async () => {
  digest = await startRealDigest({ scale: "production" });
  shell = await startShell(PORT, { DIGEST_URL: digest.url, WEB_TILE_TIMEOUT_MS: "2000" });
  browser = await chromium.launch();
}, 120_000);
afterAll(async () => {
  await browser?.close();
  shell?.kill();
  await digest?.close();
});

const CARD = "#mwk-cities";
const ROWS = `${CARD} li[id^="mw-city-"]`;

describe("the card pager in a phone's browser (#1061)", () => {
  for (const lang of ["de", "en", "tr"] as const) {
    it(`${lang}, JavaScript on: 12, then each fold loads the next in place to the end — focus and announcement`, async () => {
      const page = await browser.newPage({ viewport: PHONE });
      await page.goto(`${BASE}/${lang}/autobahn/a1`);
      expect(await page.locator(ROWS).count()).toBe(12);
      const first = (await page.locator(`${CARD} details.pager > summary`).first().textContent()) ?? "";
      // "Nächste 12 (13–24 von N)", "Sonraki 12 (N içinden 13–24)": the total is the largest number the fold names
      const total = Math.max(...[...first.matchAll(/\d+/gu)].map((m) => Number(m[0])));
      expect(total, first).toBeGreaterThan(24);
      for (let k = 0; k < 20 && (await page.locator(`${CARD} .pager__end`).count()) === 0; k++) {
        const before = await page.locator(ROWS).count();
        await page.locator(`${CARD} details.pager:not([open]) > summary`).last().click();
        await page.waitForFunction(([sel, n]) => document.querySelectorAll(sel).length > n, [ROWS, before] as const);
        // the focus is the first new entry, and the live region says how many came
        expect(await page.evaluate(() => document.activeElement?.tagName)).toBe("LI");
        await page.waitForFunction(() => (document.getElementById("vf-pager-live")?.textContent ?? "") !== "");
      }
      const ids = await page.locator(ROWS).evaluateAll((xs) => xs.map((x) => x.id));
      expect(new Set(ids).size).toBe(ids.length);
      expect(ids.length).toBe(total);
      expect(await page.locator(`${CARD} .pager__end`).count()).toBe(1);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
      await page.close();
    }, 90_000);

    it(`${lang}, JavaScript off: the fold's link opens the first two pages in place, noindex, canonical unchanged`, async () => {
      const ctx = await browser.newContext({ viewport: PHONE, javaScriptEnabled: false });
      const page = await ctx.newPage();
      await page.goto(`${BASE}/${lang}/autobahn/a1`);
      const link = page.locator(`${CARD} details.pager a`).first();
      expect(await link.getAttribute("rel")).toBe("nofollow");
      const href = (await link.getAttribute("href")) ?? "";
      expect(href).toMatch(/\?cities=2$/u);
      await page.goto(`${BASE}${href}`);
      expect(await page.locator(ROWS).count()).toBe(24);
      expect(await page.locator('meta[name="robots"]').getAttribute("content")).toContain("noindex");
      const canonical = (await page.locator('link[rel="canonical"]').getAttribute("href")) ?? "";
      expect(canonical).not.toContain("?");
      await ctx.close();
    }, 60_000);
  }
});

describe("the page-wide entry sweep (#1061)", () => {
  const get = async (path: string): Promise<string> => (await fetch(`${BASE}${path}`)).text();

  it("every entry of the A1, the A7 and the Köln place page says where; a placed one carries its map links", async () => {
    for (const road of ["a1", "a7"]) {
      const de = sweepEntries(await get(`/de/autobahn/${road}`));
      expect(de.entries, road).toBeGreaterThan(20);
      expect(de.noWhere, `de ${road}`).toBe(0);
      expect(de.placedNoMap, `de ${road}`).toEqual([]);
      for (const lang of ["en", "tr"]) {
        const s = sweepEntries(await get(`/${lang}/autobahn/${road}`));
        expect(s.entries, `${lang} ${road}`).toBe(de.entries);
        // a translated page leaves out only the publisher's German place words the German page quotes
        expect(s.noWhere, `${lang} ${road}`).toBeLessThanOrEqual(de.quoted);
        expect(s.placedNoMap, `${lang} ${road}`).toEqual([]);
      }
    }
    const koeln = sweepEntries(await get("/de/place/koeln"));
    expect(koeln.noWhere).toBe(0);
    expect(koeln.placedNoMap).toEqual([]);
  }, 60_000);

  it("the sweep can say no: a planted entry with its where line removed, a placed one with its map links removed", async () => {
    const html = await get("/de/autobahn/a1");
    const noWhere = html.replace(/<span class="entry__l entry__where">[\s\S]*?<\/span>(?=<span class="entry__l entry__dir">)/u, "");
    expect(sweepEntries(noWhere).noWhere).toBe(1);
    const placed = /<span class="entry__l entry__where">(?:(?!<\/span><span class="entry__l).)*<a [\s\S]*?<span class="entry__l entry__src">[\s\S]*?<\/span>/u.exec(html)?.[0];
    expect(placed, "the page holds a placed entry").toBeDefined();
    const noMap = html.replace(placed!, placed!.replace(/<span class="entry__l entry__src">[\s\S]*?<\/span>$/u, '<span class="entry__l entry__src">x</span>'));
    expect(sweepEntries(noMap).placedNoMap.length).toBeGreaterThan(0);
  }, 30_000);
});
