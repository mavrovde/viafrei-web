/**
 * #1180 on a place page: the desktop dashboard from 1024 px — the page's blocks in the left column in their DOM order, the
 * place's Ampel card with its map sticky in the right. The road's file (`desktop-1180.e2e.ts`) holds the same criteria
 * for a motorway; this one holds them for the fixture's Köln in German and English.
 *
 *   AC 1  at 1440×900 and 1280×800: the H1's top at most 160 px; the status line, the first items and the map's drawing in
 *         the first viewport, the map right of the H1.
 *   AC 2  at 375, 768, 1024, 1280 and 1440 the components stand in one order (#1176's), and from 1024 px each block of
 *         the left column stands left of the map.
 *   AC 3  a place's map marks are its rows' links: focusing a mark lights its row, activating it opens the row's card.
 *   AC 4  the Ampel card sticks under the header and covers no card, scrolled down a page longer than the window.
 *   AC 5  at most eight desktop screens tall collapsed, at most 200 000 B gzip; the city's roads, the DWD
 *         warnings and the fuel never fold, and a folded card's summary still names its publishers (FS3).
 *   axe   zero serious or critical violations at 1440, light and dark.
 *
 * What this does NOT measure: a desktop without a script (every card then stands open, as on a tablet) and a browser
 * without `display: contents`. Run in the pinned Linux image (`e2e-arm.sh`); every wait is under the two-second ceiling.
 */
import type { ChildProcess } from "node:child_process";
import { gzipSync } from "node:zlib";
import { AxeBuilder } from "@axe-core/playwright";
import type { NodeResult, Result } from "axe-core";
import { chromium, type Browser, type BrowserContext, type Page } from "playwright";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { placePath } from "../src/site/places.js";
import { startRealDigest } from "./real-digest.js";
import { openEveryFold, stickAt, stickyWalk } from "./sticky-bound.js";
import { startShell } from "./server.js";

const PORT = 8957;
const ID = { IMPRESSUM_NAME: "Fold Probe", IMPRESSUM_STREET: "Probeweg 5", IMPRESSUM_CITY: "00000 Probe", IMPRESSUM_EMAIL: "fold@example.invalid" };
const THIRD_PARTY = /googletagmanager\.com|google-analytics\.com|clarity\.ms/u;
const DESKS = [
  { width: 1440, height: 900 },
  { width: 1280, height: 800 },
] as const;
const WIDTHS = [375, 768, 1024, 1280, 1440] as const;
const H1_TOP_MAX = 160;
const SCREENS_MAX = 8;
const GZIP_MAX = 200_000;
const PLACE = { de: placePath("de", "koeln"), en: placePath("en", "koeln") } as const;
const MAP = "#place-ampel";
/** What is happening never folds (#1173; FS-2026-11-06 for the fuel). */
const NEVER_FOLDED = ["#pcard-roads", "#pcard-warnings", "#pcard-fuel"] as const;

let browser: Browser;
let digest: Awaited<ReturnType<typeof startRealDigest>>;
let shell: ChildProcess;
const url = (path: string): string => `http://127.0.0.1:${String(PORT)}${path}`;

beforeAll(async () => {
  digest = await startRealDigest({});
  shell = await startShell(PORT, { ...ID, DIGEST_URL: digest.url });
  browser = await chromium.launch();
});
afterAll(async () => {
  await browser?.close();
  shell?.kill();
  await digest?.close();
});

async function open(path: string, viewport: { readonly width: number; readonly height: number }, scheme: "light" | "dark" = "light"): Promise<{ readonly ctx: BrowserContext; readonly page: Page }> {
  const ctx = await browser.newContext({ viewport, colorScheme: scheme });
  ctx.setDefaultTimeout(2_000);
  await ctx.route(THIRD_PARTY, (r) => r.fulfill({ status: 204, body: "" }));
  const page = await ctx.newPage();
  await page.goto(url(path));
  return { ctx, page };
}

type Box = { readonly x: number; readonly y: number; readonly width: number; readonly height: number };
async function box(page: Page, selector: string): Promise<Box> {
  const b = await page.locator(selector).first().boundingBox();
  if (b === null) throw new Error(`${selector}: not on the page, or not shown`);
  return b;
}

describe("the first viewport of a place on a desktop (#1180 AC 1)", () => {
  const measured: Record<string, unknown> = {};
  afterAll(() => console.log(`desktop place 1180 AC1: ${JSON.stringify(measured)}`));
  for (const v of DESKS) {
    for (const lang of ["de", "en"] as const) {
      it(`${lang} place at ${String(v.width)}×${String(v.height)}`, async () => {
        const { ctx, page } = await open(PLACE[lang], v);
        const h1 = await box(page, "main h1");
        const status = await box(page, "#place-status");
        const rows = page.locator("#page-first .topitems__row");
        const n = await rows.count();
        expect(n, "the fixture's Köln has items").toBeGreaterThan(0);
        const last = (await rows.nth(n - 1).boundingBox())!;
        expect(last, "every item of the block is shown on a desktop").not.toBeNull();
        const svg = await box(page, `${MAP} .pam__svg`);
        measured[`${lang} ${String(v.width)}`] = { items: n, h1Top: Math.round(h1.y), statusEnd: Math.round(status.y + status.height), lastItemEnd: Math.round(last.y + last.height), mapEnd: Math.round(svg.y + svg.height) };
        expect(h1.y, "the H1's top").toBeLessThanOrEqual(H1_TOP_MAX);
        expect(status.y + status.height, "the status line in the first viewport").toBeLessThanOrEqual(v.height);
        expect(last.y + last.height, "the first items in the first viewport").toBeLessThanOrEqual(v.height);
        expect(svg.y + svg.height, "the whole map drawing in the first viewport").toBeLessThanOrEqual(v.height);
        expect(svg.x, "the map stands right of the head").toBeGreaterThanOrEqual(h1.x + h1.width);
        await ctx.close();
      });
    }
  }
});

/** The components a place page stands in, in the #1176 order. */
const ORDER = ["main h1", "#place-status", "#page-first .jumps", "#place-cards .place__cards"] as const;

describe("one component order at every width (#1180 AC 2)", () => {
  for (const w of WIDTHS) {
    it(`place at ${String(w)} px`, async () => {
      const { ctx, page } = await open(PLACE.de, { width: w, height: 900 });
      const tops: number[] = [];
      for (const s of ORDER) tops.push((await box(page, s)).y);
      expect(tops, ORDER.join(" < ")).toEqual([...tops].sort((a, b) => a - b));
      // the Ampel card follows the block in the DOM at every width: one source order, only its place on screen moves
      expect(await page.evaluate((m) => Boolean(document.querySelector("#page-first")!.compareDocumentPosition(document.querySelector(m)!) & Node.DOCUMENT_POSITION_FOLLOWING), MAP)).toBe(true);
      if (w >= 1024) {
        const map = await box(page, MAP);
        for (const s of ORDER) expect((await box(page, s)).x + 1, `${s} left of the map`).toBeLessThan(map.x);
      } else {
        const map = await box(page, MAP);
        const status = await box(page, "#place-status");
        expect(map.y, "below 1024 px the Ampel card stands in the column, after the block").toBeGreaterThan(status.y);
      }
      await ctx.close();
    });
  }
});

describe("row ↔ marker on a place (#1180 AC 3)", () => {
  it("each mark's link names a row the page holds; focusing a mark lights its row, Enter opens its card", async () => {
    const { ctx, page } = await open(PLACE.de, DESKS[0]);
    const hrefs = await page.evaluate((m) => [...document.querySelectorAll(`${m} a.map-link`)].map((a) => (a.getAttribute("href") ?? "").slice(1)), MAP);
    expect(hrefs.length, "the fixture's map links its marks").toBeGreaterThan(0);
    for (const h of hrefs) expect(await page.locator(`[id="${h}"]`).count(), h).toBe(1);
    // the first mark that names a row of a card (a mark may also name a whole card, the DWD's warning)
    const row = await page.evaluate((xs) => xs.find((id) => document.getElementById(id)?.matches(".pcard") === false) ?? "", hrefs);
    expect(row, "a mark of the fixture names a row").not.toBe("");
    const lit = (): Promise<readonly string[]> => page.evaluate(() => [...document.querySelectorAll(".desk .is-hot")].filter((e) => !e.closest("svg")).map((r) => r.id));
    await page.locator(`${MAP} a.map-link[href="#${row}"]`).first().focus();
    expect(await lit(), "the mark's focus lights its row alone").toEqual([row]);
    // and the pointer on a row in view (a folded card's rows are not) lights its mark
    const shown = await page.evaluate((xs) => xs.find((id) => { const e = document.getElementById(id); return e?.matches(".pcard") === false && e.checkVisibility(); }) ?? "", hrefs);
    expect(shown, "a mark of the fixture names a row in view").not.toBe("");
    await page.locator(`[id="${shown}"]`).first().hover();
    expect(await page.evaluate(() => [...document.querySelectorAll(".desk svg .is-hot")].map((a) => a.getAttribute("href"))), "the row lights its mark").toContain(`#${shown}`);
    await page.locator(`${MAP} a.map-link[href="#${row}"]`).first().focus();
    await page.keyboard.press("Enter");
    await expect.poll(() => page.locator(`[id="${row}"]`).first().isVisible(), { timeout: 1_500 }).toBe(true);
    expect(await page.evaluate(() => location.hash)).toBe(`#${row}`);
    await ctx.close();
  });
});

describe("the place's map is sticky and covers nothing (#1180 AC 4)", () => {
  for (const v of DESKS) {
    it(`scrolled down at ${String(v.width)}×${String(v.height)}`, async () => {
      const { ctx, page } = await open(PLACE.de, v);
      // the page longer than the window: every folded card opened
      for (const d of await page.locator("[data-desk='native'] > details.fold > summary").all()) await d.click();
      // the map's own rows end with the dashboard's grid: scrolled until its last window
      const end = await page.evaluate(() => Math.round(document.querySelector(".desk")!.getBoundingClientRect().bottom + window.scrollY));
      expect(end, "the opened page is longer than the window").toBeGreaterThan(v.height * 2);
      for (const y of [v.height, Math.round(end / 2), end - v.height]) {
        await page.evaluate((to) => window.scrollTo(0, to), y);
        // #1195: under the header, or carried up by the end of its own area (`stickAt`)
        const at = await stickAt(page, MAP, y);
        expect(at.why, `the map sticks at ${String(y)}${at.carried ? " (carried up by the end of its area)" : ""}`).toBeNull();
        const map = await box(page, MAP);
        const over = await page.evaluate((m) => {
          const hits: string[] = [];
          for (const e of document.querySelectorAll(".desk .place__cards > .pcard, .desk .pagehead")) {
            const r = e.getBoundingClientRect();
            if (r.height === 0) continue;
            if (r.right > m.x && r.left < m.x + m.width && r.bottom > m.y && r.top < m.y + m.height) hits.push(e.id || e.className);
          }
          return hits;
        }, map);
        expect(over, `nothing of the cards under the map at ${String(y)}`).toEqual([]);
      }
      await ctx.close();
    });
  }
});

/** #1195: the two desktop sizes the sticky panels are walked at, to the end of the page. */
const BOUND = [
  { width: 1440, height: 900 },
  { width: 1024, height: 768 },
] as const;

describe("the side panel stays in its own area to the end of the page and shows all it holds (#1195, #1196)", () => {
  const measured: Record<string, unknown> = {};
  afterAll(() => console.log(`sticky bound 1195: ${JSON.stringify(measured)}`));
  const panels = (lang: "de" | "en"): readonly (readonly [string, string, string])[] => [["place", PLACE[lang], MAP]];
  for (const v of BOUND) {
    for (const lang of ["de", "en"] as const) {
      for (const [name, path, panel] of panels(lang)) {
        it(`${lang} ${name} at ${String(v.width)}×${String(v.height)}, as served and with every fold open`, async () => {
          const { ctx, page } = await open(path, v);
          for (const opened of [false, true]) {
            if (opened) await openEveryFold(page);
            const w = await stickyWalk(page, panel);
            measured[`${lang} ${name} ${String(v.width)} ${opened ? "open" : "served"}`] = { steps: w.steps.length, end: w.steps[w.steps.length - 1], stuck: w.stuck.length, blocks: w.blocks, hits: w.hits.length, inner: w.inner.length, lines: w.lines, unseen: w.unseen.length };
            expect(w.blocks, "blocks compared").toBeGreaterThan(2);
            expect(w.steps.length, "the page is walked in more than two steps").toBeGreaterThan(2);
            expect(w.hits, `${w.panel} covers no other block (${opened ? "every fold open" : "as served"})`).toEqual([]);
            expect(w.inner, `nothing of ${w.panel} scrolls inside it (#1196)`).toEqual([]);
            expect(w.unseen, `every row and line of ${w.panel} is reached by the page's scroll (#1196)`).toEqual([]);
          }
          await ctx.close();
        });
      }
    }
  }
});

describe("a place in eight desktop screens, 200 kB gzip (#1180 AC 5)", () => {
  const measured: Record<string, unknown> = {};
  afterAll(() => console.log(`desktop place 1180 AC5: ${JSON.stringify(measured)}`));
  for (const v of DESKS) {
    for (const lang of ["de", "en"] as const) {
      it(`${lang} place at ${String(v.width)}×${String(v.height)}`, async () => {
        const { ctx, page } = await open(PLACE[lang], v);
        const folded = await page.locator("[data-desk='native']").count();
        expect(folded, "the collapse ran").toBeGreaterThan(0);
        for (const s of NEVER_FOLDED) expect(await page.locator(`${s}[data-desk]`).count(), `${s} never folds`).toBe(0);
        // FS3: a folded card's summary is in view and names its publishers
        const summary = page.locator("[data-desk='native'] > details.fold > summary").first();
        expect(await summary.isVisible(), "a folded card's summary stands").toBe(true);
        expect(await summary.locator(".fold__sources").count(), "its FS3 sources line").toBe(1);
        const doc = await page.evaluate(() => document.documentElement.scrollHeight);
        const html = await (await fetch(url(PLACE[lang]))).text();
        const gz = gzipSync(Buffer.from(html, "utf8")).length;
        measured[`${lang} ${String(v.width)}`] = { folded, doc, screens: Math.round((doc / v.height) * 100) / 100, gzip: gz };
        expect(doc / v.height, "desktop screens, collapsed").toBeLessThanOrEqual(SCREENS_MAX);
        expect(gz, "gzip bytes").toBeLessThanOrEqual(GZIP_MAX);
        await ctx.close();
      });
    }
  }
});

describe("axe on a place's desktop layout (#1180 AC 6)", () => {
  for (const scheme of ["light", "dark"] as const) {
    it(`${PLACE.de} at 1440 (${scheme})`, async () => {
      const { ctx, page } = await open(PLACE.de, DESKS[0], scheme);
      const r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
      const bad = r.violations.filter((x: Result) => x.impact === "serious" || x.impact === "critical").map((x: Result) => `${x.id}: ${x.nodes.map((n: NodeResult) => n.target.join(" ")).slice(0, 3).join(" | ")}`);
      expect(bad).toEqual([]);
      await ctx.close();
    });
  }
});
