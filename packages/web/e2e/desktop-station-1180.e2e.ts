/**
 * #1180 on a station page: the desktop dashboard from 1024 px — the board and the station's cards in the left column in
 * their DOM order, the nearby stops' card (the station's map) sticky in the right, the area's cards under them the full
 * width. The road's file (`desktop-1180.e2e.ts`) and the place's (`desktop-place-1180.e2e.ts`) hold the same criteria for
 * their pages; this one holds them for the fixture's Köln Hbf in German and English.
 *
 *   AC 1  at 1440×900 and 1280×800: the H1's top at most 160 px; the status line, the station's items and the map's
 *         drawing in the first viewport, the map right of the H1; the board right under the head, in the left column.
 *   AC 2  at 375, 768, 1024, 1280 and 1440 the components stand in one order (#1175's), and from 1024 px the station's
 *         blocks stand left of the map.
 *   AC 3  a stop's mark and its row light each other, by the pointer and by the keyboard; a mark still opens its stop.
 *   AC 4  the map card sticks under the header and covers no card while the station's part scrolls past.
 *   AC 5  at most eight desktop screens tall collapsed, at most 200 000 B gzip; the board, the lifts, the alerts and the
 *         area's fuel never fold; a folded area card's summary names its publishers (FS3), and a folded station card
 *         keeps its sources in view.
 *   axe   zero serious or critical violations at 1440, light and dark.
 *
 * What this does NOT measure: a desktop without a script (every card then stands open, as on a tablet). Run in the pinned
 * Linux image (`e2e-arm.sh`); every wait is under the two-second ceiling.
 */
import type { ChildProcess } from "node:child_process";
import { gzipSync } from "node:zlib";
import { AxeBuilder } from "@axe-core/playwright";
import type { NodeResult, Result } from "axe-core";
import { chromium, type Browser, type BrowserContext, type Page } from "playwright";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { stationPath } from "../src/site/stations.js";
import { startRealDigest } from "./real-digest.js";
import { openEveryFold, stickAt, stickyWalk } from "./sticky-bound.js";
import { startShell } from "./server.js";

const PORT = 8958;
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
const STATION = { de: stationPath("de", "koeln-hbf"), en: stationPath("en", "koeln-hbf") } as const;
const MAP = "#pcard-station-nearby";
/** What is happening never folds: the board, the lifts, the alerts (#1175), the fuel (FS-2026-11-06 FS5). */
const NEVER_FOLDED = ["#pcard-station-board", "#pcard-station-lifts", "#pcard-station-alerts", "#pcard-fuel"] as const;

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

describe("the first viewport of a station on a desktop (#1180 AC 1)", () => {
  const measured: Record<string, unknown> = {};
  afterAll(() => console.log(`desktop station 1180 AC1: ${JSON.stringify(measured)}`));
  for (const v of DESKS) {
    for (const lang of ["de", "en"] as const) {
      it(`${lang} station at ${String(v.width)}×${String(v.height)}`, async () => {
        const { ctx, page } = await open(STATION[lang], v);
        const h1 = await box(page, "main h1");
        const status = await box(page, "#station-status");
        const rows = page.locator("#page-first .topitems__row");
        const n = await rows.count();
        expect(n, "the fixture's Köln Hbf has items").toBeGreaterThan(0);
        const last = (await rows.nth(n - 1).boundingBox())!;
        expect(last, "every item of the block is shown on a desktop").not.toBeNull();
        const svg = await box(page, `${MAP} .stmap`);
        const board = await box(page, "#pcard-station-board");
        measured[`${lang} ${String(v.width)}`] = { items: n, h1Top: Math.round(h1.y), statusEnd: Math.round(status.y + status.height), lastItemEnd: Math.round(last.y + last.height), mapEnd: Math.round(svg.y + svg.height), boardTop: Math.round(board.y) };
        expect(h1.y, "the H1's top").toBeLessThanOrEqual(H1_TOP_MAX);
        expect(status.y + status.height, "the status line in the first viewport").toBeLessThanOrEqual(v.height);
        expect(last.y + last.height, "the station's items in the first viewport").toBeLessThanOrEqual(v.height);
        expect(svg.y + svg.height, "the whole map drawing in the first viewport").toBeLessThanOrEqual(v.height);
        expect(svg.x, "the map stands right of the head").toBeGreaterThanOrEqual(h1.x + h1.width);
        expect(board.x + board.width, "the board in the left column").toBeLessThanOrEqual(svg.x);
        await ctx.close();
      });
    }
  }
});

/** The components a station page stands in, in the #1175 order. */
const ORDER = ["main h1", "#station-status", "#page-first .jumps", "#pcard-station-board", "#station-sources", "#place-cards .place__cards"] as const;

describe("one component order at every width (#1180 AC 2)", () => {
  for (const w of WIDTHS) {
    it(`station at ${String(w)} px`, async () => {
      const { ctx, page } = await open(STATION.de, { width: w, height: 900 });
      const tops: number[] = [];
      for (const s of ORDER) tops.push((await box(page, s)).y);
      expect(tops, ORDER.join(" < ")).toEqual([...tops].sort((a, b) => a - b));
      // the map card follows the board in the DOM at every width: one source order, only its place on screen moves
      expect(await page.evaluate((m) => Boolean(document.querySelector("#pcard-station-board")!.compareDocumentPosition(document.querySelector(m)!) & Node.DOCUMENT_POSITION_FOLLOWING), MAP)).toBe(true);
      const map = await box(page, MAP);
      if (w >= 1024) {
        for (const s of ORDER.slice(0, 5)) expect((await box(page, s)).x + 1, `${s} left of the map`).toBeLessThan(map.x);
      } else {
        const board = await box(page, "#pcard-station-board");
        expect(map.y, "below 1024 px the map card stands in the column, after the board").toBeGreaterThan(board.y);
      }
      await ctx.close();
    });
  }
});

describe("row ↔ marker on a station (#1180 AC 3)", () => {
  it("each stop's mark and its row light each other by the keyboard and the pointer; the mark still opens the stop", async () => {
    const { ctx, page } = await open(STATION.de, DESKS[0]);
    const pairs = await page.evaluate((m) => {
      const card = document.querySelector(m)!;
      return [...card.querySelectorAll("svg a[href]")].map((a) => {
        const h = a.getAttribute("href") ?? "";
        const row = [...card.querySelectorAll("li[id]")].find((r) => [...r.querySelectorAll("a[href]")].some((x) => !x.closest("svg") && x.getAttribute("href") === h));
        return { h, row: row?.id ?? "" };
      });
    }, MAP);
    expect(pairs.length, "the fixture's map draws its stops").toBeGreaterThan(1);
    for (const p of pairs) expect(p.row, `${p.h} has its row`).not.toBe("");
    const hot = (): Promise<readonly string[]> => page.evaluate(() => [...document.querySelectorAll(".desk .is-hot")].map((e) => e.id || (e.getAttribute("href") ?? "")).sort());
    for (const p of pairs) {
      // the keyboard: the mark's focus lights its own row and no other
      await page.locator(`${MAP} svg a[href="${p.h}"]`).focus();
      expect(await hot(), `focus on ${p.h}`).toEqual([p.h, p.row].sort());
      // the row's focus lights its own mark
      await page.locator(`[id="${p.row}"] a[href="${p.h}"]`).first().focus();
      expect(await hot(), `focus on the row ${p.row}`).toEqual([p.h, p.row].sort());
    }
    // the pointer, on the last stop: hovering its row lights its mark
    const lastPair = pairs[pairs.length - 1]!;
    await page.locator(`[id="${lastPair.row}"]`).hover();
    expect(await hot()).toEqual([lastPair.h, lastPair.row].sort());
    // the mark is still the stop's link: no script takes its page away
    await page.locator(`${MAP} svg a[href="${lastPair.h}"]`).focus();
    await Promise.all([page.waitForURL((u) => u.pathname === lastPair.h.split("?")[0], { timeout: 1_500 }), page.keyboard.press("Enter")]);
    await ctx.close();
  });
});

describe("the station's map is sticky and covers nothing (#1180 AC 4)", () => {
  for (const v of DESKS) {
    it(`scrolled down the station at ${String(v.width)}×${String(v.height)}`, async () => {
      const { ctx, page } = await open(STATION.de, v);
      // the station's part longer than the window: its folded cards opened
      for (const b of await page.locator(".desk__more").all()) if (await b.isVisible()) await b.click();
      const end = await page.evaluate(() => {
        const s = document.querySelector("#station-sources")!.getBoundingClientRect();
        return Math.round(s.bottom + window.scrollY);
      });
      expect(end, "the station's part is longer than the window").toBeGreaterThan(v.height * 2);
      for (const y of [Math.round(v.height / 2), Math.round(end / 2), end - v.height - 40]) {
        await page.evaluate((to) => window.scrollTo(0, to), y);
        // #1195: under the header, or carried up by the end of its own area (`stickAt`)
        const at = await stickAt(page, MAP, y);
        expect(at.why, `the map sticks at ${String(y)}${at.carried ? " (carried up by the end of its area)" : ""}`).toBeNull();
        const map = await box(page, MAP);
        const over = await page.evaluate((m) => {
          const hits: string[] = [];
          for (const e of document.querySelectorAll(".desk .stpage__card:not(#pcard-station-nearby), .desk .pagehead, .desk .stlive__chips")) {
            const r = e.getBoundingClientRect();
            if (r.height === 0) continue;
            if (r.right > m.x && r.left < m.x + m.width && r.bottom > m.y && r.top < m.y + m.height) hits.push(e.id || e.className);
          }
          return hits;
        }, map);
        expect(over, `nothing of the station under the map at ${String(y)}`).toEqual([]);
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
  const panels = (lang: "de" | "en"): readonly (readonly [string, string, string])[] => [["station", STATION[lang], MAP]];
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

describe("a station in eight desktop screens, 200 kB gzip (#1180 AC 5)", () => {
  const measured: Record<string, unknown> = {};
  afterAll(() => console.log(`desktop station 1180 AC5: ${JSON.stringify(measured)}`));
  for (const v of DESKS) {
    for (const lang of ["de", "en"] as const) {
      it(`${lang} station at ${String(v.width)}×${String(v.height)}`, async () => {
        const { ctx, page } = await open(STATION[lang], v);
        const native = await page.locator("[data-desk='native']").count();
        const folded = await page.locator("[data-desk='folded']").count();
        expect(native, "the area's cards closed on their own fold").toBeGreaterThan(0);
        expect(folded, "the station's static cards folded").toBeGreaterThan(0);
        for (const s of NEVER_FOLDED) expect(await page.locator(`${s}[data-desk]`).count(), `${s} never folds`).toBe(0);
        // FS3: a folded area card's summary is in view and names its publishers
        const summary = page.locator("[data-desk='native'] > details.fold > summary").first();
        expect(await summary.isVisible(), "a folded card's summary stands").toBe(true);
        expect(await summary.locator(".fold__sources").count(), "its FS3 sources line").toBe(1);
        // a folded station card keeps its sources in view, and its button names a count
        for (const f of await page.locator("[data-desk='folded']").all()) {
          const foot = f.locator(":scope > .pcard__foot");
          if ((await foot.count()) > 0) expect(await foot.isVisible(), "the folded card's sources stand").toBe(true);
        }
        for (const b of await page.locator(".desk__more").allTextContents()) expect(b, "a button names its count").not.toMatch(/\b0\b/u);
        const doc = await page.evaluate(() => document.documentElement.scrollHeight);
        const html = await (await fetch(url(STATION[lang]))).text();
        const gz = gzipSync(Buffer.from(html, "utf8")).length;
        measured[`${lang} ${String(v.width)}`] = { native, folded, doc, screens: Math.round((doc / v.height) * 100) / 100, gzip: gz };
        expect(doc / v.height, "desktop screens, collapsed").toBeLessThanOrEqual(SCREENS_MAX);
        expect(gz, "gzip bytes").toBeLessThanOrEqual(GZIP_MAX);
        await ctx.close();
      });
    }
  }
});

describe("axe on a station's desktop layout (#1180 AC 6)", () => {
  for (const scheme of ["light", "dark"] as const) {
    it(`${STATION.de} at 1440 (${scheme})`, async () => {
      const { ctx, page } = await open(STATION.de, DESKS[0], scheme);
      const r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
      const bad = r.violations.filter((x: Result) => x.impact === "serious" || x.impact === "critical").map((x: Result) => `${x.id}: ${x.nodes.map((n: NodeResult) => n.target.join(" ")).slice(0, 3).join(" | ")}`);
      expect(bad).toEqual([]);
      await ctx.close();
    });
  }
});
