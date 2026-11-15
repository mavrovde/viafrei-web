/**
 * #938 "How to verify" beyond the departures (place-departures-938.e2e.ts): the ROADS, CHARGING and PARKING cards of a
 * place page paged in a phone's browser, against the REAL built shell and the REAL digest renderer over the fixture (no
 * database, no network). The digest is started with a card page size of 1 — below the console's floor of 3 on purpose,
 * because the pager is the same for every size and the fixture's Köln lists are short (2 road events, 3 chargers,
 * 2 car parks); the rows are the fixture's own, so no golden moves.
 *
 *  - A3/A4/B6, JavaScript on, 375 px: each press appends exactly the next entry in place, moves the focus to it and says
 *    so in the polite live region, until the end line; every entry once, as many as the first fold named, and no
 *    horizontal scroll; axe finds nothing serious in the paged card;
 *  - A3, JavaScript off: the fold's link (rel=nofollow) opens the page with the card's first two pages in place, noindex;
 *  - C1: the address a fold asks is disallowed in robots.txt for every crawler, and its answer says noindex, nofollow;
 *  - D1: a translated place page with its cards paged to the end speaks only its own language.
 */
import { type ChildProcess } from "node:child_process";
import { AxeBuilder } from "@axe-core/playwright";
import { chromium, type Browser, type Page } from "playwright";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { DWD_LEVEL_NAMES, DWD_ROAD_SUMMARY_LINE, DWD_SUMMARY_LINE, DWD_TRANSLATED_LINE } from "@viafrei/digest";
import { LICENCE_CATALOGUE, MTSK_CONSUMER_NOTE, conditionAsRegistered, datedAttribution } from "@viafrei/ingest";
import { ATTRIBUTION } from "@viafrei/mcp";
import { placePath } from "../src/site/places.js";
import { COLLECT_JS, judge, type PageText } from "./language-purity.js";
import { startRealDigest } from "./real-digest.js";
import { startShell } from "./server.js";

const PORT = 8981;
const BASE = `http://127.0.0.1:${String(PORT)}`;
/** #938 B6: the issue's phone. */
const PHONE = { width: 375, height: 812 };
const CARDS = ["roads", "charging", "parking"] as const;
type CardId = (typeof CARDS)[number];

let browser: Browser;
let shell: ChildProcess;
let digest: Awaited<ReturnType<typeof startRealDigest>>;

beforeAll(async () => {
  digest = await startRealDigest({ pageSize: 1 });
  shell = await startShell(PORT, { DIGEST_URL: digest.url, WEB_TILE_TIMEOUT_MS: "2000" });
  browser = await chromium.launch();
}, 120_000);
afterAll(async () => {
  await browser?.close();
  shell?.kill();
  await digest?.close();
});

/** A card's entries, the first page's and every appended one: each list item whose own child carries the entry's id. */
const ITEMS = (card: CardId): string => `#pcard-${card} li:has(> [id])`;
const ids = (page: Page, card: CardId): Promise<string[]> => page.locator(ITEMS(card)).evaluateAll((xs) => xs.map((x) => x.querySelector(":scope > [id]")?.id ?? ""));

/** #1176: on a phone a place's cards after the first are folded; a person opens a card's fold (its summary) before its pager. */
async function unfold(page: Page): Promise<void> {
  const closed = page.locator("details.pcard__fold:not([open]) > summary");
  while ((await closed.count()) > 0) await closed.first().click();
}

/** Presses the card's open fold until its end line shows; asserts each press appended entries, focus and announcement. */
async function pageToEnd(page: Page, card: CardId, announced = true): Promise<number> {
  let presses = 0;
  for (; presses < 10 && (await page.locator(`#pcard-${card} .pager__end`).count()) === 0; presses++) {
    const before = await page.locator(ITEMS(card)).count();
    if (announced) await page.evaluate(() => document.getElementById("vf-pager-live")?.replaceChildren());
    await page.locator(`#pcard-${card} details.pager:not([open]) > summary`).last().click();
    await page.waitForFunction(([sel, n]) => document.querySelectorAll(sel).length > n, [ITEMS(card), before] as const, { timeout: 2_000 });
    if (announced) {
      await page.waitForFunction(() => (document.getElementById("vf-pager-live")?.textContent ?? "") !== "", undefined, { timeout: 2_000 });
      // the focus is on the first entry this press appended
      expect(await page.evaluate(([sel, n]) => document.activeElement === document.querySelectorAll(sel)[n], [ITEMS(card), before] as const), `${card} press ${String(presses + 1)}`).toBe(true);
    }
  }
  return presses;
}

describe("#938 A3/A4/B6: the roads, charging and parking cards of a place page, paged in a 375 px browser", () => {
  for (const card of CARDS) {
    it(`${card}, JavaScript on: one entry, then each press appends the next in place to the end line — none twice, no horizontal scroll`, async () => {
      const page = await browser.newPage({ viewport: PHONE });
      await page.goto(`${BASE}/de/place/koeln`);
      await unfold(page);
      expect(await page.locator(ITEMS(card)).count()).toBe(1);
      const summary = (await page.locator(`#pcard-${card} details.pager > summary`).first().textContent()) ?? "";
      // "Nächste 1 (2–2 von N)": the total is the largest number the fold names
      const total = Math.max(...[...summary.matchAll(/\d+/gu)].map((m) => Number(m[0])));
      expect(total, summary).toBeGreaterThanOrEqual(2);
      const presses = await pageToEnd(page, card);
      expect(presses).toBe(total - 1);
      const seen = await ids(page, card);
      expect(seen.every((x) => x !== "")).toBe(true);
      expect(new Set(seen).size, seen.join(" ")).toBe(seen.length);
      expect(seen).toHaveLength(total);
      expect(await page.locator(`#pcard-${card} .pager__end`).count()).toBe(1);
      expect(await page.locator(`#pcard-${card} details.pager:not([open])`).count()).toBe(0);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
      await page.close();
    }, 60_000);

    it(`${card}, JavaScript off: the fold's link opens the card's first two pages in place, noindex`, async () => {
      const ctx = await browser.newContext({ viewport: PHONE, javaScriptEnabled: false });
      const page = await ctx.newPage();
      await page.goto(`${BASE}/de/place/koeln`);
      await unfold(page);
      const link = page.locator(`#pcard-${card} details.pager a`).first();
      expect(await link.getAttribute("rel")).toBe("nofollow");
      const href = (await link.getAttribute("href")) ?? "";
      expect(href).toMatch(new RegExp(`\\?${card}=2$`, "u"));
      await page.goto(`${BASE}${href}`);
      await unfold(page);
      expect(await page.locator(ITEMS(card)).count()).toBe(2);
      expect(await page.locator('meta[name="robots"]').getAttribute("content")).toContain("noindex");
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
      await ctx.close();
    }, 60_000);
  }

  it("A3: axe finds no serious or critical violation in the charging card paged to its end", async () => {
    const ctx = await browser.newContext({ viewport: PHONE });
    const page = await ctx.newPage();
    await page.goto(`${BASE}/de/place/koeln`);
    await unfold(page);
    await pageToEnd(page, "charging", false);
    const r = await new AxeBuilder({ page }).include("#pcard-charging").withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
    expect(r.violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => `${v.id}: ${v.nodes.map((x) => x.target.join(" ")).join(", ")}`)).toEqual([]);
    expect(r.passes.length).toBeGreaterThan(0);
    await ctx.close();
  }, 60_000);
});

describe("#938 C1: a step is kept from the crawlers", () => {
  it("the address every fold asks is disallowed for every crawler group, and its answer says noindex, nofollow", async () => {
    const html = await (await fetch(`${BASE}/de/place/koeln`)).text();
    const asks = [...html.matchAll(/<details class="pcard__more pager"[^>]* data-more="([^"]+)"/gu)].map((m) => m[1]!.replace(/&amp;/gu, "&"));
    expect(asks.length).toBeGreaterThanOrEqual(CARDS.length);
    const robots = await (await fetch(`${BASE}/robots.txt`)).text();
    const groups = robots.split(/\n(?=User-agent:)/u).filter((g) => g.startsWith("User-agent:"));
    expect(groups.length).toBeGreaterThan(1);
    for (const ask of asks) {
      const path = new URL(ask, BASE).pathname;
      for (const g of groups) {
        const disallowed = [...g.matchAll(/^Disallow: (\S+)$/gmu)].some((m) => path.startsWith(m[1]!));
        expect(disallowed, `${g.split("\n")[0]!} vs ${path}`).toBe(true);
      }
    }
    for (const card of CARDS) {
      const ask = asks.find((a) => a.includes(`card=${card}&`));
      expect(ask, card).toBeDefined();
      const r = await fetch(`${BASE}${ask!}`);
      expect(r.status, card).toBe(200);
      expect(r.headers.get("x-robots-tag"), card).toBe("noindex, nofollow");
    }
  }, 30_000);
});

/** What a page may print verbatim in German on any page (`language.e2e.ts`' list): the publishers' credit lines. */
const VERBATIM: readonly string[] = [
  MTSK_CONSUMER_NOTE,
  ...Object.values(ATTRIBUTION).map((r) => datedAttribution(r.text, new Date())),
  ...Object.values(ATTRIBUTION).flatMap((r) => (r.conditionNote === undefined ? [] : [conditionAsRegistered(r.conditionNote.de, "de")])),
  ...Object.values(LICENCE_CATALOGUE).map((r) => datedAttribution(r.attribution ?? "", new Date())),
  DWD_SUMMARY_LINE,
  DWD_ROAD_SUMMARY_LINE,
  DWD_TRANSLATED_LINE,
  ...DWD_LEVEL_NAMES,
];

describe("#938 D1: a translated place page with its cards paged to the end speaks only its own language", () => {
  for (const lang of ["en", "tr"] as const) {
    it(`${lang}: roads, charging and parking paged to their end lines`, async () => {
      const page = await browser.newPage({ viewport: PHONE });
      try {
        await page.goto(`${BASE}${placePath(lang, "koeln")}`);
        await unfold(page);
        for (const card of CARDS) await pageToEnd(page, card, false);
        for (const card of CARDS) expect(await page.locator(`#pcard-${card} .pager__end`).count(), card).toBe(1);
        await page.evaluate(() => {
          document.title = "";
          document.querySelector('meta[name="description"]')?.remove();
        });
        const text: PageText = await page.evaluate(COLLECT_JS);
        expect(text.texts.length).toBeGreaterThan(20);
        expect(judge(lang, text, VERBATIM).map((f) => `${f.why} @ ${f.where}: ${f.text}`)).toEqual([]);
      } finally {
        await page.close();
      }
    }, 60_000);
  }
});
