/**
 * #1180 on the home, the connect page and the news page, and the "Frag deine KI" box of the dashboard pages. The road's
 * file (`desktop-1180.e2e.ts`) and the place's (`desktop-place-1180.e2e.ts`) hold the same criteria for their pages.
 *
 *   AC 1  at 1440×900 and 1280×800, de and en: the H1's top at most 160 px; on the home with a place its status line and
 *         its first items, the heat strip's first five motorways and the connect block in the first viewport, the heat
 *         strip right of the place and the connect block right of the strip.
 *   AC 2  at 375, 768, 1024, 1280 and 1440 the home's components stand in one DOM order (#1177's); below 1024 px the
 *         heat strip and the ask box are not shown and the two "most affected" lists stand in their groups, as before.
 *         The connect and news pages likewise: one DOM order, below 1024 px one block under the other in it, from
 *         1024 px each column in it with the address (connect) or the plans and closures (news) right of the left one.
 *   AC 4  the home's connect block sticks under the header and covers nothing of the columns beside it.
 *   AC 5  at most eight desktop screens tall collapsed, at most 200 000 B gzip: the home with and without a place, the
 *         connect page, the news page; the city's roads, the DWD warnings and the fuel never fold, the fuel tile neither,
 *         and a folded panel's summary names its publishers (FS3).
 *         Measured once the home's live map (#1183, fetched by the browser) has landed: it stands behind its own line
 *         in the heat strip, closed, its credit lines inside with it (review S2 of aa0dd63ee).
 *   ask   from 1024 px the box stands under a place's, a motorway's and a station's sticky map, its link the connect page
 *         carrying the page's subject; below 1024 px it is not shown.
 *   axe   zero serious or critical violations at 1440, light and dark, on the home, the connect page and the news page.
 *
 * What this does NOT measure: a desktop without a script (every fold then stands open and the heat lists in their
 * groups). Run in the pinned Linux image (`e2e-arm.sh`); every wait is under the two-second ceiling.
 */
import type { ChildProcess } from "node:child_process";
import { gzipSync } from "node:zlib";
import { AxeBuilder } from "@axe-core/playwright";
import type { NodeResult, Result } from "axe-core";
import { chromium, type Browser, type BrowserContext, type Page } from "playwright";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { placePath } from "../src/site/places.js";
import { motorwayPath } from "../src/site/motorways.js";
import { HOME_REFRESH_CONTENT, pathFor } from "../src/site/pages.js";
import { startRealDigest } from "./real-digest.js";
import { openEveryFold, stickAt, stickyWalk } from "./sticky-bound.js";
import { startShell } from "./server.js";

const PORT = 8967;
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
/** The fixture's Köln, by its Gemeindeschlüssel: the home with a place. */
const HOME_AT = (lang: "de" | "en"): string => `${pathFor("start", lang)}?at=ags:05315000`;
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

describe("the home's first viewport on a desktop (#1180 AC 1)", () => {
  const measured: Record<string, unknown> = {};
  afterAll(() => console.log(`desktop home 1180 AC1: ${JSON.stringify(measured)}`));
  for (const v of DESKS) {
    for (const lang of ["de", "en"] as const) {
      it(`${lang} home with a place at ${String(v.width)}×${String(v.height)}`, async () => {
        const { ctx, page } = await open(HOME_AT(lang), v);
        const h1 = await box(page, "main h1");
        const status = await box(page, "#place-status");
        const rows = page.locator("#page-first .topitems__row");
        const n = await rows.count();
        expect(n, "the fixture's Köln has items").toBeGreaterThan(0);
        const last = (await rows.nth(Math.min(n, 5) - 1).boundingBox())!;
        // the heat strip: the two "most affected" lists moved out of their groups, open, their fifth row in view
        expect(await page.locator("#desk-heat > .now__widefold").count(), "both lists in the strip").toBe(2);
        const heat = await box(page, "#desk-heat");
        const fifth = (await page.locator("#desk-heat .motorway-top__list > li").nth(4).boundingBox())!;
        expect(fifth, "the fifth motorway is shown").not.toBeNull();
        expect(await page.locator("#desk-heat .motorway-top__list > li:visible").count(), "ten motorways on a desktop").toBe(10);
        const ask = await box(page, "#start");
        measured[`${lang} ${String(v.width)}`] = { h1Top: Math.round(h1.y), statusEnd: Math.round(status.y + status.height), itemEnd: Math.round(last.y + last.height), heatFifthEnd: Math.round(fifth.y + fifth.height), askTop: Math.round(ask.y) };
        expect(h1.y, "the H1's top").toBeLessThanOrEqual(H1_TOP_MAX);
        expect(status.y + status.height, "the status line in the first viewport").toBeLessThanOrEqual(v.height);
        expect(last.y + last.height, "the first five items in the first viewport").toBeLessThanOrEqual(v.height);
        expect(fifth.y + fifth.height, "the fifth motorway of the strip in the first viewport").toBeLessThanOrEqual(v.height);
        expect(ask.y, "the connect block in the first viewport").toBeLessThan(v.height / 4);
        expect(heat.x, "the strip right of the place").toBeGreaterThanOrEqual(h1.x + h1.width);
        expect(ask.x, "the connect block right of the strip").toBeGreaterThanOrEqual(heat.x + heat.width);
        await ctx.close();
      });
    }
  }
  for (const [name, path] of [
    ["connect", pathFor("connect", "de")],
    ["news", pathFor("news", "en")],
  ] as const) {
    it(`${name}: the H1's top at 1440 and 1280, the connect page's address right of it`, async () => {
      for (const v of DESKS) {
        const { ctx, page } = await open(path, v);
        const h1 = await box(page, "main h1");
        expect(h1.y, `${name} at ${String(v.width)}`).toBeLessThanOrEqual(H1_TOP_MAX);
        if (name === "connect") {
          const ep = await box(page, "#endpoint");
          expect(ep.y, "the address in the first viewport").toBeLessThan(v.height / 2);
          expect(ep.x, "the address right of the head").toBeGreaterThanOrEqual(h1.x + h1.width - 1);
        }
        await ctx.close();
      }
    });
  }
});

/** The home's components in the #1177 order: the H1, the place's status, Germany now, the connect block, the day. */
const ORDER = ["main h1", "#place-status", "#now", "#start", "#day", "#sources"] as const;

describe("one component order at every width (#1180 AC 2)", () => {
  for (const w of WIDTHS) {
    it(`home at ${String(w)} px`, async () => {
      const { ctx, page } = await open(HOME_AT("de"), { width: w, height: 900 });
      // one source order: each component follows the one before it in the DOM, whatever its place on screen
      const follows = await page.evaluate((ss) => ss.slice(1).map((s, i) => Boolean(document.querySelector(ss[i]!)!.compareDocumentPosition(document.querySelector(s)!) & Node.DOCUMENT_POSITION_FOLLOWING)), [...ORDER]);
      expect(follows, ORDER.join(" < ")).toEqual(ORDER.slice(1).map(() => true));
      const heat = await page.locator("#desk-heat").isVisible();
      const ask = await page.locator("#desk-ask").count();
      expect(ask, "the home carries no second ask box: its connect block is it").toBe(0);
      if (w >= 1024) {
        expect(heat, "the strip from 1024 px").toBe(true);
        const place = await box(page, "#place-status");
        for (const s of ["#desk-heat", "#start"]) expect((await box(page, s)).x, `${s} right of the place`).toBeGreaterThan(place.x + 1);
      } else {
        expect(heat, "no strip below 1024 px").toBe(false);
        // the phone's home as before: each list in its group, the blocks one under the other in the DOM's order
        expect(await page.locator("#now-roads > .now__widefold #motorway-top").count(), "the motorways in their group").toBe(1);
        expect(await page.locator("#now-rail > .now__widefold #station-top").count(), "the stations in their group").toBe(1);
        const tops: number[] = [];
        for (const s of ORDER) tops.push((await box(page, s)).y);
        expect(tops, ORDER.join(" above ")).toEqual([...tops].sort((a, b) => a - b));
        expect(await page.locator("[data-desk]").count(), "nothing collapsed by the desk below 1024 px").toBe(0);
        // only the phone's five rows of each list stand (`TOP_ITEMS`); the desktop's further five are in the HTML, hidden
        expect(await page.locator(".motorway-top__list > li:visible").count()).toBeLessThanOrEqual(5);
      }
      await ctx.close();
    });
  }
  // the connect and news pages: one DOM order at every width; below 1024 px the blocks one under the other in it, from
  // 1024 px the left column in it and the right column (the address; the plans and the long closures) in it, beside
  const PAGES = [
    { name: "connect", path: pathFor("connect", "de"), left: ["main h1", "#phone", "#clients", "#asks", "#answers", "#sources"], right: ["#endpoint"] },
    { name: "news", path: pathFor("news", "de"), left: ["main h1", "#new"], right: ["#plans", "#traffic"] },
  ] as const;
  for (const p of PAGES) {
    const dom = p.name === "connect" ? ["main h1", "#endpoint", ...p.left.slice(1)] : [...p.left, ...p.right];
    for (const w of WIDTHS) {
      it(`${p.name} at ${String(w)} px`, async () => {
        const { ctx, page } = await open(p.path, { width: w, height: 900 });
        const follows = await page.evaluate((ss) => ss.slice(1).map((s, i) => Boolean(document.querySelector(ss[i]!)!.compareDocumentPosition(document.querySelector(s)!) & Node.DOCUMENT_POSITION_FOLLOWING)), dom);
        expect(follows, dom.join(" < ")).toEqual(dom.slice(1).map(() => true));
        const tops = async (ss: readonly string[]): Promise<number[]> => { const t: number[] = []; for (const s of ss) t.push((await box(page, s)).y); return t; };
        if (w >= 1024) {
          const l = await tops(p.left);
          expect(l, `left: ${p.left.join(" above ")}`).toEqual([...l].sort((a, b) => a - b));
          const r = await tops(p.right);
          expect(r, `right: ${p.right.join(" above ")}`).toEqual([...r].sort((a, b) => a - b));
          const lead = await box(page, p.left[1]);
          for (const s of p.right) expect((await box(page, s)).x, `${s} right of ${p.left[1]}`).toBeGreaterThanOrEqual(lead.x + lead.width - 1);
        } else {
          const t = await tops(dom);
          expect(t, dom.join(" above ")).toEqual([...t].sort((a, b) => a - b));
          expect(await page.locator("[data-desk]").count(), "nothing collapsed by the desk below 1024 px").toBe(0);
        }
        await ctx.close();
      });
    }
  }
});

describe("the home's connect block is sticky and covers nothing (#1180 AC 4)", () => {
  for (const v of DESKS) {
    it(`scrolled down at ${String(v.width)}×${String(v.height)}`, async () => {
      const { ctx, page } = await open(HOME_AT("de"), v);
      const rowEnd = await page.evaluate(() => Math.round(document.querySelector("#desk-heat")!.getBoundingClientRect().bottom + window.scrollY));
      for (const y of [Math.round(v.height / 2), rowEnd - v.height]) {
        if (y <= 0) continue;
        await page.evaluate((to) => window.scrollTo(0, to), y);
        // #1195: its own area is its row, beside the heat strip: it sticks in it, or the row's end carries it up
        const at = await stickAt(page, ".desk__col--ask > .desk__stick", y);
        expect(at.why, `it sticks at ${String(y)}${at.carried ? " (carried up by the end of its area)" : ""}`).toBeNull();
        const ask = await box(page, ".desk__col--ask > .desk__stick");
        const over = await page.evaluate((m) => {
          const hits: string[] = [];
          for (const e of document.querySelectorAll(".desk__col--place > *, #desk-heat > *, .desk__col--now > *")) {
            const r = e.getBoundingClientRect();
            if (r.height === 0) continue;
            if (r.right > m.x && r.left < m.x + m.width && r.bottom > m.y && r.top < m.y + m.height) hits.push(e.id || e.className);
          }
          return hits;
        }, ask);
        expect(over, `nothing under the connect block at ${String(y)}`).toEqual([]);
      }
      await ctx.close();
    });
  }
  // the place bar opened grows the sticky header without a resize: the sticky column must read its height again
  // (`lib/desk.ts`, a ResizeObserver on `.site-head`), or the map slides under the header
  for (const [name, path, col] of [
    ["place", placePath("de", "koeln"), "#place-ampel"],
    ["home", HOME_AT("de"), ".desk__col--ask > .desk__stick"],
  ] as const) {
    it(`${name}: after the place bar opens, the sticky column still sits below the header`, async () => {
      const { ctx, page } = await open(path, DESKS[0]);
      await page.evaluate(() => window.scrollTo(0, 200));
      const before = await box(page, ".site-head");
      await page.click("#place-open");
      await expect.poll(async () => (await box(page, ".site-head")).height, { timeout: 2_000 }).toBeGreaterThan(before.height + 1);
      await expect.poll(async () => {
        const h = await box(page, ".site-head");
        return (await box(page, col)).y - (h.y + h.height);
      }, { timeout: 2_000, message: `${col} below the opened header` }).toBeGreaterThanOrEqual(0);
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
  const panels = (lang: "de" | "en"): readonly (readonly [string, string, string])[] => [
    ["home+place", HOME_AT(lang), ".desk__col--ask"],
    ["home", pathFor("start", lang), ".desk__col--ask"],
    ["connect", pathFor("connect", lang), "#endpoint"],
  ];
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

describe("the news page's right column scrolls with the page (#1196)", () => {
  for (const v of BOUND) {
    for (const lang of ["de", "en"] as const) {
      it(`${lang} news at ${String(v.width)}×${String(v.height)}`, async () => {
        const { ctx, page } = await open(pathFor("news", lang), v);
        const inner = await page.evaluate(() => {
          const out: string[] = [];
          for (const c of document.querySelectorAll(".desk--news > :is(#plans, #traffic)")) {
            for (const e of [c, ...c.querySelectorAll("*")]) {
              if (e.closest("pre, .table-scroll")) continue;
              if (/auto|scroll/u.test(getComputedStyle(e).overflowY) && e.scrollHeight > e.clientHeight + 1) out.push(e.id || e.className);
            }
          }
          return out;
        });
        expect(inner, "nothing in the right column scrolls inside itself").toEqual([]);
        await ctx.close();
      });
    }
  }
});

describe("eight desktop screens, 200 kB gzip (#1180 AC 5)", () => {
  const measured: Record<string, unknown> = {};
  afterAll(() => console.log(`desktop home 1180 AC5: ${JSON.stringify(measured)}`));
  const pages = (lang: "de" | "en"): readonly (readonly [string, string])[] => [
    ["home+place", HOME_AT(lang)],
    ["home", pathFor("start", lang)],
    ["connect", pathFor("connect", lang)],
    ["news", pathFor("news", lang)],
  ];
  for (const v of DESKS) {
    for (const lang of ["de", "en"] as const) {
      for (const [name, path] of pages(lang)) {
        it(`${lang} ${name} at ${String(v.width)}×${String(v.height)}`, async () => {
          const { ctx, page } = await open(path, v);
          if (name.startsWith("home")) {
            for (const s of NEVER_FOLDED) expect(await page.locator(`${s}[data-desk]`).count(), `${s} never folds`).toBe(0);
            // the fuel tile of "Deutschland jetzt" stands open (FS5) and none of its panels is collapsed by the desk
            expect(await page.locator("#now .now__cell:has(.credit--fuel)").count(), "the fixture's fuel tile").toBeGreaterThan(0);
            expect(await page.locator("#now .now__cell:has(.credit--fuel)[data-desk], #now .now__cell:has(.credit--fuel) [data-desk]").count(), "the fuel tile never folds").toBe(0);
            const summary = page.locator("#now [data-desk='native'] > details.fold > summary").first();
            expect(await summary.isVisible(), "a folded panel's summary stands").toBe(true);
            expect(await summary.locator(".fold__sources").count(), "its FS3 sources line").toBe(1);
          }
          if (name === "home+place") {
            expect(await page.locator(".place__cards [data-desk='native'], .place__cards > [data-desk='native']").count(), "the place's cards collapsed").toBeGreaterThan(0);
          }
          if (name.startsWith("home")) {
            // review S2: the live map arrives after the load (the loader's fetch); the page is measured with it in place
            await page.waitForSelector("#lmap-home-slot figure.lmap", { state: "attached" });
            const fold = await page.$eval("#lmap-home-slot", (s) => ({ heat: s.closest("#desk-heat") !== null, open: s.querySelector(":scope > details.lmap__homefold")?.hasAttribute("open") ?? null, summary: (s.querySelector(":scope > details.lmap__homefold > summary")?.getBoundingClientRect().height ?? 0) > 0, map: s.querySelector("figure.lmap")?.checkVisibility() ?? null }));
            expect(fold, "the live map behind its own line in the heat strip, closed").toEqual({ heat: true, open: false, summary: true, map: false });
          }
          const doc = await page.evaluate(() => document.documentElement.scrollHeight);
          const html = await (await fetch(url(path))).text();
          const gz = gzipSync(Buffer.from(html, "utf8")).length;
          measured[`${lang} ${name} ${String(v.width)}`] = { doc, screens: Math.round((doc / v.height) * 100) / 100, gzip: gz };
          expect(doc / v.height, "desktop screens, collapsed").toBeLessThanOrEqual(SCREENS_MAX);
          expect(gz, "gzip bytes").toBeLessThanOrEqual(GZIP_MAX);
          await ctx.close();
        });
      }
    }
  }
});

describe("the dashboard's ask box (#1180)", () => {
  const subjects = [
    ["place", placePath("de", "koeln"), "#place-ampel", "about=K%C3%B6ln"],
    ["motorway", motorwayPath("de", "A7"), ".motorway__map", "road=A7"],
  ] as const;
  for (const [name, path, map, query] of subjects) {
    // #1181 feature 5 (8b401f5c8): below 1024 px the box is no longer hidden — it stands at the end of the phone page
    it(`${name}: under the sticky map from 1024 px, the connect page with the subject; at 375 back at the page's end`, async () => {
      const { ctx, page } = await open(path, DESKS[0]);
      expect(await page.locator(`${map} > #desk-ask`).count(), "the box in the map's column").toBe(1);
      expect(await page.locator("#desk-ask").isVisible()).toBe(true);
      expect(await page.locator("#desk-ask a.askbox__go").getAttribute("href")).toContain(query);
      await page.setViewportSize({ width: 375, height: 800 });
      await expect.poll(() => page.locator(`${map} > #desk-ask`).count(), { timeout: 1_500 }).toBe(0);
      expect(await page.locator("#desk-ask").count(), "one box, put back in its place below 1024 px").toBe(1);
      expect(await page.locator("#desk-ask").isVisible(), "shown at the phone page's end (#1181 feature 5)").toBe(true);
      await ctx.close();
    });
  }
});

describe("axe on the desktop layouts (#1180 AC 6)", () => {
  for (const path of [HOME_AT("de"), pathFor("start", "en"), pathFor("connect", "de"), pathFor("news", "de")]) {
    for (const scheme of ["light", "dark"] as const) {
      it(`${path} at 1440 (${scheme})`, async () => {
        const { ctx, page } = await open(path, DESKS[0], scheme);
        const r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
        // the ONE exception a11y.e2e.ts makes (owner 2026-10-03, D3 amended): the home's timed reload, on the home only
        // and only while its refresh is exactly HOME_REFRESH_CONTENT
        const home = path.split("?")[0] === pathFor("start", "de") || path.split("?")[0] === pathFor("start", "en");
        const refresh = (await (await page.$('meta[http-equiv="refresh"]'))?.getAttribute("content")) ?? null;
        if (home) expect(refresh, `${path}: the excepted refresh drifted`).toBe(HOME_REFRESH_CONTENT);
        const bad = r.violations
          .filter((x: Result) => x.impact === "serious" || x.impact === "critical")
          .filter((x: Result) => !(home && x.id === "meta-refresh" && refresh === HOME_REFRESH_CONTENT))
          .map((x: Result) => `${x.id}: ${x.nodes.map((n: NodeResult) => n.target.join(" ")).slice(0, 3).join(" | ")}`);
        expect(bad).toEqual([]);
        await ctx.close();
      });
    }
  }
});
