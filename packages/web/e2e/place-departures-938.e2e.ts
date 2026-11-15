/**
 * #938 E1 against the REAL built shell and the REAL digest renderer over the fixture (no database, no network), at
 * 390 px: on Köln's place page, the "more" fold under Köln Hbf's departures, pressed three times, appends fifteen
 * further departures in time order — none twice — through the card pager's own script, moving the focus to the first
 * new one and saying so politely; the page still carries no more inline scripts than before. Without JavaScript the
 * fold's link (rel=nofollow) opens the page with the stop's next step in place, noindex.
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

const PORT = 8859;
const BASE = `http://127.0.0.1:${String(PORT)}`;
const PHONE = { width: 390, height: 844 };
const HBF = encodeURIComponent("de:05315:11201");

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

/** Köln Hbf's entry on the stations card: the list item holding the fold whose step asks for its stop. */
const STOP = `#pcard-stations li:has(> details.pager[data-deps][data-more*="stop=${HBF}"])`;
/** Every departure under the stop, the card's and the appended ones, in document order, as their clock times. */
const times = (page: Page): Promise<string[]> => page.locator(`${STOP} table.pcard__board tbody tr .pcard__clock`).allTextContents();
/**
 * #1147b: a step is the rest of the hour, not five — at least `DEPARTURES_STEP_MIN` (5) unless the plan ends there, at
 * most `DEPARTURES_STEP` (40, the busiest hour's bound), both in `packages/digest/src/cards/stations/departures-more.ts`.
 */
const STEP_MIN = 5;
const STEP_MAX = 40;
const ROWS = `${STOP} table.pcard__board tbody tr`;
/** #1176: on a phone a place's cards after the first are folded; a person opens a card's fold (its summary) before its pager. */
async function unfold(page: Page): Promise<void> {
  const closed = page.locator("details.pcard__fold:not([open]) > summary");
  while ((await closed.count()) > 0) await closed.first().click();
}

/**
 * Presses the stop's open fold up to `max` times, as long as one is left, and returns what each press appended. Every
 * press appends at least one row; a step under `STEP_MIN` is only the plan's last (no fold is left after it). With
 * `announced`, EVERY press must move the focus to the first row it appended and say so in the polite live region.
 */
async function openSteps(page: Page, max: number, announced = false): Promise<number[]> {
  const added: number[] = [];
  for (let press = 1; press <= max; press++) {
    const fold = page.locator(`${STOP} details.pager[data-deps]:not([open]) > summary`);
    if ((await fold.count()) === 0) break;
    const n = await page.locator(ROWS).count();
    // the live region is emptied first, so this press's announcement cannot be the last press's text still standing
    if (announced) await page.evaluate(() => document.getElementById("vf-pager-live")?.replaceChildren());
    await fold.last().click();
    await page.waitForFunction(([sel, k]) => document.querySelectorAll(sel).length > k, [ROWS, n] as const, { timeout: 2_000 });
    if (announced) {
      await page.waitForFunction(() => (document.getElementById("vf-pager-live")?.textContent ?? "") !== "", undefined, { timeout: 2_000 });
      expect(await page.evaluate(([sel, k]) => document.activeElement === document.querySelectorAll(sel)[k], [ROWS, n] as const), `press ${String(press)}: the focus is on its first new row`).toBe(true);
    }
    added.push((await page.locator(ROWS).count()) - n);
  }
  expect(added.length).toBeGreaterThanOrEqual(1);
  const folds = await page.locator(`${STOP} details.pager[data-deps]:not([open])`).count();
  for (const [i, k] of added.entries()) {
    expect(k).toBeLessThanOrEqual(STEP_MAX);
    if (i < added.length - 1 || folds > 0) expect(k).toBeGreaterThanOrEqual(STEP_MIN);
  }
  return added;
}

describe("#938 E1: Köln Hbf's departures, three more steps (a phone's browser)", () => {
  it("JavaScript on: up to three presses, each the rest of an hour, in time order, none twice; focus and announcement", async () => {
    const page = await browser.newPage({ viewport: PHONE });
    await page.goto(`${BASE}/de/place/koeln`);
    await unfold(page);
    await page.locator(STOP).waitFor({ timeout: 2_000 });
    const before = await times(page);
    expect(before.length).toBeGreaterThanOrEqual(1);
    const added = await openSteps(page, 3, true);
    const all = await times(page);
    const further = all.slice(before.length);
    expect(further).toHaveLength(added.reduce((a, b) => a + b, 0));
    // #1115 B: the clock cell is "08:16", or "08:19 08:16" for a late one (new, then the planned struck through) — the
    // board is in PLANNED time order across the card's last departure and every step, so the last time of each is read
    const minutes = all.map((t) => [...t.matchAll(/(\d{1,2}):(\d{2})/gu)].at(-1)).map((m) => Number(m?.[1]) * 60 + Number(m?.[2]));
    for (let i = 1; i < minutes.length; i++) expect(minutes[i], all.join(" ")).toBeGreaterThanOrEqual(minutes[i - 1]!);
    const lines = await page.locator(`${STOP} table.pcard__board tbody tr`).allTextContents();
    expect(new Set(lines).size).toBe(lines.length);
    // a further fold waits under the last step, or the plan's end line does — never both, never neither — and the
    // page has no horizontal scroll at 390 px
    const folds = await page.locator(`${STOP} details.pager[data-deps]:not([open])`).count();
    const ends = await page.locator(`${STOP} .pager__end`).count();
    expect(folds + ends).toBe(1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
    await page.close();
  }, 60_000);

  // the shared-bikes block under the card is left out: its publishers' credit links fail target-size before #938 too
  it("A3: axe finds no serious or critical violation in the stations card with three steps opened", async () => {
    const ctx = await browser.newContext({ viewport: PHONE });
    const page = await ctx.newPage();
    await page.goto(`${BASE}/de/place/koeln`);
    await unfold(page);
    await openSteps(page, 3);
    const r = await new AxeBuilder({ page }).include("#pcard-stations").exclude("#pcard-stations .pcard__sharing").withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
    expect(r.violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => `${v.id}: ${v.nodes.map((x) => x.target.join(" ")).join(", ")}`)).toEqual([]);
    expect(r.passes.length).toBeGreaterThan(0);
    await ctx.close();
  }, 60_000);

  it("the steps are a piece of the page: no-store, noindex, and the page carries no new inline script", async () => {
    const page = await browser.newPage({ viewport: PHONE });
    const steps: { status: number; cache: string | null; robots: string | null }[] = [];
    page.on("response", (r) => {
      if (r.url().includes("/fragment/more?") && r.url().includes("card=departures")) steps.push({ status: r.status(), cache: r.headers()["cache-control"] ?? null, robots: r.headers()["x-robots-tag"] ?? null });
    });
    await page.goto(`${BASE}/de/place/koeln`);
    await unfold(page);
    const scripts = await page.locator("script:not([src])").count();
    await page.locator(`${STOP} details.pager[data-deps] > summary`).first().click();
    await page.waitForFunction(() => document.querySelector("details.pager[data-deps][data-state=done]") !== null, undefined, { timeout: 2_000 });
    expect(steps).toEqual([{ status: 200, cache: "no-store", robots: "noindex, nofollow" }]);
    expect(await page.locator("script:not([src])").count()).toBe(scripts);
    await page.close();
  }, 60_000);

  it("JavaScript off: the fold's link opens the page with the stop's next step in place, noindex", async () => {
    const ctx = await browser.newContext({ viewport: PHONE, javaScriptEnabled: false });
    const page = await ctx.newPage();
    await page.goto(`${BASE}/de/place/koeln`);
    await unfold(page);
    const before = (await times(page)).length;
    const link = page.locator(`${STOP} details.pager[data-deps] a`).first();
    expect(await link.getAttribute("rel")).toBe("nofollow");
    const href = (await link.getAttribute("href")) ?? "";
    expect(href).toMatch(new RegExp(`\\?stop=${HBF.replace(/%/gu, "%")}&departures=1$`, "u"));
    await page.goto(`${BASE}${href}`);
    await unfold(page);
    const after = (await times(page)).length;
    expect(after).toBeGreaterThanOrEqual(before + STEP_MIN);
    expect(after).toBeLessThanOrEqual(before + STEP_MAX);
    expect(await page.locator('meta[name="robots"]').getAttribute("content")).toContain("noindex");
    // the next step's link asks for two
    expect(await page.locator(`${STOP} details.pager[data-deps] a`).last().getAttribute("href")).toMatch(/&departures=2$/u);
    await ctx.close();
  }, 60_000);
});

/** What a page may print verbatim in German on any page (`language.e2e.ts`' list): the publishers' credit lines. */
const VERBATIM: readonly string[] = [
  MTSK_CONSUMER_NOTE,
  ...Object.values(ATTRIBUTION).map((r) => datedAttribution(r.text, new Date())),
  ...Object.values(ATTRIBUTION).flatMap((r) => (r.conditionNote === undefined ? [] : [conditionAsRegistered(r.conditionNote.de, "de")])),
  ...Object.values(LICENCE_CATALOGUE).map((r) => datedAttribution(r.attribution ?? "", new Date())),
  DWD_SUMMARY_LINE,
  // #1085: the place Ampel credits a slipperiness reason with the road-weather summary line, as the motorway Ampel does
  DWD_ROAD_SUMMARY_LINE,
  DWD_TRANSLATED_LINE,
  ...DWD_LEVEL_NAMES,
];

describe("#938 D1: a translated place page with Köln Hbf's departures opened speaks only its own language", () => {
  for (const lang of ["en", "ru", "sr", "el", "tr"] as const) {
    it(`${lang}: three steps loaded by the script, then six opened without it (the end line)`, async () => {
      const page = await browser.newPage({ viewport: PHONE });
      try {
        await page.goto(`${BASE}${placePath(lang, "koeln")}`);
        await unfold(page);
        await openSteps(page, 3);
        const judgeNow = async (where: string): Promise<void> => {
          await page.evaluate(() => {
            document.title = "";
            document.querySelector('meta[name="description"]')?.remove();
          });
          const text: PageText = await page.evaluate(COLLECT_JS);
          expect(text.texts.length, where).toBeGreaterThan(20);
          expect(judge(lang, text, VERBATIM).map((f) => `${f.why} @ ${f.where}: ${f.text}`), where).toEqual([]);
        };
        await judgeNow(`${lang} three steps`);
        await page.goto(`${BASE}${placePath(lang, "koeln")}?stop=${HBF}&departures=6`);
        await unfold(page);
        // the end of the plan: no fold is left under the stop, the end line names the window's end
        expect(await page.locator("#pcard-stations .pager__end").count()).toBe(1);
        expect(await page.locator("#pcard-stations li:has(> .pager__end) details.pager[data-deps]").count()).toBe(0);
        expect(await page.locator("#pcard-stations li:has(> .pager__end) table.pcard__board tbody tr").count()).toBeGreaterThan(20);
        await judgeNow(`${lang} six steps, the end`);
      } finally {
        await page.close();
      }
    }, 60_000);
  }
});
