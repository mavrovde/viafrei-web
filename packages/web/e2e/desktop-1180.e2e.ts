/**
 * #1180: the desktop dashboard — the page's blocks in the left column in their phone order, its map sticky on the right,
 * the rows and the map's marks paired. This file is the road page; every page type carries the layout now, each in its
 * own file: `desktop-place-1180`, `desktop-station-1180`, and the home, connect and news pages in `desktop-home-1180`.
 *
 *   AC 1  at 1440×900 and 1280×800, de and en: the H1 top ≤ 160 px; the status line, the first five items and the map in
 *         the first viewport.
 *   AC 2  at 375/768/1024/1280/1440 the components stand in the same order (#1173): H1, status line, items, jump links,
 *         the lists, the route, the questions — by their tops, in the left column on a desktop.
 *   AC 3  row ↔ marker with the mouse and the keyboard on the fixture's three-event road (the A4: one closure, two
 *         roadworks), and the pairing check is shown able to say NO: a mark relinked to its neighbour's row is caught.
 *   AC 4  the map sticks under the site's header and never covers the list, scrolled down a list longer than the window.
 *   AC 5  each page at most eight desktop screens tall collapsed, and at most 200 000 B gzip.
 *   axe   zero serious or critical violations at 1440, light and dark.
 *
 * What this does NOT measure, so a pass says nothing about it: a browser without `:has()` or `display: contents` (the
 * grid then does not form and the page reads as on a tablet), a desktop with a script turned off (every section then
 * stands whole, as before #1180, and AC 5's count does not hold), and the other page types (their own files above).
 *
 * Run in the pinned Linux image (`e2e-arm.sh`); every wait is under the two-second ceiling.
 */
import type { ChildProcess } from "node:child_process";
import { gzipSync } from "node:zlib";
import { AxeBuilder } from "@axe-core/playwright";
import type { NodeResult, Result } from "axe-core";
import { chromium, type Browser, type BrowserContext, type Page } from "playwright";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { startRealDigest } from "./real-digest.js";
import { openEveryFold, stickAt, stickyWalk } from "./sticky-bound.js";
import { startShell } from "./server.js";

const PORT = 8956;
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
const ROAD = { de: "/de/autobahn/a7", en: "/en/motorway/a7" } as const;
/** The fixture's road with three reported events, each a row and a mark: one closure (`mw-c`), two roadworks (`mw-r`). */
const THREE = "/de/autobahn/a4";
const EVENT = /^mw-(c|r)\d+$/u;

let browser: Browser;
let digest: Awaited<ReturnType<typeof startRealDigest>>;
let shell: ChildProcess;
const url = (path: string): string => `http://127.0.0.1:${String(PORT)}${path}`;

beforeAll(async () => {
  digest = await startRealDigest({});
  shell = await startShell(PORT, { ...ID, DIGEST_URL: digest.url, VF_MOTORWAY_AROUND: "1" });
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

describe("the first viewport of a desktop (#1180 AC 1)", () => {
  const measured: Record<string, unknown> = {};
  afterAll(() => console.log(`desktop 1180 AC1: ${JSON.stringify(measured)}`));
  for (const v of DESKS) {
    for (const lang of ["de", "en"] as const) {
      it(`${lang} road at ${String(v.width)}×${String(v.height)}`, async () => {
        const { ctx, page } = await open(ROAD[lang], v);
        const h1 = await box(page, "main h1");
        const status = await box(page, "#road-status");
        const rows = page.locator("#page-first .topitems__row");
        expect(await rows.count(), "the fixture's A7 has five items and more").toBe(5);
        const fifth = (await rows.nth(4).boundingBox())!;
        expect(fifth, "the fifth item is shown on a desktop").not.toBeNull();
        const svg = await box(page, ".motorway__map .motorway__svg");
        measured[`${lang} ${String(v.width)}`] = { h1Top: Math.round(h1.y), statusEnd: Math.round(status.y + status.height), fifthEnd: Math.round(fifth.y + fifth.height), mapEnd: Math.round(svg.y + svg.height) };
        expect(h1.y, "the H1's top").toBeLessThanOrEqual(H1_TOP_MAX);
        expect(status.y + status.height, "the status line in the first viewport").toBeLessThanOrEqual(v.height);
        expect(fifth.y + fifth.height, "the first five items in the first viewport").toBeLessThanOrEqual(v.height);
        expect(svg.y + svg.height, "the whole map drawing in the first viewport").toBeLessThanOrEqual(v.height);
        expect(svg.x, "the map stands right of the head").toBeGreaterThanOrEqual(h1.x + h1.width);
        await ctx.close();
      });
    }
  }
  it("a phone still shows three items, the fourth and fifth only on a desktop", async () => {
    const { ctx, page } = await open(ROAD.de, { width: 375, height: 812 });
    expect(await page.locator("#page-first .topitems__row").count()).toBe(5);
    expect(await page.locator("#page-first .topitems__row:visible").count()).toBe(3);
    await ctx.close();
  });
});

/** The components a road page stands in, in the #1173 order. */
const ORDER = ["main h1", "#road-status", "#page-first .topitems", "#page-first .jumps", "#mw-cards", "#mw-route", ".motorway-faq"] as const;

describe("one component order at every width (#1180 AC 2)", () => {
  for (const w of WIDTHS) {
    it(`road at ${String(w)} px`, async () => {
      const { ctx, page } = await open(ROAD.de, { width: w, height: 900 });
      const tops: number[] = [];
      for (const s of ORDER) tops.push((await box(page, s)).y);
      const sorted = [...tops].sort((a, b) => a - b);
      expect(tops, `the order by top at ${String(w)} px`).toEqual(sorted);
      if (w >= 1024) {
        const map = await box(page, ".motorway__map");
        for (const s of ORDER) {
          const b = await box(page, s);
          expect(b.x + b.width, `${s} stands left of the map at ${String(w)} px`).toBeLessThanOrEqual(map.x);
        }
      }
      await ctx.close();
    });
  }
});

/**
 * Every event row and its marks agree: each mark links a row of this page, the row's text names the place the mark's
 * title names, and lighting the row lights exactly its own marks. The mismatches, so a planted fault can be shown to
 * produce one.
 */
async function pairing(page: Page): Promise<readonly string[]> {
  return page.evaluate((evRe) => {
    const re = new RegExp(evRe, "u");
    const bad: string[] = [];
    const marks = [...document.querySelectorAll<SVGAElement>(".motorway__map a.map-link")];
    const ev = marks.filter((a) => re.test((a.getAttribute("href") ?? "").slice(1)));
    if (ev.length !== 3) bad.push(`want 3 event marks, got ${String(ev.length)}`);
    for (const a of ev) {
      const id = (a.getAttribute("href") ?? "").slice(1);
      const row = document.getElementById(id);
      // the title is "<what> · <from> - <to>"; the row names its place "bei <from>" or "zwischen <from> und <to>"
      const where = (a.querySelector("title")?.textContent ?? "").split(" · ").slice(1).join(" · ");
      const from = (where.split(/ [-–] /u)[0] ?? "").trim();
      const text = (row?.textContent ?? "").replace(/\s+/gu, " ");
      if (row === null) bad.push(`${id}: no row`);
      else if (from === "" || !text.includes(from)) bad.push(`${id}: the row does not name "${from}"`);
    }
    return bad;
  }, EVENT.source);
}

async function lit(page: Page): Promise<{ readonly marks: readonly string[]; readonly rows: readonly string[] }> {
  return page.evaluate(() => ({
    marks: [...document.querySelectorAll(".motorway__map a.map-link.is-hot")].map((a) => a.getAttribute("href") ?? ""),
    rows: [...document.querySelectorAll(".desk li.is-hot, .desk tr.is-hot")].map((r) => r.id),
  }));
}

describe("row ↔ marker (#1180 AC 3)", () => {
  it("the three-event road pairs each row with its own marks", async () => {
    const { ctx, page } = await open(THREE, DESKS[0]);
    expect(await pairing(page)).toEqual([]);
    await ctx.close();
  });

  it("a mark relinked to its neighbour's row is caught (the check can say NO)", async () => {
    const { ctx, page } = await open(THREE, DESKS[0]);
    await page.evaluate((evRe) => {
      const re = new RegExp(evRe, "u");
      const ev = [...document.querySelectorAll(".motorway__map a.map-link")].filter((a) => re.test((a.getAttribute("href") ?? "").slice(1)));
      const [a, b] = [ev[0]!, ev[1]!];
      const ha = a.getAttribute("href")!;
      a.setAttribute("href", b.getAttribute("href")!);
      b.setAttribute("href", ha);
    }, EVENT.source);
    expect((await pairing(page)).length, "the swapped pair is reported").toBeGreaterThan(0);
    await ctx.close();
  });

  it("the mouse: a row lights its marks, a mark lights its row, a click opens and marks the row", async () => {
    const { ctx, page } = await open(THREE, DESKS[0]);
    const ids = await page.evaluate((evRe) => [...document.querySelectorAll(".motorway__map a.map-link")].map((a) => (a.getAttribute("href") ?? "").slice(1)).filter((h) => new RegExp(evRe, "u").test(h)), EVENT.source);
    expect(ids).toHaveLength(3);
    const open1 = ids.find((i) => i.startsWith("mw-c"))!;
    await page.locator(`#${open1}`).hover();
    expect(await lit(page)).toEqual({ marks: [`#${open1}`], rows: [open1] });
    // the mouse goes where the mark is on top: two marks may share a spot (a parking area at the closure's junction)
    const spots = await page.evaluate((xs) => {
      const out: Record<string, { x: number; y: number } | null> = {};
      for (const id of xs) {
        out[id] = null;
        for (const h of document.querySelectorAll(`.motorway__map a.map-link[href="#${id}"] .map-hit`)) {
          const r = h.getBoundingClientRect();
          const p = { x: r.left + r.width / 2, y: r.top + r.height / 2 };
          if (document.elementFromPoint(p.x, p.y)?.closest("a.map-link")?.getAttribute("href") === `#${id}`) out[id] = p;
        }
      }
      return out;
    }, ids);
    const reachable = ids.filter((i) => spots[i] !== null);
    // every event mark is drawn above the sites' and chargers' targets (`motorway-map.ts`, #1180): on this road each one
    // shares its spot with a parking site, and before that order no mouse reached any of them
    expect(reachable, "each of the three event marks is on top at its own spot").toEqual(ids);
    for (const id of reachable) {
      await page.mouse.move(spots[id]!.x, spots[id]!.y);
      expect((await lit(page)).rows, `the mark of ${id} lights its row`).toEqual([id]);
    }
    // a roadworks row sits in a folded card on a desktop: the click opens it and marks the row in view
    const folded = reachable.find((i) => !i.startsWith("mw-c"))!;
    expect(folded, "a roadworks mark the mouse reaches").toBeDefined();
    expect(await page.locator(`#${folded}`).isVisible(), "folded before the click").toBe(false);
    await page.mouse.click(spots[folded]!.x, spots[folded]!.y);
    await expect.poll(() => page.locator(`#${folded}`).isVisible(), { timeout: 1_500 }).toBe(true);
    expect(await page.locator(`#${folded}`).evaluate((e) => e.classList.contains("is-hit"))).toBe(true);
    const r = await box(page, `#${folded}`);
    expect(r.y + r.height, "the row is in the window").toBeLessThanOrEqual(DESKS[0].height);
    expect(r.y).toBeGreaterThanOrEqual(0);
    await ctx.close();
  });

  it("the keyboard: focusing a row's link lights its marks; a mark activated by Enter opens its row", async () => {
    const { ctx, page } = await open(THREE, DESKS[0]);
    // by the row's own kind, never a prefix: `#mw-c` is also the start of a charger's `#mw-ch0`
    const kindOf = (re: string): Promise<string> =>
      page.evaluate((src) => (Array.from(document.querySelectorAll(".motorway__map a.map-link")).map((a) => (a.getAttribute("href") ?? "").slice(1)).find((h) => new RegExp(src, "u").test(h)) ?? ""), re);
    const closure = await kindOf("^mw-c\\d+$");
    expect(closure).not.toBe("");
    await page.locator(`#${closure} a`).first().focus();
    expect((await lit(page)).marks).toEqual([`#${closure}`]);
    const works = await kindOf("^mw-r\\d+$");
    expect(works).not.toBe("");
    await page.locator(`.motorway__map a.map-link[href="#${works}"]`).first().focus();
    expect((await lit(page)).rows).toEqual([works]);
    await page.keyboard.press("Enter");
    await expect.poll(() => page.locator(`#${works}`).isVisible(), { timeout: 1_500 }).toBe(true);
    expect(await page.evaluate(() => location.hash)).toBe(`#${works}`);
    await ctx.close();
  });

  it("a folded card opens by its button, which says what it holds", async () => {
    const { ctx, page } = await open(ROAD.de, DESKS[0]);
    const b = page.locator('#mwk-parking .desk__more[aria-expanded="false"]');
    expect(await b.textContent()).toMatch(/^alle \d+ anzeigen$/u);
    expect(await page.locator("#mwk-parking > ul.pcard__list").isVisible()).toBe(false);
    await b.click();
    expect(await page.locator("#mwk-parking > ul.pcard__list").isVisible()).toBe(true);
    expect(await page.locator('#mwk-parking .desk__more[aria-expanded="true"]').count()).toBe(1);
    // what must be seen is never folded: every closure and every jam, and the fuel card (FS-2026-11-06)
    for (const s of ["#mwk-closures", "#mwk-jams", "#mwk-fuel"]) expect(await page.locator(`${s}[data-desk]`).count(), s).toBe(0);
    await ctx.close();
  });
});

describe("the map is sticky and covers nothing (#1180 AC 4)", () => {
  for (const v of DESKS) {
    it(`scrolled down the lists at ${String(v.width)}×${String(v.height)}`, async () => {
      const { ctx, page } = await open(ROAD.de, v);
      // the list longer than the window: the closures card with every parking row opened
      await page.locator("#mwk-parking .desk__more").click();
      const doc = await page.evaluate(() => document.documentElement.scrollHeight);
      expect(doc, "the opened list is longer than the window").toBeGreaterThan(v.height * 3);
      for (const y of [v.height, Math.round(doc / 2), doc - v.height * 2]) {
        await page.evaluate((to) => window.scrollTo(0, to), y);
        // #1195: under the header, or carried up by the end of its own area (`stickAt`)
        const at = await stickAt(page, ".motorway__map", y);
        expect(at.why, `the map sticks at ${String(y)}${at.carried ? " (carried up by the end of its area)" : ""}`).toBeNull();
        const map = await box(page, ".motorway__map");
        const over = await page.evaluate((m) => {
          const hits: string[] = [];
          for (const e of document.querySelectorAll(".desk .pcard, .desk .pagehead, .desk ol.motorway__junctions, .desk .motorway-faq")) {
            const r = e.getBoundingClientRect();
            if (r.height === 0) continue;
            if (r.right > m.x && r.left < m.x + m.width && r.bottom > m.y && r.top < m.y + m.height) hits.push(e.id || e.className);
          }
          return hits;
        }, map);
        expect(over, `nothing of the list under the map at ${String(y)}`).toEqual([]);
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
  const panels = (lang: "de" | "en"): readonly (readonly [string, string, string])[] => [["road", ROAD[lang], ".motorway__map"]];
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

describe("eight desktop screens, 200 kB gzip (#1180 AC 5)", () => {
  const measured: Record<string, unknown> = {};
  afterAll(() => console.log(`desktop 1180 AC5: ${JSON.stringify(measured)}`));
  for (const v of DESKS) {
    for (const lang of ["de", "en"] as const) {
      it(`${lang} road at ${String(v.width)}×${String(v.height)}`, async () => {
        const { ctx, page } = await open(ROAD[lang], v);
        expect(await page.locator("[data-desk='folded']").count(), "the collapse ran").toBeGreaterThan(5);
        const doc = await page.evaluate(() => document.documentElement.scrollHeight);
        const html = await (await fetch(url(ROAD[lang]))).text();
        const gz = gzipSync(Buffer.from(html, "utf8")).length;
        measured[`${lang} ${String(v.width)}`] = { doc, screens: Math.round((doc / v.height) * 100) / 100, gzip: gz };
        expect(doc / v.height, "desktop screens, collapsed").toBeLessThanOrEqual(SCREENS_MAX);
        expect(gz, "gzip bytes").toBeLessThanOrEqual(GZIP_MAX);
        await ctx.close();
      });
    }
  }
});

describe("axe on the desktop layout (#1180 AC 6)", () => {
  for (const scheme of ["light", "dark"] as const) {
    for (const path of [ROAD.de, THREE]) {
      it(`${path} at 1440 (${scheme})`, async () => {
        const { ctx, page } = await open(path, DESKS[0], scheme);
        const r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
        const bad = r.violations.filter((x: Result) => x.impact === "serious" || x.impact === "critical").map((x: Result) => `${x.id}: ${x.nodes.map((n: NodeResult) => n.target.join(" ")).slice(0, 3).join(" | ")}`);
        expect(bad).toEqual([]);
        await ctx.close();
      });
    }
  }
});
