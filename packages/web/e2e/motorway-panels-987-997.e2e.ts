/**
 * Review S2 of 2.3.23, against the BUILT shell and the REAL digest (`real-digest.ts`), in a real browser:
 *
 *  - #997: on /de/autobahn/a4 (the planted A4) the description's junction, Kreuz and roadworks figures are links, and
 *    following each lands on its panel — with JavaScript and with JavaScript off;
 *  - #987: on a fixture road with items (the A9, which carries a planted border crossing) the first card of the grid
 *    is tier A and the bridges-and-borders block (tier D) comes after every card; on a quiet road (the A61) the panels
 *    that hold nothing are chips of one "nothing reported" line, and a chip opens without JavaScript;
 *  - #1051 (owner 2026-10-25, replacing #987 rule 3's place before the tiers): the quiet line is the LAST of the lists,
 *    one wrapped line of frameless chips sharing the lead's baseline — at most 4 lines high at 1120 px (the #1180 dashboard's left column, owner 2026-11-06; 2 before) and 4 at 390 px —
 *    with no count, one "checked HH:MM" line, and on the A10 (the owner's reading) the detours never "live" beside the
 *    six-day-old weekly read; in every language at 390 px nothing overflows.
 */
import type { ChildProcess } from "node:child_process";
import { MOTORWAY_KIND_META, type MotorwayKind } from "@viafrei/digest";
import { chromium, type Browser, type BrowserContext, type Page } from "playwright";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { motorwayPath } from "../src/site/motorways.js";
import { LIVE_LANGS, type Lang } from "../src/site/pages.js";
import { NOW, startRealDigest } from "./real-digest.js";
import { startShell } from "./server.js";

const PORT = 8824;
const BASE = `http://127.0.0.1:${PORT}`;
const ID = { IMPRESSUM_NAME: "Panels Probe", IMPRESSUM_STREET: "Probeweg 9", IMPRESSUM_CITY: "00000 Probe", IMPRESSUM_EMAIL: "panels@example.invalid" };

let browser: Browser;
let shell: ChildProcess;
let digest: Awaited<ReturnType<typeof startRealDigest>>;

beforeAll(async () => {
  digest = await startRealDigest();
  shell = await startShell(PORT, { ...ID, DIGEST_URL: digest.url });
  browser = await chromium.launch();
});
afterAll(async () => {
  await browser?.close();
  shell?.kill();
  await digest?.close();
});

async function open(road: string, js: boolean, width = 1200, lang: Lang = "de"): Promise<{ ctx: BrowserContext; page: Page }> {
  const ctx = await browser.newContext({ viewport: { width, height: 900 }, javaScriptEnabled: js });
  const page = await ctx.newPage();
  await page.goto(`${BASE}${motorwayPath(lang, road)}`, { waitUntil: "load" });
  return { ctx, page };
}

/** Whether the element with `id` stands in the viewport now (its top inside the window). */
const inView = (page: Page, id: string): Promise<boolean> =>
  page.evaluate((x) => {
    const el = document.getElementById(x);
    if (el === null) return false;
    const r = el.getBoundingClientRect();
    return r.bottom > 0 && r.top < window.innerHeight;
  }, id);

const tierOfId = (id: string): string => MOTORWAY_KIND_META[id.replace(/^mwk-/, "") as MotorwayKind]?.tier ?? "?";

describe("#997 e2e: the description's figures land on their panels", () => {
  for (const js of [true, false]) {
    it(`on /de/autobahn/a4 the junctions, Kreuz and roadworks figures each land on their panel (JavaScript ${js ? "on" : "off"})`, async () => {
      for (const target of ["mw-junctions", "mwk-crossings", "mwk-roadworks"]) {
        const { ctx, page } = await open("A4", js);
        try {
          const link = page.locator(`.motorway__intro a[href="#${target}"], #page-first .jumps__chip[href="#${target}"]`); // #1173: the counts' links are the jump links
          expect(await link.count(), target).toBe(1);
          // the figure is the link's text: a number, never a bare word
          expect(await link.innerText(), target).toMatch(/\d/);
          expect(await inView(page, target), `${target} not in view before the click`).toBe(false);
          await link.click();
          await expect.poll(() => new URL(page.url()).hash, { timeout: 5_000 }).toBe(`#${target}`);
          await expect.poll(() => inView(page, target), { timeout: 5_000 }).toBe(true);
        } finally {
          await ctx.close();
        }
      }
    });
  }
});

describe("#987 e2e: the panels' order, the quiet line and the folded kinds", () => {
  it("a road with items (A9): the first card of the grid is tier A; the bridges-and-borders block holds tier D only and comes after every card", async () => {
    const { ctx, page } = await open("A9", true);
    try {
      const grid = await page.$$eval("#mw-cards > .mwk", (xs) => xs.map((x) => x.id));
      expect(grid.length).toBeGreaterThan(1);
      expect(tierOfId(grid[0]!), grid.join(" ")).toBe("A");
      // no tier-D panel in the grid; the reference block holds tier D only, the planted border crossing among it
      for (const id of grid) expect(tierOfId(id), id).not.toBe("D");
      const ref = await page.$$eval("#mw-ref .mwk", (xs) => xs.map((x) => x.id));
      expect(ref).toContain("mwk-borders");
      for (const id of ref) expect(tierOfId(id), id).toBe("D");
      // every card of the grid precedes the block, and the block precedes the quiet line (#1051, owner 2026-10-25: the
      // quiet line is the last of the lists, after the bridges and borders)
      const order = await page.evaluate(() => {
        const r = document.getElementById("mw-ref")!;
        const q = document.getElementById("mw-quiet");
        const before = (a: Element, b: Element): boolean => (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0;
        return { grid: [...document.querySelectorAll("#mw-cards .mwk")].every((x) => before(x, r)), quiet: q === null ? null : before(r, q) };
      });
      expect(order.grid).toBe(true);
      expect(order.quiet).toBe(true);
    } finally {
      await ctx.close();
    }
  });

  it("a quiet road (A61): the live panels are chips of the one \"nothing reported\" line, and a chip opens without JavaScript", async () => {
    const { ctx, page } = await open("A61", false);
    try {
      expect(await page.locator("#motorway-main .motorway__quiet").count()).toBe(1);
      expect((await page.innerText("#mw-quiet .mwk-quiet__lead")).trim()).toBe("Nichts gemeldet:");
      const folded = await page.$$eval("#mw-quiet details.mwk-chip", (xs) => xs.map((x) => x.id));
      expect(folded).toEqual(expect.arrayContaining(["mwk-closures", "mwk-jams", "mwk-roadworks"]));
      // none of them stands in the grid as well
      for (const id of folded) expect(await page.locator(`#mw-cards #${id}`).count(), id).toBe(0);
      // closed, and opened by its own summary with no script
      const d = page.locator("#mw-quiet #mwk-closures");
      expect(await d.evaluate((x) => (x as HTMLDetailsElement).open)).toBe(false);
      expect(await d.locator(".mwk__foldbody").isVisible()).toBe(false);
      await d.locator("summary").click();
      expect(await d.evaluate((x) => (x as HTMLDetailsElement).open)).toBe(true);
      expect(await d.locator(".mwk__foldbody").isVisible()).toBe(true);
    } finally {
      await ctx.close();
    }
  });
});

/** The quiet line's measured shape in the page (computed styles and boxes, read in the browser). */
type QuietShape = {
  readonly lastOfLists: boolean;
  readonly line: number;
  readonly height: number;
  readonly baselineDelta: number;
  readonly frames: readonly string[];
  readonly text: string;
  readonly overflow: boolean;
  readonly pageOverflow: boolean;
  /** The tallest chip summary, in lead lines: above one line a chip broke inside itself. */
  readonly tallestChip: number;
};
const quietShape = (page: Page): Promise<QuietShape> =>
  page.evaluate(() => {
    const q = document.getElementById("mw-quiet")!;
    const lead = q.querySelector<HTMLElement>(".mwk-quiet__lead")!;
    const firstTitle = q.querySelector<HTMLElement>(".mwk-chip .mwk-chip__t")!;
    // a zero-size inline-block on each text's baseline: its top IS the baseline
    const mark = (el: HTMLElement): number => {
      const m = document.createElement("span");
      m.style.cssText = "display:inline-block;width:0;height:0;vertical-align:baseline";
      el.appendChild(m);
      const y = m.getBoundingClientRect().top;
      m.remove();
      return y;
    };
    const frames: string[] = [];
    for (const el of q.querySelectorAll<HTMLElement>(".mwk-chip, .mwk-chip > summary")) {
      const cs = getComputedStyle(el);
      const framed = parseFloat(cs.borderTopWidth) > 0 || parseFloat(cs.borderLeftWidth) > 0 || cs.boxShadow !== "none" || (cs.backgroundColor !== "rgba(0, 0, 0, 0)" && cs.backgroundColor !== "transparent");
      if (framed) frames.push(`${el.closest(".mwk-chip")!.id} ${el.tagName}: border ${cs.borderTopWidth}, shadow ${cs.boxShadow}, background ${cs.backgroundColor}`);
    }
    const lists = document.getElementById("motorway-main")!;
    const later = [...lists.querySelectorAll(".mwk, .pcard")].filter((x) => !q.contains(x) && !x.contains(q) && (q.compareDocumentPosition(x) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0 && x.closest("#mw-sources") === null);
    return {
      lastOfLists: later.length === 0,
      line: lead.getBoundingClientRect().height,
      height: q.getBoundingClientRect().height,
      baselineDelta: Math.abs(mark(lead) - mark(firstTitle)),
      frames,
      text: q.innerText,
      overflow: q.scrollWidth > q.clientWidth + 1,
      tallestChip: Math.max(...[...q.querySelectorAll<HTMLElement>(".mwk-chip > summary")].map((x) => x.getBoundingClientRect().height)) / lead.getBoundingClientRect().height,
      pageOverflow: document.documentElement.scrollWidth > window.innerWidth,
    };
  });

describe("#1051 e2e: the quiet line — last, one wrapped line of frameless chips, one 'checked' time", () => {
  for (const road of ["A10", "A61"])
    for (const lang of ["de", "en"] as const)
      // #1180: from 1024 px the lists are the dashboard's left column, about 60 % of the content width (635 px at 1120,
      // the map sticky beside it; before #1180 the line took the page's whole width), so the chips wrap as on a phone: the
      // quiet line measured 3.18 lead lines at 1120 on A10 and A61 in de and en (macOS build, 2026-11-06; the noble
      // image's fonts run a few per cent wider), hence the phone's bound of 4 there, not 2
      for (const [width, maxLines] of [[1120, 4], [390, 4]] as const)
        it(`${motorwayPath(lang, road)} at ${String(width)} px: last of the lists, no frame, ≤ ${String(maxLines)} lines, one baseline, no count`, async () => {
          const { ctx, page } = await open(road, true, width, lang);
          try {
            const q = await quietShape(page);
            expect(q.lastOfLists, "nothing of the lists after the quiet line").toBe(true);
            expect(q.frames).toEqual([]);
            expect(q.line).toBeGreaterThan(10);
            expect(q.height / q.line, `height ${String(q.height)} px against a ${String(q.line)} px line`).toBeLessThanOrEqual(maxLines + 0.25);
            expect(q.baselineDelta).toBeLessThanOrEqual(1);
            expect(q.text).not.toMatch(/Eintr[aä]g|entr(?:y|ies)\b/i);
            expect(q.overflow).toBe(false);
            expect(q.pageOverflow).toBe(false);
            expect(q.tallestChip).toBeLessThanOrEqual(1.25);
          } finally {
            await ctx.close();
          }
        });

  it("A10 (the owner's reading): the detours join 'geprüft HH:MM' at the half-hourly check; no 'live' sign on the page shows a six-day-old time", async () => {
    for (const lang of ["de", "en"] as const) {
      const { ctx, page } = await open("A10", true, 1120, lang);
      try {
        const checked = (await page.innerText("#mw-quiet .mwk-quiet__checked")).trim();
        expect(checked, lang).toMatch(lang === "de" ? /^geprüft \d{2}:\d{2}$/ : /^checked \d{2}:\d{2}$/);
        expect(await page.locator("#mw-quiet #mwk-detours > summary .fresh").count(), lang).toBe(0);
        // every live sign's OWN time (its direct <time>, not a lagging source's line) is younger than a day
        const liveTimes = await page.$$eval("#motorway-main .fresh--live > time.fresh__t", (ts) => ts.map((t) => t.getAttribute("datetime") ?? ""));
        expect(liveTimes.length, lang).toBeGreaterThan(0);
        // against the fixture's own clock (the reads are planted relative to it)
        for (const t of liveTimes) expect(NOW.getTime() - Date.parse(t), t).toBeLessThan(86_400_000);
      } finally {
        await ctx.close();
      }
    }
  });

  it("with JavaScript off, every chip opens its coverage note by its own summary (A10)", async () => {
    const { ctx, page } = await open("A10", false, 1120);
    try {
      const ids = await page.$$eval("#mw-quiet details.mwk-chip", (xs) => xs.map((x) => x.id));
      expect(ids).toEqual(expect.arrayContaining(["mwk-closures", "mwk-detours"]));
      for (const id of ids) {
        const d = page.locator(`#mw-quiet #${id}`);
        expect(await d.locator(".mwk__foldbody").isVisible(), id).toBe(false);
        await d.locator("summary").click();
        expect(await d.evaluate((x) => (x as HTMLDetailsElement).open), id).toBe(true);
        expect(await d.locator(".mwk__foldbody").isVisible(), id).toBe(true);
      }
    } finally {
      await ctx.close();
    }
  });

  // the AC's 22-language bound is "no overflow" (the 2- and 4-line bounds are de/en's, above); with seven empty topics
  // the longest languages take 5–6 lines at 390 px (measured 2026-10-25), so each chip is held to ONE line instead
  it("in every live language at 390 px (A61): the line has its lead and chips, overflows nothing, no chip breaks inside itself", async () => {
    for (const lang of LIVE_LANGS) {
      const { ctx, page } = await open("A61", true, 390, lang);
      try {
        const q = await quietShape(page);
        expect(q.overflow, lang).toBe(false);
        expect(q.pageOverflow, lang).toBe(false);
        expect(q.tallestChip, lang).toBeLessThanOrEqual(1.25);
        expect(q.frames, lang).toEqual([]);
      } finally {
        await ctx.close();
      }
    }
  });
});
